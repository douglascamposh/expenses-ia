import { getDatabase } from '@/database/sqlite';
import { isValidKind, isValidPaymentMethod, type EntryKind, type Expense } from '../models/Expense';

export interface ExpenseRepository {
  create(expense: Expense): Promise<Expense>;
  getById(id: string): Promise<Expense | null>;
  getAll(): Promise<Expense[]>;
  getRecent(limit: number): Promise<Expense[]>;
  getByDateRange(from: string, to: string): Promise<Expense[]>;
  /** Recientes del rango (mes en curso): solo kind dado, máx. limit, fecha DESC. */
  getByMonthRange(from: string, to: string, kind: EntryKind, limit: number): Promise<Expense[]>;
  getCategorySummary(fromDate?: string, kind?: EntryKind, toDate?: string): Promise<{ category: string; currency: string; total: number }[]>;
  /** Total de gastos por mes (YYYY-MM) y moneda en el rango: alimenta la tira de meses. */
  getMonthlyTotals(from: string, to: string): Promise<{ month: string; currency: string; total: number }[]>;
  /** Fecha ISO del gasto más antiguo (para acotar el selector de año). */
  getOldestDate(): Promise<string | null>;
  /** Cuántos gastos/ingresos usan una categoría (bloquea su borrado). */
  countByCategory(category: string): Promise<number>;
  delete(id: string): Promise<void>;
  update(id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<Expense | null>;
  clearAll(): Promise<void>;
}

export function rowToExpense(row: Record<string, unknown>): Expense {
  const rawMethod = row.payment_method as string | null | undefined;
  const rawKind = row.kind as string | null | undefined;
  return {
    id: row.id as string,
    amount: row.amount as number,
    currency: row.currency as Expense['currency'],
    category: row.category as Expense['category'],
    kind: rawKind && isValidKind(rawKind) ? rawKind : 'EXPENSE',
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
      `INSERT INTO expenses (id, amount, currency, category, kind, description, date, payment_method, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expense.id, expense.amount, expense.currency, expense.category, expense.kind ?? 'EXPENSE', expense.description, expense.date, expense.paymentMethod ?? 'CASH', expense.confidence ?? null, expense.createdAt, expense.updatedAt],
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

  async getByMonthRange(from: string, to: string, kind: EntryKind, limit: number): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM expenses WHERE date >= ? AND date <= ? AND kind = ? ORDER BY date DESC, created_at DESC LIMIT ?',
      [from, to, kind, limit],
    )) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getCategorySummary(fromDate?: string, kind: EntryKind = 'EXPENSE', toDate?: string): Promise<{ category: string; currency: string; total: number }[]> {
    const db = await getDatabase();
    let sql = 'SELECT category, currency, SUM(amount) as total FROM expenses WHERE kind = ?';
    const params: (string | number | null)[] = [kind];
    if (fromDate) {
      sql += ' AND date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND date <= ?';
      params.push(toDate);
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

  async getMonthlyTotals(from: string, to: string): Promise<{ month: string; currency: string; total: number }[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<{ month: string; currency: string; total: number }>(
      `SELECT substr(date, 1, 7) as month, currency, SUM(amount) as total FROM expenses
       WHERE kind = 'EXPENSE' AND date >= ? AND date <= ?
       GROUP BY month, currency ORDER BY month ASC`,
      [from, to],
    )) ?? [];
    return (rows ?? []).map((r) => ({ month: r.month, currency: r.currency, total: r.total }));
  }

  async getOldestDate(): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ d: string | null }>('SELECT MIN(date) as d FROM expenses');
    return row?.d ?? null;
  }

  async countByCategory(category: string): Promise<number> {
    const db = await getDatabase();
    const row = await db
      .getFirstAsync<{ n: number | null }>('SELECT COUNT(*) as n FROM expenses WHERE category = ?', [category])
      .catch(() => null);
    return row?.n ?? 0;
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
      `UPDATE expenses SET amount = ?, currency = ?, category = ?, kind = ?, description = ?, date = ?, payment_method = ?, confidence = ?, updated_at = ? WHERE id = ?`,
      [updated.amount, updated.currency, updated.category, updated.kind ?? 'EXPENSE', updated.description, updated.date, updated.paymentMethod ?? 'CASH', updated.confidence ?? null, updated.updatedAt, id],
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
  async getByMonthRange(from: string, to: string, kind: EntryKind, limit: number): Promise<Expense[]> {
    const all = await this.getAll();
    return all
      .filter((e) => e.date >= from && e.date <= to && (e.kind ?? 'EXPENSE') === kind)
      .slice(0, Math.max(limit, 0));
  }
  async getCategorySummary(fromDate?: string, kind: EntryKind = 'EXPENSE', toDate?: string): Promise<{ category: string; currency: string; total: number }[]> {
    const all = await this.getAll();
    const filtered = all.filter(
      (e) => (e.kind ?? 'EXPENSE') === kind && (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate),
    );
    const map = new Map<string, { category: string; currency: string; total: number }>();
    for (const e of filtered) {
      const key = `${e.category}|${e.currency}`;
      const prev = map.get(key);
      if (prev) prev.total += e.amount;
      else map.set(key, { category: e.category, currency: e.currency, total: e.amount });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }
  async getMonthlyTotals(from: string, to: string): Promise<{ month: string; currency: string; total: number }[]> {
    const all = await this.getAll();
    const map = new Map<string, { month: string; currency: string; total: number }>();
    for (const e of all) {
      if ((e.kind ?? 'EXPENSE') !== 'EXPENSE' || e.date < from || e.date > to) continue;
      const month = String(e.date).slice(0, 7);
      const key = `${month}|${e.currency}`;
      const prev = map.get(key);
      if (prev) prev.total += e.amount;
      else map.set(key, { month, currency: e.currency, total: e.amount });
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }
  async getOldestDate(): Promise<string | null> {
    const all = await this.getAll();
    let min: string | null = null;
    for (const e of all) {
      if (!e?.date) continue;
      if (min === null || e.date < min) min = e.date;
    }
    return min;
  }
  async countByCategory(category: string): Promise<number> {
    const all = await this.getAll();
    return all.filter((e) => e && String(e.category) === String(category)).length;
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
