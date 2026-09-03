import { WhisperCppEngine } from '../WhisperCppEngine';
import type { WhisperNativeModule } from '@/native/types';
import { WhisperModel } from '@/ai/types';

function createMockNative(overrides: Partial<WhisperNativeModule> = {}): WhisperNativeModule {
  return {
    moduleName: 'WhisperNativeModule',
    getStatus: jest.fn(() => Promise.resolve({ name: 'WhisperNativeModule', status: 'available' as const })),
    isAvailable: jest.fn(() => Promise.resolve(true)),
    loadModel: jest.fn(() => Promise.resolve({ sizeBytes: 77 * 1024 * 1024 })),
    transcribe: jest.fn(() => Promise.resolve({ text: 'Hoy gasté treinta y cinco bolivianos en almuerzo.', language: 'es' })),
    unloadModel: jest.fn(() => Promise.resolve()),
    getMemoryUsage: jest.fn(() => Promise.resolve(120 * 1024 * 1024)),
    ...overrides,
  };
}

function createMockProvider() {
  return {
    getModelPath: jest.fn(() => Promise.resolve('file:///documentDirectory/models/ggml-tiny.bin')),
    getModelInfo: jest.fn(() => Promise.resolve({ name: WhisperModel.TINY, fileName: 'ggml-tiny.bin', displayName: 'Tiny', sizeBytes: 77 * 1024 * 1024, language: 'es' })),
  };
}

describe('WhisperCppEngine', () => {
  it('initializes and transcribes filePath', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);

    await engine.initialize({ modelPath: 'file:///documentDirectory/models/ggml-tiny.bin', language: 'es', translate: false, modelName: 'Tiny' });
    expect(engine.status).toBe('ready');

    const result = await engine.transcribe('file:///cache/test.m4a');
    expect(result.text).toContain('bolivianos');
    expect(result.language).toBe('es');
    expect(result.audioDurationMs).toBe(0);
    expect(result.transcriptionDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.modelName).toBe('Tiny');
    expect(result.modelSizeBytes).toBe(77 * 1024 * 1024);
    expect(native.transcribe).toHaveBeenCalledWith('file:///cache/test.m4a', expect.objectContaining({ language: 'es' }));
  });

  it('transcribes AudioInput with uri', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/models/ggml-tiny.bin', language: 'es', translate: false, modelName: 'Tiny' });

    const result = await engine.transcribe({ uri: 'file:///cache/test.m4a', format: 'm4a', sampleRate: 44100, channels: 2, durationMs: 3210 });
    expect(result.audioDurationMs).toBe(3210);
    expect(result.rtf).toBeDefined();
    expect(typeof result.rtf).toBe('number');
  });

  it('computes RTF correctly', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/models/ggml-tiny.bin', language: 'es', translate: false });

    const result = await engine.transcribe({ uri: 'file:///cache/a.m4a', format: 'm4a', sampleRate: 44100, channels: 2, durationMs: 5000 });
    // transcriptionDuration is ~0 in mock (instant), so RTF ~0
    expect(result.rtf).toBeCloseTo(result.transcriptionDurationMs / 5000);
  });

  it('rejects concurrent transcriptions', async () => {
    let resolveTranscribe: (v: { text: string }) => void = () => {};
    const native = createMockNative({
      transcribe: jest.fn(() => new Promise((res) => { resolveTranscribe = res as unknown as typeof resolveTranscribe; })),
    });
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/m.bin', language: 'es', translate: false });

    const p1 = engine.transcribe('file:///cache/a.m4a');
    await expect(engine.transcribe('file:///cache/b.m4a')).rejects.toThrow(/Speech recognition failed/);
    resolveTranscribe({ text: 'hola' });
    await p1;
  });

  it('handles model not found', async () => {
    const native = createMockNative({ loadModel: jest.fn(() => Promise.reject(Object.assign(new Error('not found'), { code: 'MODEL_NOT_FOUND' }))) });
    const engine = new WhisperCppEngine(native);
    await expect(engine.initialize({ modelPath: '', language: 'es', translate: false })).rejects.toThrow(/Whisper model not found/);
    expect(engine.status).toBe('error');
  });

  it('handles invalid audio (buffer)', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/m.bin', language: 'es', translate: false });
    await expect(engine.transcribe({ buffer: new Float32Array([0, 1]), format: 'pcm', sampleRate: 16000, channels: 1, durationMs: 1000 })).rejects.toThrow(/Audio format is not supported/);
  });

  it('handles empty uri', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/m.bin', language: 'es', translate: false });
    await expect(engine.transcribe({ uri: '', format: 'm4a', sampleRate: 44100, channels: 2, durationMs: 1000 })).rejects.toThrow(/Unable to process audio/);
  });

  it('lazy initializes via provider if not initialized', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    const result = await engine.transcribe('file:///cache/test.m4a');
    expect(native.loadModel).toHaveBeenCalled();
    expect(result.text).toBeTruthy();
  });

  it('dispose unloads model', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/m.bin', language: 'es', translate: false });
    await engine.dispose();
    expect(engine.status).toBe('not_loaded');
    expect(native.unloadModel).toHaveBeenCalled();
  });

  it('uses filePath — not Base64', async () => {
    const native = createMockNative();
    const provider = createMockProvider();
    const engine = new WhisperCppEngine(native, provider);
    await engine.initialize({ modelPath: 'file:///doc/m.bin', language: 'es', translate: false });
    await engine.transcribe('file:///cache/record.m4a');
    const arg = (native.transcribe as jest.Mock).mock.calls[0][0] as string;
    expect(arg).toBe('file:///cache/record.m4a');
    expect(arg).not.toContain('base64');
  });
});
