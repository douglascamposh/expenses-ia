/**
 * Pure utilities — no React, no native, no IO.
 * Local-first: no network calls.
 */

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function isValidCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Guard that will never reach network. Useful to assert
 * offline contract at runtime without importing anything heavy.
 */
export function assertOfflineOnly(): void {
  // Intentionally empty — placeholder for future runtime checks.
  // No network validation needed for Feature 1.
}
