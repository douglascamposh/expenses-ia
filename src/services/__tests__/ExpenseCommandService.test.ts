import { MockExpenseCommandService, MockMetricsService } from '../index';

describe('MockExpenseCommandService', () => {
  it('parses valid JSON command', () => {
    const raw = JSON.stringify({
      action: 'add_expense',
      amount: 12.5,
      currency: 'EUR',
      rawText: 'test',
    });
    const result = MockExpenseCommandService.parseAndValidate(raw);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.command?.action).toBe('add_expense');
  });

  it('fails when action missing', () => {
    const raw = JSON.stringify({ amount: 10 });
    const result = MockExpenseCommandService.parseAndValidate(raw);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/action/);
  });

  it('fails on invalid JSON', () => {
    const result = MockExpenseCommandService.parseAndValidate('not-json');
    expect(result.valid).toBe(false);
  });

  it('validates currency code', () => {
    const result = MockExpenseCommandService.validateCommand({
      action: 'add_expense',
      amount: 10,
      currency: 'bad',
      rawText: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/currency/);
  });

  it('accepts valid command', () => {
    const result = MockExpenseCommandService.validateCommand({
      action: 'add_expense',
      amount: 10,
      currency: 'USD',
      rawText: 'test',
    });
    expect(result.valid).toBe(true);
  });
});

describe('MockMetricsService', () => {
  beforeEach(() => MockMetricsService.clear());

  it('records and retrieves latency', () => {
    MockMetricsService.recordLatency('whisper', 123);
    expect(MockMetricsService.getMetrics().whisper).toBe(123);
  });

  it('clears metrics', () => {
    MockMetricsService.recordLatency('llm', 456);
    MockMetricsService.clear();
    expect(Object.keys(MockMetricsService.getMetrics())).toHaveLength(0);
  });
});
