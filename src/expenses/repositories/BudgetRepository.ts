import { getDatabase } from '@/database/sqlite';
import { isValidCategory, type ExpenseCategory } from '../categories/expenseCategories';
import { isValidCurrency, type Currency } from '../models/Expense';
import type { Budget, BudgetProgress, NewBudget } from '../models/Budget';

export interface BudgetRepository {
  upsert(budget: NewBudget): Promise<Budget>;
  getAll(): Promise<Budget[]>;
  getByCategory(category: string): Promise<Budget | null>;
  getProgress(fromDate: string): Promise<BudgetProgress[]>;
  delete(category: string): Promise<void>;
  clearAll(): Promise<void>;
}

function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    category: row.category as Budget['category'],
    amount: row.amount as number,
    currency: row.currency as Budget['currency'],
    updatedAt: row.updated_at as string,
  };
}

function validate(input: NewBudget): string | null {
  if (!input || typeof input !== 'object') return 'Presupuesto inválido';
  if (typeof input.amount !== 'number' || isNaN(input.amount) || !isFinite(input.amount)) return 'El monto debe ser un número válido';
  if (input.amount <= 0) return 'El monto debe ser mayor a 0';
  if (!input.currency || !isValidCurrency(String(input.currency))) return 'Moneda debe ser BOB, USD o EUR';
  if (!input.category || !isValidCategory(String(input.category))) return `Categoría inválida: ${input.category}`;
  return null;
}

export class SqliteBudgetRepository implements BudgetRepository {
  async upsert(budget: NewBudget): Promise<Budget> {
    const err = validate(budget);
    if (err) throw new Error(err);
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO budgets (category, amount, currency, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(category) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, updated_at = excluded.updated_at`,
      [String(budget.category), budget.amount, String(budget.currency), now],
    );
    return {
      category: budget.category as ExpenseCategory,
      amount: budget.amount,
      currency: budget.currency as Currency,
      updatedAt: now,
    };
  }

  async getAll(): Promise<Budget[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM budgets ORDER BY category ASC')) ?? [];
    return (rows ?? []).map(rowToBudget);
  }

  async getByCategory(category: string): Promise<Budget | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM budgets WHERE category = ?', [category]);
    return row ? rowToBudget(row) : null;
  }

  async getProgress(fromDate: string): Promise<BudgetProgress[]> {
    const budgets = await this.getAll();
    if (budgets.length === 0) return [];
    const db = await getDatabase();
    const out: BudgetProgress[] = [];
    for (const b of budgets.filter(Boolean)) {
      const row = await db.getFirstAsync<{ total: number | null }>(
        'SELECT SUM(amount) as total FROM expenses WHERE category = ? AND currency = ? AND date >= ?',
        [b.category, b.currency, fromDate],
      );
      const spent = row?.total ?? 0;
      const pct = b.amount > 0 ? spent / b.amount : 0;
      out.push({ category: b.category, currency: b.currency, limit: b.amount, spent, pct, over: pct > 1 });
    }
    return out;
  }

  async delete(category: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM budgets WHERE category = ?', [category]);
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM budgets');
  }
}

export const budgetRepository = new SqliteBudgetRepository();

// In-memory para tests
export class InMemoryBudgetRepository implements BudgetRepository {
  private store = new Map<string, Budget>();
  constructor(private expenseTotals?: (category: string, currency: string, from: string) => number) {}

  async upsert(budget: NewBudget): Promise<Budget> {
    const err = validate(budget);
    if (err) throw new Error(err);
    const b: Budget = {
      category: budget.category as ExpenseCategory,
      amount: budget.amount,
      currency: budget.currency as Currency,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(String(budget.category), { ...b });
    return b;
  }
  async getAll(): Promise<Budget[]> {
    return Array.from(this.store.values()).sort((a, b) => String(a.category).localeCompare(String(b.category)));
  }
  async getByCategory(category: string): Promise<Budget | null> {
    return this.store.get(category) ?? null;
  }
  async getProgress(fromDate: string): Promise<BudgetProgress[]> {
    const all = await this.getAll();
    return all.filter(Boolean).map((b) => {
      const spent = this.expenseTotals?.(String(b.category), String(b.currency), fromDate) ?? 0;
      const pct = b.amount > 0 ? spent / b.amount : 0;
      return { category: b.category, currency: b.currency, limit: b.amount, spent, pct, over: pct > 1 };
    });
  }
  async delete(category: string): Promise<void> {
    this.store.delete(category);
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}
