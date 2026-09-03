import type { AudioInput } from '@/audio/types';
import { computeRTF, normalizeAudioPath } from '@/audio/AudioConverter';
import type {
  ModelStatus,
  SpeechModelProvider,
  SpeechToTextConfig,
  SpeechToTextEngine,
  TranscriptionResult,
} from '@/ai/types';
import type { WhisperNativeModule } from '@/native/types';

/**
 * WhisperCppEngine — bridges SpeechToTextEngine → NativeWhisperModule (C++ whisper.cpp)
 * - Lifecycle: initialize(config) → transcribe(filePath) → dispose()
 * - One active transcription at a time (mutex)
 * - Never uses Base64; passes filePath to native
 * - Inference runs on native background thread
 */
export class WhisperCppEngine implements SpeechToTextEngine {
  readonly name: string;
  private _status: ModelStatus = 'not_loaded';
  private config: SpeechToTextConfig | null = null;
  private isTranscribing = false;
  private native: WhisperNativeModule;
  private modelProvider?: SpeechModelProvider;

  constructor(nativeModule: WhisperNativeModule, modelProvider?: SpeechModelProvider, name = 'whisper.cpp-tiny') {
    this.native = nativeModule;
    this.modelProvider = modelProvider;
    this.name = name;
  }

  get status(): ModelStatus {
    return this._status;
  }

  async isAvailable(): Promise<boolean> {
    return this.native.isAvailable();
  }

  async initialize(config: SpeechToTextConfig): Promise<void> {
    if (this._status === 'loading') {
      throw Object.assign(new Error('Speech recognition failed'), { code: 'CONCURRENT_LOAD' });
    }
    this._status = 'loading';
    this.config = config;
    try {
      // Prefer provider path if config.modelPath is placeholder
      const modelPath = config.modelPath || (this.modelProvider ? await this.modelProvider.getModelPath() : '');
      if (!modelPath) {
        throw Object.assign(new Error('Whisper model not found'), { code: 'MODEL_NOT_FOUND' });
      }
      await this.native.loadModel(modelPath);
      this._status = 'ready';
      // Log for metrics (local only)
      console.log(`[Whisper] initialized model=${config.modelName ?? config.model ?? 'tiny'} path=${modelPath} threads=${config.threads ?? 'auto'} lang=${config.language}`);
    } catch (e) {
      this._status = 'error';
      const code = (e as { code?: string })?.code;
      if (code === 'MODEL_NOT_FOUND') throw Object.assign(new Error('Whisper model not found'), { code });
      if (code === 'OUT_OF_MEMORY' || (e as Error).message.includes('memory')) {
        throw Object.assign(new Error('Not enough memory to run speech recognition'), { code: 'OUT_OF_MEMORY' });
      }
      throw Object.assign(new Error('Unable to load speech model'), { code: 'MODEL_LOAD_FAILED', cause: e });
    }
  }

  async transcribe(audio: AudioInput | string): Promise<TranscriptionResult> {
    if (this._status !== 'ready' || !this.config) {
      // Allow lazy initialize if provider available
      if (this.modelProvider && this._status === 'not_loaded') {
        const info = await this.modelProvider.getModelInfo();
        const path = await this.modelProvider.getModelPath();
        await this.initialize({
          modelPath: path,
          language: info.language,
          translate: false,
          threads: 4,
          modelName: info.displayName,
          model: info.name,
        });
      } else {
        throw Object.assign(new Error('Unable to load speech model'), { code: 'MODEL_NOT_READY' });
      }
    }

    if (this.isTranscribing) {
      throw Object.assign(new Error('Speech recognition failed'), { code: 'CONCURRENT_TRANSCRIPTION' });
    }

    // Extract filePath and duration
    let filePath: string;
    let audioDurationMs = 0;
    if (typeof audio === 'string') {
      filePath = normalizeAudioPath(audio);
      audioDurationMs = 0;
    } else {
      if (audio.uri) filePath = normalizeAudioPath(audio.uri);
      else if ((audio as unknown as { filePath?: string }).filePath) {
        filePath = normalizeAudioPath((audio as unknown as { filePath: string }).filePath);
      } else if (audio.buffer) {
        throw Object.assign(new Error('Audio format is not supported'), {
          code: 'UNSUPPORTED_FORMAT',
          detail: 'buffer not supported — pass filePath',
        });
      } else {
        throw Object.assign(new Error('Unable to process audio'), { code: 'INVALID_AUDIO' });
      }
      audioDurationMs = audio.durationMs ?? 0;
    }

    if (!filePath) {
      throw Object.assign(new Error('Unable to process audio'), { code: 'INVALID_AUDIO' });
    }

    this.isTranscribing = true;
    const start = Date.now();
    let memoryUsageBytes: number | undefined;

    try {
      // Optional memory before
      try {
        if (this.native.getMemoryUsage) {
          const mem = await this.native.getMemoryUsage();
          if (typeof mem === 'number') memoryUsageBytes = mem;
        }
      } catch {}

      console.log(`[Whisper] transcribe start file=${filePath} lang=${this.config!.language} translate=${this.config!.translate}`);
      const res = await this.native.transcribe(filePath, {
        language: this.config!.language,
        threads: this.config!.threads,
        translate: this.config!.translate,
      });

      const transcriptionDurationMs = Date.now() - start;
      const rtf = computeRTF(transcriptionDurationMs, audioDurationMs);
      const modelName = this.config!.modelName ?? this.config!.model ?? 'tiny';

      let modelSizeBytes: number | undefined;
      try {
        if (this.modelProvider?.getModelInfo) {
          const info = await this.modelProvider.getModelInfo();
          modelSizeBytes = info.sizeBytes;
        }
      } catch {}

      // memory after
      try {
        if (this.native.getMemoryUsage) {
          const memAfter = await this.native.getMemoryUsage();
          if (typeof memAfter === 'number') memoryUsageBytes = memAfter;
        }
      } catch {}

      console.log(`[Whisper] transcribe done text="${res.text.slice(0, 80)}" inference=${transcriptionDurationMs}ms rtf=${rtf?.toFixed(2) ?? '—'}`);

      const result: TranscriptionResult = {
        text: res.text,
        language: res.language ?? this.config!.language,
        durationMs: audioDurationMs,
        audioDurationMs,
        transcriptionDurationMs,
        rtf,
        modelSizeBytes,
        modelName,
        memoryUsageBytes,
        segments: res.segments,
        metrics: {
          latencyMs: transcriptionDurationMs,
          memoryUsageMb: memoryUsageBytes ? memoryUsageBytes / (1024 * 1024) : undefined,
        },
      };
      return result;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'MODEL_NOT_FOUND') throw Object.assign(new Error('Whisper model not found'), { code });
      if (code === 'OUT_OF_MEMORY') throw Object.assign(new Error('Not enough memory to run speech recognition'), { code });
      if (code === 'UNSUPPORTED_FORMAT') throw e;
      if (code === 'INVALID_AUDIO') throw Object.assign(new Error('Unable to process audio'), { code });
      throw Object.assign(new Error('Unable to transcribe audio'), { code: 'TRANSCRIPTION_FAILED', cause: e });
    } finally {
      this.isTranscribing = false;
    }
  }

  async dispose(): Promise<void> {
    try {
      await this.native.unloadModel();
    } catch {}
    this._status = 'not_loaded';
    this.config = null;
  }

  // Deprecated aliases
  async loadModel(): Promise<void> {
    if (this.modelProvider) {
      const path = await this.modelProvider.getModelPath();
      const info = await this.modelProvider.getModelInfo();
      await this.initialize({
        modelPath: path,
        language: info.language,
        translate: false,
        modelName: info.displayName,
        model: info.name,
      });
    }
  }

  async unloadModel(): Promise<void> {
    await this.dispose();
  }
}
