import type { InferenceMetrics } from '@/types';

/**
 * AI layer — contracts only. No whisper.cpp / llama.cpp implementation.
 * Conservado para futura API (cloud) — por ahora solo grabación de audio.
 */

export type ModelStatus = 'not_loaded' | 'loading' | 'ready' | 'error' | 'not_implemented';

export type TranscriptionResult = {
  text: string;
  language?: string;
  confidence?: number;
  durationMs: number;
  metrics?: InferenceMetrics;
};

export type LLMResult = {
  text: string;
  rawResponse: string;
  parsedJson?: unknown;
  tokensGenerated?: number;
  metrics?: InferenceMetrics;
};

export type PromptTemplate = {
  id: string;
  template: string;
  variables: string[];
};

export interface SpeechToTextEngine {
  /** Human-readable engine id, e.g. "whisper.cpp-tiny" or "mock". */
  readonly name: string;
  readonly status: ModelStatus;
  isAvailable(): Promise<boolean>;
  transcribe(audio: import('@/audio/types').AudioInput): Promise<TranscriptionResult>;
  /** Optional: load model into memory (no-op for mock). */
  loadModel?(): Promise<void>;
  unloadModel?(): Promise<void>;
}

export interface LocalLLMEngine {
  readonly name: string;
  readonly status: ModelStatus;
  isAvailable(): Promise<boolean>;
  generate(prompt: string): Promise<LLMResult>;
  /** Structured JSON generation — future pipeline will call this. */
  generateCommand?(prompt: string): Promise<LLMResult>;
  loadModel?(): Promise<void>;
  unloadModel?(): Promise<void>;
}

export interface ExpenseCommandGenerator {
  fromTranscription(transcription: string): Promise<LLMResult>;
  fromPrompt(prompt: string): Promise<LLMResult>;
}

export type ValidationIssue = {
  path: string;
  message: string;
};

export interface CommandValidator {
  validate(raw: unknown): { valid: boolean; issues: ValidationIssue[]; command?: import('@/types').ExpenseCommand };
}
