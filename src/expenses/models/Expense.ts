import type { ExpenseCategory } from '../categories/expenseCategories';

export type Currency = 'BOB' | 'USD' | 'EUR';

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  description: string;
  date: string; // YYYY-MM-DD ISO date
  confidence?: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// Para crear sin id/timestamps
export type NewExpense = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function isValidCurrency(c: string): c is Currency {
  return c === 'BOB' || c === 'USD' || c === 'EUR';
}
