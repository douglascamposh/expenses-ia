import { MockAudioNativeModule, MockLlamaNativeModule, MockWhisperNativeModule, getAllNativeModuleStatus } from '../index';

describe('Native mock modules', () => {
  it('Whisper module reports not_implemented', async () => {
    const status = await MockWhisperNativeModule.getStatus();
    expect(status.status).toBe('not_implemented');
    expect(status.name).toBe('WhisperNativeModule');
  });

  it('Llama module reports not_implemented', async () => {
    const status = await MockLlamaNativeModule.getStatus();
    expect(status.status).toBe('not_implemented');
  });

  it('Audio module reports not_implemented', async () => {
    const status = await MockAudioNativeModule.getStatus();
    expect(status.status).toBe('not_implemented');
  });

  it('getAllNativeModuleStatus returns 3 entries', async () => {
    const all = await getAllNativeModuleStatus();
    expect(all).toHaveLength(3);
    for (const m of all) {
      expect(m.status).toBe('not_implemented');
    }
  });

  it('isAvailable returns false for all mocks', async () => {
    expect(await MockWhisperNativeModule.isAvailable()).toBe(false);
    expect(await MockLlamaNativeModule.isAvailable()).toBe(false);
    expect(await MockAudioNativeModule.isAvailable()).toBe(false);
  });
});
