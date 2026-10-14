import { getDatabase } from '@/database/sqlite';
import { isValidKind, isValidPaymentMethod, type EntryKind, type Expense } from '../models/Expense';

export interface ExpenseRepository {
  create(expense: Expense): Promise<Expense>;
  getById(id: string): Promise<Expense | null>;
  getAll(): Promise<Expense[]>;
  getRecent(limit: number): Promise<Expense[]>;
  getByDateRange(from: string, to: string): Promise<Expense[]>;
  /** Recientes del rango (mes en curso): solo kind dado, página limit/offset, fecha DESC. */
  getByMonthRange(from: string, to: string, kind: EntryKind, limit: number, offset?: number): Promise<Expense[]>;
  /** Total de movimientos del rango por kind (para "Mostrando X de Y" en scroll infinito). */
  countByMonthRange(from: string, to: string, kind: EntryKind): Promise<number>;
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
  // ---- Sync con la nube (borrado lógico + cola de pendientes) ----
  /** Pendientes de subir (upserts): no borrados con sync_status='pending'. */
  getPendingUpserts(): Promise<Expense[]>;
  /** Pendientes de subir (borrados): {id, updatedAt} con is_deleted=1. */
  getPendingDeletes(): Promise<{ id: string; updatedAt: string }[]>;
  /** Marca filas como ya subidas. */
  markSynced(ids: string[]): Promise<void>;
  /** Borrado lógico: is_deleted=1, updatedAt=ahora, sync_status='pending'. */
  softDelete(id: string): Promise<void>;
  /** Inserta o reemplaza desde la nube (entra como 'synced'). */
  upsertFromCloud(expense: Expense, deleted: boolean): Promise<void>;
  /** Purga física de tombstones anteriores a beforeISO. Retorna cuántas. */
  gcTombstones(beforeISO: string): Promise<number>;
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
    recurringId: (row.recurring_id as string | null | undefined) ?? null,
  };
}

export class SqliteExpenseRepository implements ExpenseRepository {
  async create(expense: Expense): Promise<Expense> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO expenses (id, amount, currency, category, kind, description, date, payment_method, confidence, created_at, updated_at, recurring_id, sync_status, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [expense.id, expense.amount, expense.currency, expense.category, expense.kind ?? 'EXPENSE', expense.description, expense.date, expense.paymentMethod ?? 'CASH', expense.confidence ?? null, expense.createdAt, expense.updatedAt, expense.recurringId ?? null],
    );
    return expense;
  }

  async getById(id: string): Promise<Expense | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM expenses WHERE id = ? AND is_deleted = 0', [id]);
    return row ? rowToExpense(row) : null;
  }

  async getAll(): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM expenses WHERE is_deleted = 0 ORDER BY date DESC, created_at DESC')) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getRecent(limit: number): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM expenses WHERE is_deleted = 0 ORDER BY date DESC, created_at DESC LIMIT ?', [limit])) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getByDateRange(from: string, to: string): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM expenses WHERE is_deleted = 0 AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC', [from, to])) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getByMonthRange(from: string, to: string, kind: EntryKind, limit: number, offset = 0): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM expenses WHERE is_deleted = 0 AND date >= ? AND date <= ? AND kind = ? ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?',
      [from, to, kind, limit, Math.max(offset, 0)],
    )) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async countByMonthRange(from: string, to: string, kind: EntryKind): Promise<number> {
    const db = await getDatabase();
    const row = await db
      .getFirstAsync<{ n: number | null }>(
        'SELECT COUNT(*) as n FROM expenses WHERE is_deleted = 0 AND date >= ? AND date <= ? AND kind = ?',
        [from, to, kind],
      )
      .catch(() => null);
    return row?.n ?? 0;
  }

  async getCategorySummary(fromDate?: string, kind: EntryKind = 'EXPENSE', toDate?: string): Promise<{ category: string; currency: string; total: number }[]> {
    const db = await getDatabase();
    let sql = `SELECT category, currency, SUM(amount) as total FROM expenses WHERE is_deleted = 0 AND kind = ?`;
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
       WHERE is_deleted = 0 AND kind = 'EXPENSE' AND date >= ? AND date <= ?
       GROUP BY month, currency ORDER BY month ASC`,
      [from, to],
    )) ?? [];
    return (rows ?? []).map((r) => ({ month: r.month, currency: r.currency, total: r.total }));
  }

  async getOldestDate(): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ d: string | null }>('SELECT MIN(date) as d FROM expenses WHERE is_deleted = 0');
    return row?.d ?? null;
  }

  async countByCategory(category: string): Promise<number> {
    const db = await getDatabase();
    const row = await db
      .getFirstAsync<{ n: number | null }>('SELECT COUNT(*) as n FROM expenses WHERE is_deleted = 0 AND category = ?', [category])
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
      `UPDATE expenses SET amount = ?, currency = ?, category = ?, kind = ?, description = ?, date = ?, payment_method = ?, confidence = ?, updated_at = ?, recurring_id = ?, sync_status = 'pending' WHERE id = ?`,
      [updated.amount, updated.currency, updated.category, updated.kind ?? 'EXPENSE', updated.description, updated.date, updated.paymentMethod ?? 'CASH', updated.confidence ?? null, updated.updatedAt, updated.recurringId ?? null, id],
    );
    return updated;
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expenses');
  }

  async getPendingUpserts(): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM expenses WHERE sync_status = 'pending' AND is_deleted = 0 ORDER BY updated_at ASC`,
    )) ?? [];
    return (rows ?? []).map(rowToExpense);
  }

  async getPendingDeletes(): Promise<{ id: string; updatedAt: string }[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<{ id: string; updated_at: string }>(
      `SELECT id, updated_at FROM expenses WHERE sync_status = 'pending' AND is_deleted = 1 ORDER BY updated_at ASC`,
    )) ?? [];
    return (rows ?? []).map((r) => ({ id: r.id, updatedAt: r.updated_at }));
  }

  async markSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`UPDATE expenses SET sync_status = 'synced' WHERE id IN (${placeholders})`, ids);
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(`UPDATE expenses SET is_deleted = 1, updated_at = ?, sync_status = 'pending' WHERE id = ?`, [now, id]);
  }

  async upsertFromCloud(expense: Expense, deleted: boolean): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO expenses (id, amount, currency, category, kind, description, date, payment_method, confidence, created_at, updated_at, recurring_id, sync_status, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
       ON CONFLICT(id) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, category = excluded.category,
         kind = excluded.kind, description = excluded.description, date = excluded.date, payment_method = excluded.payment_method,
         confidence = excluded.confidence, updated_at = excluded.updated_at, recurring_id = excluded.recurring_id,
         sync_status = 'synced', is_deleted = excluded.is_deleted`,
      [expense.id, expense.amount, expense.currency, expense.category, expense.kind ?? 'EXPENSE', expense.description, expense.date, expense.paymentMethod ?? 'CASH', expense.confidence ?? null, expense.createdAt, expense.updatedAt, expense.recurringId ?? null, deleted ? 1 : 0],
    );
  }

  async gcTombstones(beforeISO: string): Promise<number> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM expenses WHERE is_deleted = 1 AND sync_status = 'synced' AND updated_at < ?`, [beforeISO]);
    const row = await db.getFirstAsync<{ n: number }>('SELECT changes() as n').catch(() => null);
    return row?.n ?? 0;
  }
}

export const expenseRepository = new SqliteExpenseRepository();

// In-memory para tests
export class InMemoryExpenseRepository implements ExpenseRepository {
  private store = new Map<string, Expense>();
  /** Metadata de sync fuera del modelo (los objetos Expense quedan puros). */
  private sync = new Map<string, { status: 'pending' | 'synced'; deleted: boolean }>();

  private meta(id: string): { status: 'pending' | 'synced'; deleted: boolean } {
    return this.sync.get(id) ?? { status: 'synced', deleted: false };
  }

  private visible(): Expense[] {
    return Array.from(this.store.values()).filter((e) => !this.meta(e.id).deleted);
  }

  async create(expense: Expense): Promise<Expense> {
    this.store.set(expense.id, { ...expense });
    this.sync.set(expense.id, { status: 'pending', deleted: false });
    return expense;
  }
  async getById(id: string): Promise<Expense | null> {
    const e = this.store.get(id);
    if (!e || this.meta(id).deleted) return null;
    return e;
  }
  async getAll(): Promise<Expense[]> {
    return this.visible().sort((a, b) => (b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  }
  async getRecent(limit: number): Promise<Expense[]> {
    const all = await this.getAll();
    return all.slice(0, limit);
  }
  async getByDateRange(from: string, to: string): Promise<Expense[]> {
    const all = await this.getAll();
    return all.filter((e) => e.date >= from && e.date <= to);
  }
  async getByMonthRange(from: string, to: string, kind: EntryKind, limit: number, offset = 0): Promise<Expense[]> {
    const all = await this.getAll();
    return all
      .filter((e) => e.date >= from && e.date <= to && (e.kind ?? 'EXPENSE') === kind)
      .slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0));
  }
  async countByMonthRange(from: string, to: string, kind: EntryKind): Promise<number> {
    const all = await this.getAll();
    return all.filter((e) => e.date >= from && e.date <= to && (e.kind ?? 'EXPENSE') === kind).length;
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
    this.sync.delete(id);
  }
  async update(id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<Expense | null> {
    const existing = this.store.get(id);
    if (!existing || this.meta(id).deleted) return null;
    const updated = { ...existing, ...patch, id, updatedAt: new Date().toISOString() } as Expense;
    this.store.set(id, updated);
    this.sync.set(id, { status: 'pending', deleted: false });
    return updated;
  }
  async clearAll(): Promise<void> {
    this.store.clear();
    this.sync.clear();
  }
  async getPendingUpserts(): Promise<Expense[]> {
    return Array.from(this.store.values())
      .filter((e) => {
        const m = this.meta(e.id);
        return m.status === 'pending' && !m.deleted;
      })
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }
  async getPendingDeletes(): Promise<{ id: string; updatedAt: string }[]> {
    return Array.from(this.store.values())
      .filter((e) => {
        const m = this.meta(e.id);
        return m.status === 'pending' && m.deleted;
      })
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((e) => ({ id: e.id, updatedAt: e.updatedAt }));
  }
  async markSynced(ids: string[]): Promise<void> {
    for (const id of ids) {
      const m = this.sync.get(id);
      if (m) this.sync.set(id, { ...m, status: 'synced' });
    }
  }
  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    const now = new Date().toISOString();
    this.store.set(id, { ...existing, updatedAt: now });
    this.sync.set(id, { status: 'pending', deleted: true });
  }
  async upsertFromCloud(expense: Expense, deleted: boolean): Promise<void> {
    this.store.set(expense.id, { ...expense });
    this.sync.set(expense.id, { status: 'synced', deleted });
  }
  async gcTombstones(beforeISO: string): Promise<number> {
    let n = 0;
    for (const [id, m] of this.sync) {
      const e = this.store.get(id);
      if (m.deleted && m.status === 'synced' && e && e.updatedAt < beforeISO) {
        this.store.delete(id);
        this.sync.delete(id);
        n += 1;
      }
    }
    return n;
  }
}
