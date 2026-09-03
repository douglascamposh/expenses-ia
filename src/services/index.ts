import type { ExpenseCommand, ValidationResult } from '@/types';

import type { ExpenseCommandService, MetricsService } from './types';

export * from './types';

/**
 * Mock services — offline, no network, deterministic.
 * Used to verify architecture without bundling AI binaries.
 */

export const MockMetricsService: MetricsService = (() => {
  const store: Record<string, number> = {};
  return {
    recordLatency(stage: string, ms: number) {
      store[stage] = ms;
    },
    getMetrics() {
      return { ...store };
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
})();

export const MockExpenseCommandService: ExpenseCommandService = {
  parseAndValidate(rawJson: string): ValidationResult {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (typeof parsed !== 'object' || parsed === null || !('action' in (parsed as Record<string, unknown>))) {
        return { valid: false, errors: ['Missing "action" field in JSON command'] };
      }
      // Minimal validation — real validation will be stricter in later features.
      return {
        valid: true,
        errors: [],
        command: { ...(parsed as ExpenseCommand), rawText: rawJson },
      };
    } catch (e) {
      return {
        valid: false,
        errors: [(e as Error).message ?? 'Invalid JSON'],
      };
    }
  },

  validateCommand(command: ExpenseCommand): ValidationResult {
    const errors: string[] = [];
    if (!command.action) errors.push('action is required');
    if (command.amount !== undefined && typeof command.amount !== 'number') {
      errors.push('amount must be a number');
    }
    if (command.currency !== undefined && !/^[A-Z]{3}$/.test(command.currency)) {
      errors.push('currency must be 3-letter ISO code');
    }
    return {
      valid: errors.length === 0,
      errors,
      command: errors.length === 0 ? command : undefined,
    };
  },
};
