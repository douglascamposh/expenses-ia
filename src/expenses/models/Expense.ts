import type { ExpenseCategory } from '../categories/expenseCategories';

export type Currency = 'BOB' | 'USD' | 'EUR' | 'ARS' | 'BRL' | 'CLP' | 'COP' | 'MXN' | 'PEN' | 'PYG' | 'UYU';

/** Monedas soportadas (selector + validación). */
export const SUPPORTED_CURRENCIES: readonly Currency[] = [
  'BOB', 'USD', 'EUR', 'ARS', 'BRL', 'CLP', 'COP', 'MXN', 'PEN', 'PYG', 'UYU',
];

export const DEFAULT_CURRENCY: Currency = 'BOB';

export type PaymentMethod = 'CASH' | 'CARD';

/** Frecuencia de repetición (formulario + reglas recurrentes). */
export type Frequency =
  | 'ONCE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'ANNUAL';

export function isValidFrequency(f: unknown): f is Frequency {
  return f === 'ONCE' || f === 'DAILY' || f === 'WEEKLY' || f === 'BIWEEKLY' ||
    f === 'MONTHLY' || f === 'BIMONTHLY' || f === 'QUARTERLY' || f === 'ANNUAL';
}

export type AppLang = 'es' | 'en';

/** Gasto o ingreso. Los ingresos no suman a presupuestos ni totales de gasto. */
export type EntryKind = 'EXPENSE' | 'INCOME';

export function isValidKind(k: unknown): k is EntryKind {
  return k === 'EXPENSE' || k === 'INCOME';
}

const PAYMENT_LABELS: Record<PaymentMethod, Record<AppLang, string>> = {
  CASH: { es: 'Efectivo', en: 'Cash' },
  CARD: { es: 'Tarjeta', en: 'Card' },
};

const PAYMENT_EMOJI: Record<PaymentMethod, string> = {
  CASH: '💵',
  CARD: '💳',
};

export function isValidPaymentMethod(m: string): m is PaymentMethod {
  return m === 'CASH' || m === 'CARD';
}

export function getPaymentLabel(method: PaymentMethod, lang: AppLang = 'es'): string {
  return PAYMENT_LABELS[method]?.[lang] ?? method;
}

export function getPaymentEmoji(method: PaymentMethod): string {
  return PAYMENT_EMOJI[method] ?? '💵';
}

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  kind: EntryKind;
  description: string;
  date: string; // YYYY-MM-DD ISO date
  paymentMethod: PaymentMethod;
  confidence?: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
  /** Id de la regla que lo generó (si es recurrente). */
  recurringId?: string | null;
}

// Para crear sin id/timestamps
export type NewExpense = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Solo formulario: si no es ONCE se crea regla recurrente al guardar. */
  recurrence?: Frequency;
};

export function isValidCurrency(c: string): c is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}
