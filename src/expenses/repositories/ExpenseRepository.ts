import { getDatabase } from '@/database/sqlite';
import { isValidPaymentMethod, type Expense } from '../models/Expense';

export interface ExpenseRepository {
  create(expense: Expense): Promise<Expense>;
  getById(id: string): Promise<Expense | null>;
  getAll(): Promise<Expense[]>;
  getRecent(limit: number): Promise<Expense[]>;
  getByDateRange(from: string, to: string): Promise<Expense[]>;
  getCategorySummary(fromDate?: string): Promise<{ category: string; currency: string; total: number }[]>;
  delete(id: string): Promise<void>;
  update(id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<Expense | null>;
  clearAll(): Promise<void>;
}

export function rowToExpense(row: Record<string, unknown>): Expense {
  const rawMethod = row.payment_method as string | null | undefined;
  return {
    id: row.id as string,
    amount: row.amount as number,
    currency: row.currency as Expense['currency'],
    category: row.category as Expense['category'],
    description: row.description as string,
    date: row.date as string,
    paymentMethod: rawMethod && isValidPaymentMethod(rawMethod) ? rawMethod : 'CASH',
    confidence: (row.confidence as number | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SqliteExpenseRepository implements ExpenseRepository {
  async create(expense: Expense): Promise<Expense> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO expenses (id, amount, currency, category, description, date, payment_method, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expense.id, expense.amount, expense.currency, expense.category, expense.description, expense.date, expense.paymentMethod ?? 'CASH', expense.confidence ?? null, expense.createdAt, expense.updatedAt],
    );
    return expense;
  }

  async getById(id: string): Promise<Expense | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM expenses WHERE id = ?', [id]);
    return row ? rowToExpense(row) : null;
  }

  async getAll(): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM expenses ORDER BY date DESC, created_at DESC')) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getRecent(limit: number): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT ?', [limit])) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getByDateRange(from: string, to: string): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC', [from, to])) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getCategorySummary(fromDate?: string): Promise<{ category: string; currency: string; total: number }[]> {
    const db = await getDatabase();
    let sql = 'SELECT category, currency, SUM(amount) as total FROM expenses';
    const params: (string | number | null)[] = [];
    if (fromDate) {
      sql += ' WHERE date >= ?';
      params.push(fromDate);
    }
    sql += ' GROUP BY category, currency ORDER BY total DESC';
    // No pasar array vacío como bind-params: algunas versiones del puente
    // nativo lo propagan como null y rompen el binding.
    const rows = (
      await (params.length > 0
        ? db.getAllAsync<{ category: string; currency: string; total: number }>(sql, params)
        : db.getAllAsync<{ category: string; currency: string; total: number }>(sql))
    ) ?? [];
    return (rows ?? []).map((r) => ({ category: r.category, currency: r.currency, total: r.total }));
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  }

  async update(id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<Expense | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated: Expense = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    await db.runAsync(
      `UPDATE expenses SET amount = ?, currency = ?, category = ?, description = ?, date = ?, payment_method = ?, confidence = ?, updated_at = ? WHERE id = ?`,
      [updated.amount, updated.currency, updated.category, updated.description, updated.date, updated.paymentMethod ?? 'CASH', updated.confidence ?? null, updated.updatedAt, id],
    );
    return updated;
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expenses');
  }
}

export const expenseRepository = new SqliteExpenseRepository();

// In-memory para tests
export class InMemoryExpenseRepository implements ExpenseRepository {
  private store = new Map<string, Expense>();

  async create(expense: Expense): Promise<Expense> {
    this.store.set(expense.id, { ...expense });
    return expense;
  }
  async getById(id: string): Promise<Expense | null> {
    return this.store.get(id) ?? null;
  }
  async getAll(): Promise<Expense[]> {
    return Array.from(this.store.values()).sort((a, b) => (b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  }
  async getRecent(limit: number): Promise<Expense[]> {
    const all = await this.getAll();
    return all.slice(0, limit);
  }
  async getByDateRange(from: string, to: string): Promise<Expense[]> {
    const all = await this.getAll();
    return all.filter((e) => e.date >= from && e.date <= to);
  }
  async getCategorySummary(fromDate?: string): Promise<{ category: string; currency: string; total: number }[]> {
    const all = fromDate ? (await this.getAll()).filter((e) => e.date >= fromDate) : await this.getAll();
    const map = new Map<string, { category: string; currency: string; total: number }>();
    for (const e of all) {
      const key = `${e.category}|${e.currency}`;
      const prev = map.get(key);
      if (prev) prev.total += e.amount;
      else map.set(key, { category: e.category, currency: e.currency, total: e.amount });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
  async update(id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<Expense | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id, updatedAt: new Date().toISOString() } as Expense;
    this.store.set(id, updated);
    return updated;
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}
