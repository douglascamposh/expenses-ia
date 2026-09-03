import { computeRTF, formatRTF, normalizeAudioPath, WHISPER_AUDIO_SPEC } from '../AudioConverter';

describe('AudioConverter', () => {
  it('computeRTF correctly', () => {
    expect(computeRTF(2000, 5000)).toBeCloseTo(0.4);
    expect(computeRTF(0, 5000)).toBe(0);
    expect(computeRTF(1000, 0)).toBeUndefined();
    expect(computeRTF(1000, -100)).toBeUndefined();
  });

  it('formatRTF', () => {
    expect(formatRTF(0.4)).toBe('0.40x');
    expect(formatRTF(undefined)).toBe('—');
  });

  it('normalizeAudioPath keeps file://', () => {
    expect(normalizeAudioPath('file:///cache/test.m4a')).toBe('file:///cache/test.m4a');
  });

  it('normalizeAudioPath throws on invalid', () => {
    expect(() => normalizeAudioPath('')).toThrow(/Unable to process audio/);
    expect(() => normalizeAudioPath(null as unknown as string)).toThrow(/Unable to process audio/);
  });

  it('WHISPER_AUDIO_SPEC documents conversion', () => {
    expect(WHISPER_AUDIO_SPEC.inputFormat).toContain('m4a');
    expect(WHISPER_AUDIO_SPEC.outputFormat).toContain('16kHz');
    expect(WHISPER_AUDIO_SPEC.where).toContain('native');
  });
});
