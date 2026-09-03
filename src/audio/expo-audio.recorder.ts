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

export const EXPO_AUDIO_PRESET = RecordingPresets.HIGH_QUALITY;

/**
 * Compatible container/codec for iOS + Android, no native friction.
 * HIGH_QUALITY: .m4a, sampleRate 44100, channels 2, bitRate 128000,
 * android: outputFormat mpeg4 / audioEncoder aac,
 * ios: MPEG4AAC / AudioQuality MAX, 16-bit.
 * Whisper will later transcode to PCM 16kHz mono via native decoder.
 */
export const AUDIO_CONFIG = {
  container: 'm4a',
  extension: '.m4a',
  codec: 'aac',
  sampleRate: 44100,
  channels: 2 as const,
  bitDepth: 16,
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
