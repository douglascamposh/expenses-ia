import { useCallback, useState } from 'react';
import { useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import {
  AUDIO_CONFIG,
  EXPO_AUDIO_PRESET,
  getRecordingPermissionStatus,
  prepareAudioModeForRecording,
  requestRecordingPermission,
  resetAudioModeAfterRecording,
} from '@/audio/expo-audio.recorder';
import type { AudioRecordingResult, AudioRecordingState } from '@/audio/types';

type UseAudioRecordingReturn = {
  state: AudioRecordingState;
  permissionStatus: string;
  errorMessage: string | null;
  result: AudioRecordingResult | null;
  durationMs: number;
  isRecording: boolean;
  requestPermission: () => Promise<boolean>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<AudioRecordingResult | null>;
  cancelRecording: () => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
};

export function useAudioRecording(): UseAudioRecordingReturn {
  const recorder = useAudioRecorder(EXPO_AUDIO_PRESET);
  const recorderState = useAudioRecorderState(recorder, 200);

  const [state, setState] = useState<AudioRecordingState>('idle');
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AudioRecordingResult | null>(null);

  const durationMs = recorderState.durationMillis ?? Math.round(recorder.currentTime * 1000);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setState('requesting_permission');
    setErrorMessage(null);
    try {
      const status = await getRecordingPermissionStatus();
      setPermissionStatus(status);
      if (status === 'granted') {
        setState('idle');
        return true;
      }
      const granted = await requestRecordingPermission();
      const newStatus = await getRecordingPermissionStatus();
      setPermissionStatus(newStatus);
      if (!granted) {
        setState('error');
        setErrorMessage('Microphone permission required');
        return false;
      }
      setState('idle');
      return true;
    } catch (e) {
      setState('error');
      setErrorMessage((e as Error).message ?? 'Unable to request microphone permission');
      return false;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    setResult(null);
    setState('requesting_permission');
    try {
      const permStatus = await getRecordingPermissionStatus();
      setPermissionStatus(permStatus);
      let granted = permStatus === 'granted';
      if (!granted) {
        granted = await requestRecordingPermission();
        const updated = await getRecordingPermissionStatus();
        setPermissionStatus(updated);
      }
      if (!granted) {
        setState('error');
        setErrorMessage('Microphone permission required');
        return;
      }

      await prepareAudioModeForRecording();
      await recorder.prepareToRecordAsync(EXPO_AUDIO_PRESET);
      recorder.record();
      setState('recording');
    } catch (e) {
      setState('error');
      setErrorMessage((e as Error).message ?? 'Unable to start recording');
      try {
        await resetAudioModeAfterRecording();
      } catch {}
    }
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<AudioRecordingResult | null> => {
    if (state !== 'recording') {
      return null;
    }
    setState('processing');
    setErrorMessage(null);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Unable to access recorded audio');
      }
      const duration = durationMs;
      const res: AudioRecordingResult = {
        filePath: uri,
        uri,
        format: 'm4a',
        mimeType: AUDIO_CONFIG.mimeType,
        durationMs: duration,
        sampleRate: AUDIO_CONFIG.sampleRate,
        channels: AUDIO_CONFIG.channels,
      };
      setResult(res);
      setState('idle');
      await resetAudioModeAfterRecording();
      return res;
    } catch (e) {
      setState('error');
      setErrorMessage((e as Error).message ?? 'Unable to save recording');
      try {
        await resetAudioModeAfterRecording();
      } catch {}
      return null;
    }
  }, [recorder, state, durationMs]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch {}
    setResult(null);
    setErrorMessage(null);
    setState('idle');
    try {
      await resetAudioModeAfterRecording();
    } catch {}
  }, [recorder]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    if (state === 'error') setState('idle');
  }, [state]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    state,
    permissionStatus,
    errorMessage,
    result,
    durationMs,
    isRecording: recorderState.isRecording ?? recorder.isRecording,
    requestPermission,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
    clearResult,
  };
}
