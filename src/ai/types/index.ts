import type { InferenceMetrics } from '@/types';

/**
 * AI layer — contracts only. No whisper.cpp / llama.cpp implementation in Feature 1.
 * Every interface is designed to be satisfied later by a native-backed engine
 * without changing UI or services.
 */

export type ModelStatus = 'not_loaded' | 'loading' | 'ready' | 'error' | 'not_implemented';

// ── Whisper model catalog (single source of truth) ──
export enum WhisperModel {
  TINY = 'tiny',
  BASE = 'base',
}

export type WhisperModelInfo = {
  name: WhisperModel;
  fileName: string; // e.g. ggml-tiny.bin
  displayName: string; // Tiny
  sizeBytes: number; // approximate bundled size
  language: string;
};

export const WHISPER_MODELS: Record<WhisperModel, WhisperModelInfo> = {
  [WhisperModel.TINY]: {
    name: WhisperModel.TINY,
    fileName: 'ggml-tiny.bin',
    displayName: 'Tiny',
    sizeBytes: 77 * 1024 * 1024,
    language: 'es',
  },
  [WhisperModel.BASE]: {
    name: WhisperModel.BASE,
    fileName: 'ggml-base.bin',
    displayName: 'Base',
    sizeBytes: 142 * 1024 * 1024,
    language: 'es',
  },
};

export type SpeechToTextConfig = {
  modelPath: string;
  language: string; // "es"
  threads?: number;
  translate?: boolean; // false => es -> es
  modelName?: string;
  model?: WhisperModel;
};

export type TranscriptionSegment = {
  text: string;
  startMs: number;
  endMs: number;
};

export type TranscriptionResult = {
  text: string;
  language?: string;
  confidence?: number;
  /** @deprecated use audioDurationMs */
  durationMs: number;
  audioDurationMs: number;
  transcriptionDurationMs: number;
  rtf?: number;
  modelSizeBytes?: number;
  modelName?: string;
  memoryUsageBytes?: number;
  segments?: TranscriptionSegment[];
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
  initialize(config: SpeechToTextConfig): Promise<void>;
  transcribe(audio: import('@/audio/types').AudioInput | string): Promise<TranscriptionResult>;
  dispose(): Promise<void>;
  /** @deprecated use initialize/dispose */
  loadModel?(): Promise<void>;
  unloadModel?(): Promise<void>;
}

export interface SpeechModelProvider {
  getModelPath(): Promise<string>;
  getModelInfo(): Promise<WhisperModelInfo>;
}

export type WhisperTranscriptionNativeResult = {
  text: string;
  language?: string;
  segments?: TranscriptionSegment[];
};

export interface LocalLLMEngine {
  readonly name: string;
  readonly status: ModelStatus;
  isAvailable(): Promise<boolean>;
  generate(prompt: string): Promise<LLMResult>;
  /** Structured JSON generation — future whisper->llm pipeline will call this. */
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
