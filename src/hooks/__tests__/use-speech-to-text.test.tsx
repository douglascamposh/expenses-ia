import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSpeechToText, __setSpeechToTextServiceForTests } from '../use-speech-to-text';
import { SpeechToTextService } from '@/services/speech-to-text.service';

function createMockService(overrides: Partial<SpeechToTextService> = {}) {
  const svc = {
    status: 'ready' as const,
    engineName: 'whisper.cpp-tiny',
    isReady: jest.fn(() => Promise.resolve(true)),
    initialize: jest.fn(() => Promise.resolve()),
    transcribe: jest.fn(() =>
      Promise.resolve({
        text: 'Hoy gasté treinta y cinco bolivianos en almuerzo.',
        language: 'es',
        durationMs: 3000,
        audioDurationMs: 3000,
        transcriptionDurationMs: 1200,
        rtf: 0.4,
        modelName: 'Tiny',
        modelSizeBytes: 77 * 1024 * 1024,
        memoryUsageBytes: 120 * 1024 * 1024,
      }),
    ),
    dispose: jest.fn(() => Promise.resolve()),
    ...overrides,
  } as unknown as SpeechToTextService;
  return svc;
}

describe('useSpeechToText', () => {
  afterEach(() => {
    __setSpeechToTextServiceForTests(null);
    jest.clearAllMocks();
  });

  it('initial status idle', () => {
    const svc = createMockService();
    __setSpeechToTextServiceForTests(svc);
    const { result } = renderHook(() => useSpeechToText());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  it('transcribes and sets complete', async () => {
    const svc = createMockService();
    __setSpeechToTextServiceForTests(svc);
    const { result } = renderHook(() => useSpeechToText());

    await act(async () => {
      await result.current.transcribe({ filePath: 'file:///cache/test.m4a', uri: 'file:///cache/test.m4a', format: 'm4a', durationMs: 3000 } as unknown as string);
    });

    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(result.current.result?.text).toContain('bolivianos');
    expect(result.current.result?.rtf).toBeDefined();
    expect(svc.transcribe).toHaveBeenCalled();
  });

  it('handles model not found error', async () => {
    const svc = createMockService({
      status: 'not_loaded' as const,
      initialize: jest.fn(() => Promise.reject(Object.assign(new Error('Whisper model not found'), { code: 'MODEL_NOT_FOUND' }))),
    } as unknown as Partial<SpeechToTextService>);
    __setSpeechToTextServiceForTests(svc);
    const { result } = renderHook(() => useSpeechToText());

    await act(async () => {
      await result.current.transcribe('file:///cache/test.m4a');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/Whisper model not found/);
  });

  it('prevents concurrent transcriptions', async () => {
    let resolve: (v: unknown) => void = () => {};
    const svc = createMockService({
      transcribe: jest.fn(() => new Promise((res) => { resolve = res; })),
    } as unknown as Partial<SpeechToTextService>);
    __setSpeechToTextServiceForTests(svc);
    const { result } = renderHook(() => useSpeechToText());

    // start first without awaiting
    act(() => {
      void result.current.transcribe('file:///cache/a.m4a');
    });

    // second should be blocked (hook guards with ref)
    let secondResult: unknown = 'pending';
    await act(async () => {
      secondResult = await result.current.transcribe('file:///cache/b.m4a');
    });
    expect(secondResult).toBeNull();

    // cleanup first
    await act(async () => {
      resolve({
        text: 'hola',
        language: 'es',
        durationMs: 1000,
        audioDurationMs: 1000,
        transcriptionDurationMs: 500,
        rtf: 0.5,
      });
    });
  });

  it('reset clears state', async () => {
    const svc = createMockService();
    __setSpeechToTextServiceForTests(svc);
    const { result } = renderHook(() => useSpeechToText());

    await act(async () => {
      await result.current.transcribe('file:///cache/test.m4a');
    });
    expect(result.current.status).toBe('complete');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });
});
