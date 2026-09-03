import { SpeechToTextService } from '../speech-to-text.service';
import type { SpeechToTextEngine } from '@/ai/types';

function mockEngine(overrides: Partial<SpeechToTextEngine> = {}): SpeechToTextEngine {
  return {
    name: 'whisper.cpp-tiny',
    status: 'ready',
    isAvailable: jest.fn(() => Promise.resolve(true)),
    initialize: jest.fn(() => Promise.resolve()),
    transcribe: jest.fn(() =>
      Promise.resolve({
        text: 'Compré gasolina por doscientos bolivianos.',
        language: 'es',
        durationMs: 3000,
        audioDurationMs: 3000,
        transcriptionDurationMs: 1200,
        rtf: 0.4,
        modelName: 'Tiny',
        modelSizeBytes: 77 * 1024 * 1024,
      }),
    ),
    dispose: jest.fn(() => Promise.resolve()),
    ...overrides,
  } as unknown as SpeechToTextEngine;
}

describe('SpeechToTextService', () => {
  it('transcribes filePath string', async () => {
    const engine = mockEngine();
    const svc = new SpeechToTextService(engine);
    const res = await svc.transcribe('file:///cache/test.m4a');
    expect(res.text).toContain('gasolina');
    expect(engine.transcribe).toHaveBeenCalled();
  });

  it('transcribes AudioRecordingResult (filePath)', async () => {
    const engine = mockEngine();
    const svc = new SpeechToTextService(engine);
    const res = await svc.transcribe({ filePath: 'file:///cache/test.m4a', uri: 'file:///cache/test.m4a', format: 'm4a', durationMs: 2500, mimeType: 'audio/m4a' } as unknown as string);
    expect(res.text).toBeTruthy();
  });

  it('lazy initializes if not ready', async () => {
    const engine = mockEngine({ status: 'not_loaded' as const });
    const svc = new SpeechToTextService(engine);
    await svc.transcribe('file:///cache/a.m4a');
    expect(engine.initialize).toHaveBeenCalled();
  });

  it('isReady checks engine', async () => {
    const engine = mockEngine();
    const svc = new SpeechToTextService(engine);
    expect(await svc.isReady()).toBe(true);
  });

  it('dispose', async () => {
    const engine = mockEngine();
    const svc = new SpeechToTextService(engine);
    await svc.dispose();
    expect(engine.dispose).toHaveBeenCalled();
  });
});
