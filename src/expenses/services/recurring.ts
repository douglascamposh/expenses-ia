import type { DueOccurrence, NewRecurringRule, RecurringRule } from '../models/Recurring';
import type { NewExpense } from '../models/Expense';

/** Tope de períodos atrasados por corrida (evita explosiones). */
export const MAX_CATCH_UP = 12;

/**
 * Mapea un borrador del formulario a input de regla.
 * La fecha del draft es el inicio; días derivados de ella.
 */
export function draftToRuleInput(draft: NewExpense): NewRecurringRule {
  const freq = draft.recurrence ?? 'ONCE';
  const day = new Date(`${draft.date}T00:00:00`);
  return {
    description: String(draft.description ?? '').trim(),
    amount: Number(draft.amount) || 0,
    currency: draft.currency,
    category: draft.category,
    kind: draft.kind ?? 'EXPENSE',
    paymentMethod: draft.paymentMethod ?? 'CASH',
    startDate: draft.date,
    endDate: null,
    active: true,
    lastGenerated: draft.date,
    frequency: freq,
    day1: day.getDate(),
    day2: freq === 'BIWEEKLY' ? ((day.getDate() + 13) % 28) + 1 : null,
    weekday: freq === 'WEEKLY' ? day.getDay() : null,
    month: freq === 'ANNUAL' ? day.getMonth() + 1 : null,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s: string) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const monthLen = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const clampDay = (y: number, m: number, day: number) => Math.min(Math.max(1, day), monthLen(y, m));
const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

function matches(rule: RecurringRule, d: Date, start: Date): boolean {
  const day = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (rule.frequency) {
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return d.getDay() === (rule.weekday ?? start.getDay());
    case 'BIWEEKLY': {
      const days = [rule.day1, rule.day2 ?? -1];
      return days.includes(day);
    }
    case 'MONTHLY':
      return day === clampDay(y, m, rule.day1);
    case 'BIMONTHLY':
      return monthsBetween(start, d) % 2 === 0 && day === clampDay(y, m, rule.day1);
    case 'QUARTERLY':
      return monthsBetween(start, d) % 3 === 0 && day === clampDay(y, m, rule.day1);
    case 'ANNUAL': {
      const month = (rule.month ?? start.getMonth() + 1) - 1;
      return m === month && day === clampDay(y, m, rule.day1);
    }
    default:
      return false;
  }
}

/**
 * Períodos vencidos de una regla hasta hoy (inclusive). Puro y determinista:
 * omite inactivas, ONCE, fuera de [start, end], ya generadas y más de 12.
 */
export function generateForRule(
  rule: RecurringRule,
  todayISO: string,
  existingKeys: Set<string> = new Set(),
): { occurrences: DueOccurrence[]; lastGenerated: string | null } {
  if (!rule || !rule.active || rule.frequency === 'ONCE') return { occurrences: [], lastGenerated: rule?.lastGenerated ?? null };
  const start = parseISO(rule.startDate);
  const today = parseISO(todayISO);
  if (isNaN(start.getTime()) || isNaN(today.getTime()) || start > today) {
    return { occurrences: [], lastGenerated: rule.lastGenerated ?? null };
  }
  const end = rule.endDate ? parseISO(rule.endDate) : null;
  const last = rule.lastGenerated ? parseISO(rule.lastGenerated) : null;
  let cursor = last && last >= start ? addDays(last, 1) : start;
  const limit = end && end < today ? end : today;

  const occurrences: DueOccurrence[] = [];
  let guard = 0;
  while (cursor <= limit && occurrences.length < MAX_CATCH_UP && guard < 5000) {
    guard += 1;
    const iso = toISO(cursor);
    const key = `${rule.id}:${iso}`;
    if (matches(rule, cursor, start) && !existingKeys.has(key)) {
      occurrences.push({ ruleId: rule.id, periodKey: key, date: iso });
    }
    cursor = addDays(cursor, 1);
  }
  const lastGenerated =
    occurrences.length > 0 ? occurrences[occurrences.length - 1].date : rule.lastGenerated ?? null;
  return { occurrences, lastGenerated };
}

/** Genera todas las reglas activas (ordena por fecha). */
export function generateDueRecurrences(
  rules: RecurringRule[],
  todayISO: string,
  existingKeys: Set<string> = new Set(),
): { occurrences: DueOccurrence[]; updates: { id: string; lastGenerated: string | null }[] } {
  const occurrences: DueOccurrence[] = [];
  const updates: { id: string; lastGenerated: string | null }[] = [];
  for (const rule of rules ?? []) {
    if (!rule || !rule.active) continue;
    const { occurrences: occ, lastGenerated } = generateForRule(rule, todayISO, existingKeys);
    if (occ.length > 0) {
      occurrences.push(...occ);
      updates.push({ id: rule.id, lastGenerated });
    }
  }
  occurrences.sort((a, b) => a.date.localeCompare(b.date));
  return { occurrences, updates };
}
