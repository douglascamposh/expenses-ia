import type { LLMResult, TranscriptionResult } from '@/ai/types';
import type { AudioInput } from '@/audio/types';
import type { ExpenseCommand, ValidationResult } from '@/types';

/**
 * Services — application logic that does not belong in React components.
 * All services must remain offline; no fetch / Supabase / Firebase.
 */

export interface SpeechToTextService {
  transcribe(audio: AudioInput | string | import('@/audio/types').AudioRecordingResult): Promise<TranscriptionResult>;
  isReady(): Promise<boolean>;
  initialize?(model?: import('@/ai/types').WhisperModel, modelPath?: string): Promise<void>;
  dispose?(): Promise<void>;
}

export interface LocalLLMService {
  generate(prompt: string): Promise<LLMResult>;
  generateExpenseCommand(transcription: string): Promise<LLMResult>;
  isReady(): Promise<boolean>;
}

export interface ExpenseCommandService {
  /**
   * Full pipeline stub: audio -> transcription -> LLM -> JSON -> validation
   * Feature 1 returns ValidationResult with not_implemented status.
   */
  processAudio?(audio: AudioInput): Promise<ValidationResult>;
  parseAndValidate(rawJson: string): ValidationResult;
  validateCommand(command: ExpenseCommand): ValidationResult;
}

export interface MetricsService {
  recordLatency(stage: string, ms: number): void;
  getMetrics(): Readonly<Record<string, number>>;
  clear(): void;
}

export type ServiceStatus = 'ready' | 'not_implemented' | 'error';
