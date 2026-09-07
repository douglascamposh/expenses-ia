import { AI_PIPELINE_STATUS, MockLocalLLMEngine, MockSpeechToTextEngine } from '../index';

describe('AI mock engines', () => {
  it('MockSpeechToTextEngine is not_implemented', () => {
    expect(MockSpeechToTextEngine.status).toBe('not_implemented');
    expect(MockSpeechToTextEngine.name).toBe('mock-whisper');
  });

  it('MockLocalLLMEngine is not_implemented', () => {
    expect(MockLocalLLMEngine.status).toBe('not_implemented');
    expect(MockLocalLLMEngine.name).toBe('mock-llama');
  });

  it('transcribe throws not implemented', async () => {
    await expect(
      MockSpeechToTextEngine.transcribe({
        sampleRate: 16000,
        channels: 1,
        durationMs: 1000,
        format: 'pcm',
      }),
    ).rejects.toThrow(/not implemented/i);
  });

  it('generate throws not implemented', async () => {
    await expect(MockLocalLLMEngine.generate('hello')).rejects.toThrow(/not implemented/i);
  });

  it('AI_PIPELINE_STATUS contains expected stages', () => {
    expect(AI_PIPELINE_STATUS.audio).toBe('ready');
    expect(AI_PIPELINE_STATUS.whisper).toBe('not_implemented');
    expect(AI_PIPELINE_STATUS.llm).toBe('not_implemented');
    expect(AI_PIPELINE_STATUS.json).toBe('not_implemented');
    expect(AI_PIPELINE_STATUS.validation).toBe('not_implemented');
  });
});
