/**
 * Global shared types — domain-agnostic.
 * Kept intentionally small for Feature 1. Extend without breaking
 * the offline-first / local-only contract.
 */

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not_implemented';

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type InferenceMetrics = {
  latencyMs: number;
  modelLoadMs?: number;
  tokensPerSecond?: number;
  memoryUsageMb?: number;
};

export type PipelineStage =
  | 'audio'
  | 'whisper'
  | 'llm'
  | 'json'
  | 'validation';

export type PipelineStageStatus = {
  stage: PipelineStage;
  status: AsyncStatus;
  message: string;
};

export type RuntimeMode = 'offline' | 'online';

export type ExpenseCommandType = 'add_expense' | 'update_expense' | 'delete_expense' | 'query_expenses';

/**
 * Canonical structured output produced by Local LLM.
 * Validation of this shape occurs in services layer, not UI.
 */
export type ExpenseCommand = {
  action: ExpenseCommandType;
  amount?: number;
  currency?: string;
  category?: string;
  description?: string;
  date?: string;
  /** Raw LLM text before JSON parsing, useful for debugging offline. */
  rawText: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  command?: ExpenseCommand;
};
