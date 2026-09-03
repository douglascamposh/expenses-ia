import * as FileSystem from 'expo-file-system/legacy';
import { WhisperModelManager } from '../ModelManager';
import { WhisperModel } from '@/ai/types';

describe('WhisperModelManager', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns existing path without copy', async () => {
    jest.spyOn(FileSystem, 'getInfoAsync')
      .mockResolvedValueOnce({ exists: true, uri: 'file:///documentDirectory/models' } as unknown as FileSystem.FileInfo)
      .mockResolvedValueOnce({ exists: true, size: 80 * 1024 * 1024, uri: 'file:///documentDirectory/models/ggml-tiny.bin' } as unknown as FileSystem.FileInfo);
    const mgr = new WhisperModelManager(WhisperModel.TINY, null);
    const path = await mgr.getModelPath();
    expect(path).toContain('ggml-tiny.bin');
  });

  it('throws MODEL_NOT_FOUND when not available and no asset', async () => {
    jest.spyOn(FileSystem, 'getInfoAsync')
      .mockResolvedValueOnce({ exists: true, uri: 'file:///documentDirectory/models' } as unknown as FileSystem.FileInfo)
      .mockResolvedValueOnce({ exists: false, uri: '' } as unknown as FileSystem.FileInfo);
    const mgr = new WhisperModelManager(WhisperModel.TINY, null);
    await expect(mgr.getModelPath()).rejects.toThrow(/Whisper model not found/);
  });

  it('getModelInfo returns TINY info', async () => {
    const mgr = new WhisperModelManager(WhisperModel.TINY, null);
    const info = await mgr.getModelInfo();
    expect(info.name).toBe(WhisperModel.TINY);
    expect(info.displayName).toBe('Tiny');
  });
});
