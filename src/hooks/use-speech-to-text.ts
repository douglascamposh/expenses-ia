import { useCallback, useRef, useState } from 'react';

import type { AudioRecordingResult } from '@/audio/types';
import type { TranscriptionResult } from '@/ai/types';
import { WhisperModel } from '@/ai/types';
import { WhisperModelManager } from '@/ai/model/ModelManager';
import { WhisperCppEngine } from '@/ai/engines/WhisperCppEngine';
import { WhisperNativeModuleInstance } from '@/native/WhisperNativeModule';
import { SpeechToTextService } from '@/services/speech-to-text.service';

export type SpeechToTextStatus = 'idle' | 'loading_model' | 'transcribing' | 'complete' | 'error';

type UseSpeechToTextReturn = {
  status: SpeechToTextStatus;
  result: TranscriptionResult | null;
  errorMessage: string | null;
  isTranscribing: boolean;
  transcribe: (audio: AudioRecordingResult | string) => Promise<TranscriptionResult | null>;
  reset: () => void;
  dispose: () => Promise<void>;
};

let sharedService: SpeechToTextService | null = null;

function getService(): SpeechToTextService {
  if (!sharedService) {
    const manager = new WhisperModelManager(WhisperModel.TINY, null);
    const engine = new WhisperCppEngine(WhisperNativeModuleInstance, manager, 'whisper.cpp-tiny');
    sharedService = new SpeechToTextService(engine);
  }
  return sharedService;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [status, setStatus] = useState<SpeechToTextStatus>('idle');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const transcribingRef = useRef(false);

  const transcribe = useCallback(async (audio: AudioRecordingResult | string): Promise<TranscriptionResult | null> => {
    if (transcribingRef.current) {
      setErrorMessage('Speech recognition failed');
      return null;
    }
    transcribingRef.current = true;
    setErrorMessage(null);
    setStatus('transcribing');
    try {
      const service = getService();
      // Ensure model loaded — will throw MODEL_NOT_FOUND if not bundled
      if (service.status !== 'ready') {
        setStatus('loading_model');
        try {
          await service.initialize(WhisperModel.TINY);
        } catch (e) {
          const code = (e as { code?: string })?.code;
          if (code === 'MODEL_NOT_FOUND') throw Object.assign(new Error('Whisper model not found'), { code });
          throw e;
        }
        setStatus('transcribing');
      }
      const res = await service.transcribe(audio as unknown as string);
      setResult(res);
      setStatus('complete');
      return res;
    } catch (e) {
      const err = e as Error & { code?: string };
      const code = err.code;
      let msg = 'Unable to transcribe audio';
      if (code === 'MODEL_NOT_FOUND') msg = 'Whisper model not found';
      else if (code === 'OUT_OF_MEMORY') msg = 'Not enough memory to run speech recognition';
      else if (code === 'INVALID_AUDIO' || code === 'UNSUPPORTED_FORMAT') msg = 'Unable to process audio';
      else if (err.message === 'Whisper model not found') msg = 'Whisper model not found';
      else if (err.message === 'Not enough memory to run speech recognition') msg = 'Not enough memory to run speech recognition';
      else if (err.message.includes('format')) msg = 'Audio format is not supported';
      setErrorMessage(msg);
      setStatus('error');
      console.error('[SpeechToText] error', err);
      return null;
    } finally {
      transcribingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  const dispose = useCallback(async () => {
    try {
      await getService().dispose();
    } catch {}
    reset();
  }, [reset]);

  return {
    status,
    result,
    errorMessage,
    isTranscribing: status === 'transcribing' || status === 'loading_model',
    transcribe,
    reset,
    dispose,
  };
}

// For testing — inject mock service
export function __setSpeechToTextServiceForTests(service: SpeechToTextService | null): void {
  sharedService = service;
}
