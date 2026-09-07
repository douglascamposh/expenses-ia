import type { LocalLLMEngine, SpeechToTextEngine } from './types';

/**
 * AI barrel — re-exports types & engines.
 * Mock engines — Feature 1 architecture only, sin whisper.cpp local.
 * Futura API usará backend cloud para STT.
 */

export * from './types';

/**
 * Mock engines — used by LocalAITestScreen to demonstrate
 * that the architecture is ready without bundling native binaries.
 * Clearly marked as NOT_IMPLEMENTED.
 */

export const MockSpeechToTextEngine: SpeechToTextEngine = {
  name: 'mock-whisper',
  status: 'not_implemented',
  async isAvailable() {
    return false;
  },
  async transcribe() {
    throw new Error('SpeechToText not implemented — se usará API cloud.');
  },
};

export const MockLocalLLMEngine: LocalLLMEngine = {
  name: 'mock-llama',
  status: 'not_implemented',
  async isAvailable() {
    return false;
  },
  async generate() {
    throw new Error('Local LLM not implemented — se usará API cloud.');
  },
};

export const AI_PIPELINE_STATUS = {
  audio: 'ready',
  whisper: 'not_implemented',
  llm: 'not_implemented',
  json: 'not_implemented',
  validation: 'not_implemented',
} as const;
