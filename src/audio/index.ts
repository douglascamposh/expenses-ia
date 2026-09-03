import type { AudioCaptureEngine } from './types';

export * from './types';

export const MockAudioCaptureEngine: AudioCaptureEngine = {
  name: 'mock-audio',
  state: 'idle',
  async isAvailable() {
    return false;
  },
  async startRecording() {
    throw new Error('Audio capture not implemented — Feature 1 is architecture only.');
  },
  async stopRecording() {
    throw new Error('Audio capture not implemented — Feature 1 is architecture only.');
  },
  async cancelRecording() {
    throw new Error('Audio capture not implemented — Feature 1 is architecture only.');
  },
  async getMetrics() {
    return null;
  },
};
