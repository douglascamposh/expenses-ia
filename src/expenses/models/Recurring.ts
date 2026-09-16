import type { Currency, EntryKind, Frequency } from '../models/Expense';
import type { ExpenseCategory } from '../categories/expenseCategories';

export interface RecurringRule {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  kind: EntryKind;
  frequency: Frequency;
  /** Día del mes (mensual/bimensual/trimestral/anual) o primer día (quincenal). */
  day1: number;
  /** Segundo día del mes (solo quincenal). */
  day2: number | null;
  /** Día de semana 0-6 (solo semanal). */
  weekday: number | null;
  /** Mes 1-12 (solo anual). */
  month: number | null;
  paymentMethod: 'CASH' | 'CARD';
  startDate: string;
  endDate: string | null;
  active: boolean;
  /** Última fecha generada (YYYY-MM-DD) o null si nunca. */
  lastGenerated: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewRecurringRule = Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

/** Lo que el motor decide crear en una corrida. */
export interface DueOccurrence {
  ruleId: string;
  /** Clave idempotente ruleId + fecha. */
  periodKey: string;
  date: string;
}
