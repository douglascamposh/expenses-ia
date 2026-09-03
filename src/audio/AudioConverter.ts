/**
 * AudioConverter — documents and isolates audio conversion for whisper.cpp
 *
 * Input:  m4a (AAC) 44.1kHz stereo from expo-audio (HIGH_QUALITY)
 * Output: PCM Float32 16kHz mono required by whisper.cpp
 *
 * JS layer does NOT convert. Native layer (MediaCodec / AVAudioConverter)
 * performs decoding+resampling via filePath to avoid Base64/buffer copies.
 *
 * This module is a TypeScript marker + helpers for metrics/logging.
 */

export type AudioConversionSpec = {
  inputFormat: string; // "m4a/aac 44.1kHz stereo"
  outputFormat: string; // "pcm float32 16kHz mono"
  where: string; // "native: MediaExtractor+MediaCodec (Android) / AVAudioConverter (iOS)"
  why: string;
};

export const WHISPER_AUDIO_SPEC: AudioConversionSpec = {
  inputFormat: 'm4a (AAC) 44.1kHz stereo — expo-audio HIGH_QUALITY',
  outputFormat: 'PCM Float32 16kHz mono — whisper.cpp',
  where: 'native layer: filePath → decoder → resampler → whisper.cpp (no JS Base64)',
  why: 'whisper.cpp expects 16kHz mono PCM; avoids large buffer copies across JS bridge',
};

/**
 * Normalize filePath for native JNI consumption.
 * Expo URIs are file://, but native expects absolute path.
 * This helper strips scheme and validates presence.
 */
export function normalizeAudioPath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw Object.assign(new Error('Unable to process audio'), { code: 'INVALID_AUDIO' });
  }
  // Keep file:// for expo-file-system compat, but also provide stripped variant for native
  return filePath;
}

export function stripFileScheme(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

/**
 * RTF = transcriptionDuration / audioDuration
 * <1 means faster than realtime, >1 slower.
 */
export function computeRTF(transcriptionDurationMs: number, audioDurationMs: number): number | undefined {
  if (!audioDurationMs || audioDurationMs <= 0) return undefined;
  return transcriptionDurationMs / audioDurationMs;
}

export function formatRTF(rtf: number | undefined): string {
  if (rtf === undefined) return '—';
  return `${rtf.toFixed(2)}x`;
}
