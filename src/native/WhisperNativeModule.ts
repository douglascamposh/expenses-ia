import { NativeModules, Platform } from 'react-native';

import type { WhisperNativeModule } from './types';

/**
 * JS wrapper around Expo native module `WhisperModule`.
 * - Prefers filePath API (zero-copy)
 * - Falls back to mock when not available (Expo Go, web, tests)
 * - Never performs network calls
 */

type ExpoWhisperModule = {
  loadModel(modelPath: string): Promise<{ sizeBytes?: number }>;
  transcribe(filePath: string, opts?: { language?: string; threads?: number; translate?: boolean }): Promise<{
    text: string;
    language?: string;
    segments?: { text: string; startMs: number; endMs: number }[];
  }>;
  unloadModel(): Promise<void>;
  getMemoryUsage?(): Promise<number | null>;
};

function getExpoWhisperModule(): ExpoWhisperModule | null {
  // Expo Modules API registers under NativeModules
  const mod = (NativeModules as Record<string, unknown>).WhisperModule as ExpoWhisperModule | undefined;
  if (mod && typeof mod.transcribe === 'function') return mod;
  // Alternative: expo-modules-core NativeModulesProxy
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const proxy = require('expo-modules-core').NativeModulesProxy as Record<string, unknown> | undefined;
    const p = proxy?.WhisperModule as ExpoWhisperModule | undefined;
    if (p && typeof p.transcribe === 'function') return p;
  } catch {}
  return null;
}

export function createWhisperNativeModule(): WhisperNativeModule {
  const expoMod = getExpoWhisperModule();

  if (expoMod) {
    return {
      moduleName: 'WhisperNativeModule',
      async getStatus() {
        return { name: 'WhisperNativeModule', status: 'available', version: 'whisper.cpp' };
      },
      async isAvailable() {
        return true;
      },
      async loadModel(modelPath: string) {
        return expoMod.loadModel(modelPath);
      },
      async transcribe(filePath: string, opts) {
        return expoMod.transcribe(filePath, opts);
      },
      async unloadModel() {
        return expoMod.unloadModel();
      },
      async getMemoryUsage() {
        if (expoMod.getMemoryUsage) return expoMod.getMemoryUsage();
        return null;
      },
    };
  }

  // Web / Expo Go / Jest fallback — unavailable but with clear error codes
  return {
    moduleName: 'WhisperNativeModule',
    async getStatus() {
      // In tests, we mock this; in production without native build, report unavailable
      const isWeb = Platform.OS === 'web';
      return {
        name: 'WhisperNativeModule',
        status: 'unavailable',
        errorMessage: isWeb
          ? 'Whisper not available on web — use physical device'
          : 'WhisperNativeModule not available — build with native modules (npx expo prebuild)',
      };
    },
    async isAvailable() {
      return false;
    },
    async loadModel() {
      throw Object.assign(new Error('Whisper model not found'), { code: 'MODEL_NOT_FOUND' });
    },
    async transcribe() {
      throw Object.assign(new Error('Speech recognition failed'), { code: 'NOT_AVAILABLE' });
    },
    async unloadModel() {
      // no-op
    },
    async getMemoryUsage() {
      return null;
    },
  };
}

export const WhisperNativeModuleInstance = createWhisperNativeModule();
