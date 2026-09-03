import type { AudioInput, AudioRecordingResult } from '@/audio/types';
import type { SpeechToTextConfig, SpeechToTextEngine, TranscriptionResult } from '@/ai/types';
import { WHISPER_MODELS, WhisperModel } from '@/ai/types';

/**
 * SpeechToTextService — application layer over SpeechToTextEngine.
 * UI depends on this, not on whisper.cpp directly.
 * Handles filePath normalization, model switching, and error mapping.
 */
export class SpeechToTextService {
  private engine: SpeechToTextEngine;
  private defaultLanguage = 'es';
  private defaultThreads = 4;
  private initializedModel: WhisperModel | null = null;

  constructor(engine: SpeechToTextEngine) {
    this.engine = engine;
  }

  get engineName(): string {
    return this.engine.name;
  }

  get status() {
    return this.engine.status;
  }

  async isReady(): Promise<boolean> {
    const available = await this.engine.isAvailable();
    return available && this.engine.status === 'ready';
  }

  /**
   * Initialize with model. Called lazily on first transcribe if not already ready.
   */
  async initialize(model: WhisperModel = WhisperModel.TINY, modelPath?: string): Promise<void> {
    const info = WHISPER_MODELS[model];
    const config: SpeechToTextConfig = {
      modelPath: modelPath ?? '',
      language: info.language,
      translate: false,
      threads: this.defaultThreads,
      modelName: info.displayName,
      model,
    };
    // If modelPath empty, engine may resolve via provider
    await this.engine.initialize(config);
    this.initializedModel = model;
  }

  /**
   * Transcribe: accepts filePath string (preferred) or AudioInput or AudioRecordingResult.
   */
  async transcribe(
    audio: string | AudioInput | AudioRecordingResult,
  ): Promise<TranscriptionResult> {
    // Lazy init if needed
    if (this.engine.status !== 'ready') {
      await this.initialize(this.initializedModel ?? WhisperModel.TINY);
    }

    let input: string | AudioInput;
    if (typeof audio === 'string') {
      input = audio;
    } else if ('filePath' in audio && typeof (audio as AudioRecordingResult).filePath === 'string') {
      input = (audio as AudioRecordingResult).filePath;
      // Attach duration for RTF — engine will compute if we pass string + duration via wrapper?
      // For now, pass as AudioInput with uri to preserve duration
      input = {
        uri: (audio as AudioRecordingResult).filePath,
        format: (audio as AudioRecordingResult).format,
        durationMs: (audio as AudioRecordingResult).durationMs,
        sampleRate: (audio as AudioRecordingResult).sampleRate ?? 44100,
        channels: (audio as AudioRecordingResult).channels ?? 2,
      } as AudioInput;
    } else {
      input = audio as AudioInput;
    }

    return this.engine.transcribe(input);
  }

  async dispose(): Promise<void> {
    await this.engine.dispose();
    this.initializedModel = null;
  }

  // Compatibility with old SpeechToTextService { transcribe(AudioInput) }
  async transcribeAudioInput(audio: AudioInput): Promise<TranscriptionResult> {
    return this.transcribe(audio);
  }
}
