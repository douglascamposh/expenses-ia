/**
 * Audio layer — contracts for microphone / PCM / WAV handling.
 * Feature 2 adds AudioRecorder abstraction over expo-audio.
 */

export type AudioFormat = 'pcm' | 'wav' | 'm4a' | 'mp3';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export type AudioInput = {
  /** File URI if persisted locally (expo FileSystem), otherwise undefined for in-memory. */
  uri?: string;
  /** Raw PCM buffer — optional because native layer may pass URI only. */
  buffer?: Float32Array;
  sampleRate: number;
  channels: number;
  durationMs: number;
  format: AudioFormat;
};

export type AudioMetrics = {
  durationMs: number;
  sampleRate: number;
  channels: number;
  rmsLevel?: number;
  peakLevel?: number;
};

export type AudioCaptureOptions = {
  sampleRate?: number;
  channels?: 1 | 2;
  format?: AudioFormat;
  maxDurationMs?: number;
};

export interface AudioCaptureEngine {
  readonly name: string;
  readonly state: RecordingState;
  isAvailable(): Promise<boolean>;
  startRecording(options?: AudioCaptureOptions): Promise<void>;
  stopRecording(): Promise<AudioInput>;
  cancelRecording(): Promise<void>;
  getMetrics(): Promise<AudioMetrics | null>;
}

export type AudioPreprocessingOptions = {
  normalize?: boolean;
  trimSilence?: boolean;
  targetSampleRate?: number;
};

export interface AudioPreprocessor {
  process(input: AudioInput, options?: AudioPreprocessingOptions): Promise<AudioInput>;
}

// ── Feature 2: Audio Recording abstraction ──

export type AudioRecordingState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'processing'
  | 'error';

export type AudioPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'blocked';

export type AudioRecordingResult = {
  /** Absolute file path / uri (e.g. file:///…/cache/… .m4a) — ready for SpeechToTextService. */
  filePath: string;
  uri: string;
  format: AudioFormat;
  mimeType?: string;
  durationMs: number;
  sampleRate?: number;
  channels?: number;
  sizeBytes?: number;
};

export interface AudioRecorder {
  requestPermission(): Promise<boolean>;
  getPermissionStatus(): Promise<AudioPermissionStatus>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<AudioRecordingResult>;
  cancelRecording(): Promise<void>;
  getState(): AudioRecordingState;
  getDurationMs(): number;
}
