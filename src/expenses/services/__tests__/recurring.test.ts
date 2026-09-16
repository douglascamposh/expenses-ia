import { generateDueRecurrences, generateForRule, MAX_CATCH_UP } from '../recurring';
import type { RecurringRule } from '../../models/Recurring';

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    description: 'Sueldo',
    amount: 1000,
    currency: 'BOB',
    category: 'SALARIO' as RecurringRule['category'],
    kind: 'INCOME',
    frequency: 'MONTHLY',
    day1: 5,
    day2: null,
    weekday: null,
    month: null,
    paymentMethod: 'CASH',
    startDate: '2026-01-05',
    endDate: null,
    active: true,
    lastGenerated: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateForRule', () => {
  it('mensual genera hasta hoy con tope y avanza lastGenerated', () => {
    const { occurrences, lastGenerated } = generateForRule(rule(), '2026-09-13');
    expect(occurrences.map((o) => o.date)).toEqual([
      '2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05',
      '2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05',
    ]);
    expect(occurrences.length).toBeLessThanOrEqual(MAX_CATCH_UP);
    expect(lastGenerated).toBe('2026-09-05');
    expect(occurrences[0].periodKey).toBe('r1:2026-01-05');
  });

  it('día 31 se ajusta a fin de mes (febrero 28)', () => {
    const { occurrences } = generateForRule(rule({ day1: 31, startDate: '2026-01-31' }), '2026-03-31');
    expect(occurrences.map((o) => o.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('continúa desde lastGenerated sin duplicar', () => {
    const first = generateForRule(rule(), '2026-09-13');
    const second = generateForRule(
      rule(),
      '2026-09-13',
      new Set(first.occurrences.map((o) => o.periodKey)),
    );
    expect(second.occurrences).toEqual([]);
    const resumed = generateForRule({ ...rule(), lastGenerated: first.lastGenerated }, '2026-10-13');
    expect(resumed.occurrences.map((o) => o.date)).toEqual(['2026-10-05']);
  });

  it('diaria genera cada día y respeta end', () => {
    const { occurrences } = generateForRule(
      rule({ frequency: 'DAILY', startDate: '2026-09-10', endDate: '2026-09-12' }),
      '2026-09-20',
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('semanal usa el weekday (lunes)', () => {
    const { occurrences } = generateForRule(
      rule({ frequency: 'WEEKLY', weekday: 1, startDate: '2026-09-07' }),
      '2026-09-20',
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-07', '2026-09-14']);
  });

  it('quincenal días 15 y 30', () => {
    const { occurrences } = generateForRule(
      rule({ frequency: 'BIWEEKLY', day1: 15, day2: 30, startDate: '2026-09-01' }),
      '2026-09-30',
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-15', '2026-09-30']);
  });

  it('bimensual y trimestral desde el mes de inicio', () => {
    const bi = generateForRule(
      rule({ frequency: 'BIMONTHLY', day1: 10, startDate: '2026-01-10' }),
      '2026-06-30',
    );
    expect(bi.occurrences.map((o) => o.date)).toEqual(['2026-01-10', '2026-03-10', '2026-05-10']);
    const tri = generateForRule(
      rule({ frequency: 'QUARTERLY', day1: 10, startDate: '2026-01-10' }),
      '2026-09-30',
    );
    expect(tri.occurrences.map((o) => o.date)).toEqual(['2026-01-10', '2026-04-10', '2026-07-10']);
  });

  it('anual respeta mes y día (29-feb → 28)', () => {
    const { occurrences } = generateForRule(
      rule({ frequency: 'ANNUAL', day1: 29, month: 2, startDate: '2024-02-29' }),
      '2026-03-01',
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
  });

  it('inactiva, ONCE o inicio futuro no generan', () => {
    expect(generateForRule(rule({ active: false }), '2026-09-13').occurrences).toEqual([]);
    expect(generateForRule(rule({ frequency: 'ONCE' }), '2026-09-13').occurrences).toEqual([]);
    expect(generateForRule(rule({ startDate: '2026-12-01' }), '2026-09-13').occurrences).toEqual([]);
  });

  it('tope de 12 atrasados', () => {
    const { occurrences } = generateForRule(rule({ frequency: 'DAILY', startDate: '2026-01-01' }), '2026-09-13');
    expect(occurrences).toHaveLength(MAX_CATCH_UP);
  });
});

describe('generateDueRecurrences', () => {
  it('ordena por fecha y omite inactivas', () => {
    const { occurrences, updates } = generateDueRecurrences(
      [
        rule({ id: 'a', frequency: 'MONTHLY', day1: 20, startDate: '2026-09-01' }),
        rule({ id: 'b', active: false, startDate: '2026-09-01' }),
        rule({ id: 'c', frequency: 'DAILY', startDate: '2026-09-12' }),
      ],
      '2026-09-20',
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-20']);
    expect(updates.map((u) => u.id).sort()).toEqual(['a', 'c']);
  });
});
