/**
 * ExpoAudio wrapper — isolates expo-audio specifics from UI/services.
 * Re-exports helpers used by AudioRecordingService hook.
 * No cloud, offline only.
 */
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';

import type { AudioPermissionStatus } from './types';

/**
 * HIGH_QUALITY optimizado para API cloud (Gemini):
 * - Mantiene 44.1kHz/128kbps/AAC MAX para máxima inteligibilidad de voz y números
 * - Cambia a MONO (1 canal) para voz: reduce 50% tamaño sin pérdida, Gemini transcribe números mejor en mono
 * - Misma compatibilidad iOS (MPEG4AAC/MAX) y Android (MPEG4/AAC), solo cambia numberOfChannels
 * Resultado: ~80KB por 10s vs ~160KB stereo, misma claridad.
 */
export const EXPO_AUDIO_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
} as const;

export const AUDIO_CONFIG = {
  container: 'm4a',
  extension: '.m4a',
  codec: 'aac',
  sampleRate: 44100,
  channels: 1 as const,
  bitDepth: 16,
  bitRate: 128000,
  mimeType: 'audio/m4a',
} as const;

export async function requestRecordingPermission(): Promise<boolean> {
  const result = await AudioModule.requestRecordingPermissionsAsync();
  return result.granted;
}

export async function getRecordingPermissionStatus(): Promise<AudioPermissionStatus> {
  const result = await AudioModule.getRecordingPermissionsAsync();
  if (result.granted) return 'granted';
  if (result.status === 'denied' && !result.canAskAgain) return 'blocked';
  if (result.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function prepareAudioModeForRecording(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
}

export async function resetAudioModeAfterRecording(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: false,
  });
}

export { AudioModule, RecordingPresets, setAudioModeAsync };
