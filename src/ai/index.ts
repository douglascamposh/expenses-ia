import type { LocalLLMEngine, SpeechToTextEngine } from './types';

/**
 * AI barrel — re-exports types & engines.
 * Future engines (WhisperEngine, LlamaCppEngine) will live in
 * src/ai/engines/ and satisfy interfaces from ./types.
 */

export * from './types';
export { WhisperCppEngine } from './engines/WhisperCppEngine';
export { WhisperModelManager, defaultModelManager } from './model/ModelManager';

/**
 * Mock engines — used by LocalAITestScreen to demonstrate
 * that the architecture is ready without bundling native binaries.
 * Clearly marked as NOT_IMPLEMENTED for Feature 1.
 */

export const MockSpeechToTextEngine: SpeechToTextEngine = {
  name: 'mock-whisper',
  status: 'not_implemented',
  async isAvailable() {
    return false;
  },
  async initialize() {
    throw new Error('SpeechToText not implemented — Feature 1 is architecture only.');
  },
  async transcribe() {
    throw new Error('SpeechToText not implemented — Feature 1 is architecture only.');
  },
  async dispose() {
    // no-op
  },
};

export const MockLocalLLMEngine: LocalLLMEngine = {
  name: 'mock-llama',
  status: 'not_implemented',
  async isAvailable() {
    return false;
  },
  async generate() {
    throw new Error('Local LLM not implemented — Feature 1 is architecture only.');
  },
};

export const AI_PIPELINE_STATUS = {
  audio: 'not_implemented',
  whisper: 'not_implemented',
  llm: 'not_implemented',
  json: 'not_implemented',
  validation: 'not_implemented',
} as const;
