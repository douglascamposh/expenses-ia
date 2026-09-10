import type { Currency } from './Expense';
import type { ExpenseCategory } from '../categories/expenseCategories';

export interface Budget {
  category: ExpenseCategory;
  amount: number;
  currency: Currency;
  updatedAt: string; // ISO 8601
}

export type NewBudget = Pick<Budget, 'category' | 'amount' | 'currency'>;

/** Progreso del mes en curso para un presupuesto. */
export interface BudgetProgress {
  category: ExpenseCategory;
  currency: Currency;
  limit: number;
  spent: number;
  /** 0..1+ (puede superar 1 cuando hay sobregiro) */
  pct: number;
  over: boolean;
}
