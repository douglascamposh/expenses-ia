import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import type { SpeechModelProvider } from '@/ai/types';
import { WHISPER_MODELS, WhisperModel } from '@/ai/types';

/**
 * ModelManager — resolves local whisper model path without network.
 * Strategy: bundled asset (require) → copy to documentDirectory/models on first launch.
 * Offline: never downloads, never fetches. Returns file:// path for native layer.
 */
export class WhisperModelManager implements SpeechModelProvider {
  private model: WhisperModel;
  private assetModule: number | null;

  constructor(model: WhisperModel = WhisperModel.TINY, assetModule: number | null = null) {
    this.model = model;
    this.assetModule = assetModule;
  }

  get selectedModel(): WhisperModel {
    return this.model;
  }

  setModel(model: WhisperModel): void {
    this.model = model;
  }

  async getModelInfo() {
    return WHISPER_MODELS[this.model];
  }

  /**
   * Returns absolute file path usable by NativeWhisperModule.
   * If model not yet copied to documentDirectory, copies from bundled asset.
   * Throws with user-friendly code if asset missing.
   */
  async getModelPath(): Promise<string> {
    const info = WHISPER_MODELS[this.model];
    const targetDir = `${FileSystem.documentDirectory}models`;
    const targetPath = `${targetDir}/${info.fileName}`;

    // Check if already copied
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists && fileInfo.size && fileInfo.size > 1024 * 1024) {
      return targetPath;
    }

    // Copy from bundled asset if available
    if (this.assetModule !== null) {
      const asset = Asset.fromModule(this.assetModule);
      await asset.downloadAsync();
      const localUri = asset.localUri ?? asset.uri;
      if (!localUri) {
        throw Object.assign(new Error('Whisper model not found'), { code: 'MODEL_NOT_FOUND' });
      }
      // asset.localUri may be file:// cache; copy to documentDirectory for stable path
      if (localUri !== targetPath) {
        await FileSystem.copyAsync({ from: localUri, to: targetPath });
      }
      return targetPath;
    }

    // No bundled asset provided — expect manual placement (POC)
    // Provide helpful error; caller will show "Whisper model not found"
    if (!fileInfo.exists) {
      throw Object.assign(new Error('Whisper model not found'), {
        code: 'MODEL_NOT_FOUND',
        modelName: info.displayName,
        expectedPath: targetPath,
      });
    }

    return targetPath;
  }

  async getModelSizeBytes(): Promise<number | undefined> {
    try {
      const path = await this.getModelPath();
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && 'size' in info && typeof (info as { size?: number }).size === 'number') {
        return (info as { size?: number }).size;
      }
      return WHISPER_MODELS[this.model].sizeBytes;
    } catch {
      return WHISPER_MODELS[this.model].sizeBytes;
    }
  }

  async isModelAvailable(): Promise<boolean> {
    try {
      const path = await this.getModelPath();
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }
}

// Default singleton for POC (tiny)
export const defaultModelManager = new WhisperModelManager(WhisperModel.TINY, null);
