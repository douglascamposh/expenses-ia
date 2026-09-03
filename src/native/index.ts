import type { AudioNativeModule, LlamaNativeModule, NativeModuleInfo, WhisperNativeModule } from './types';

export * from './types';

/**
 * Native layer registry — single place to query availability.
 * Feature 1 returns "not_implemented" for every module.
 * Future: replace with Expo Modules / TurboModules implementations.
 */

function notImplementedInfo(name: string): NativeModuleInfo {
  return {
    name,
    status: 'not_implemented',
    errorMessage: `${name} not implemented — Feature 1 is architecture only. Native C++ binding will be added in a later feature.`,
  };
}

export const MockWhisperNativeModule: WhisperNativeModule = {
  moduleName: 'WhisperNativeModule',
  async getStatus() {
    return notImplementedInfo('WhisperNativeModule');
  },
  async isAvailable() {
    return false;
  },
  async transcribe() {
    throw new Error('WhisperNativeModule not implemented.');
  },
  async loadModel() {
    throw new Error('WhisperNativeModule not implemented.');
  },
  async unloadModel() {
    throw new Error('WhisperNativeModule not implemented.');
  },
};

export const MockLlamaNativeModule: LlamaNativeModule = {
  moduleName: 'LlamaNativeModule',
  async getStatus() {
    return notImplementedInfo('LlamaNativeModule');
  },
  async isAvailable() {
    return false;
  },
  async generate() {
    throw new Error('LlamaNativeModule not implemented.');
  },
  async loadModel() {
    throw new Error('LlamaNativeModule not implemented.');
  },
  async unloadModel() {
    throw new Error('LlamaNativeModule not implemented.');
  },
};

export const MockAudioNativeModule: AudioNativeModule = {
  moduleName: 'AudioNativeModule',
  async getStatus() {
    return notImplementedInfo('AudioNativeModule');
  },
  async isAvailable() {
    return false;
  },
  async startRecording() {
    throw new Error('AudioNativeModule not implemented.');
  },
  async stopRecording() {
    throw new Error('AudioNativeModule not implemented.');
  },
  async getPermissionsStatus() {
    return 'undetermined';
  },
  async requestPermissions() {
    return 'denied';
  },
};

export const NativeRegistry = {
  whisper: MockWhisperNativeModule,
  llama: MockLlamaNativeModule,
  audio: MockAudioNativeModule,
} as const;

export async function getAllNativeModuleStatus(): Promise<NativeModuleInfo[]> {
  const entries = Object.values(NativeRegistry) as { getStatus(): Promise<NativeModuleInfo> }[];
  return Promise.all(entries.map((m) => m.getStatus()));
}
