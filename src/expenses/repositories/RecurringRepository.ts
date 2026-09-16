import { getDatabase } from '@/database/sqlite';
import type { NewRecurringRule, RecurringRule } from '../models/Recurring';

export interface RecurringRepository {
  getAll(): Promise<RecurringRule[]>;
  getActive(): Promise<RecurringRule[]>;
  create(input: NewRecurringRule): Promise<RecurringRule>;
  update(id: string, patch: Partial<Omit<RecurringRule, 'id' | 'createdAt'>>): Promise<RecurringRule | null>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

function rowToRule(row: Record<string, unknown>): RecurringRule {
  return {
    id: row.id as string,
    description: row.description as string,
    amount: row.amount as number,
    currency: row.currency as RecurringRule['currency'],
    category: row.category as RecurringRule['category'],
    kind: (row.kind as string) === 'INCOME' ? 'INCOME' : 'EXPENSE',
    frequency: row.frequency as RecurringRule['frequency'],
    day1: (row.day1 as number) ?? 1,
    day2: (row.day2 as number | null) ?? null,
    weekday: (row.weekday as number | null) ?? null,
    month: (row.month as number | null) ?? null,
    paymentMethod: (row.payment_method as string) === 'CARD' ? 'CARD' : 'CASH',
    startDate: row.start_date as string,
    endDate: (row.end_date as string | null) ?? null,
    active: (row.active as number) === 1,
    lastGenerated: (row.last_generated as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function newId(): string {
  return `rr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class SqliteRecurringRepository implements RecurringRepository {
  async getAll(): Promise<RecurringRule[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM recurring_rules ORDER BY created_at DESC',
    )) ?? [];
    return (rows ?? []).map(rowToRule);
  }

  async getActive(): Promise<RecurringRule[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM recurring_rules WHERE active = 1 ORDER BY created_at DESC',
    )) ?? [];
    return (rows ?? []).map(rowToRule);
  }

  async create(input: NewRecurringRule): Promise<RecurringRule> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const rule: RecurringRule = {
      ...input,
      id: input.id ?? newId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO recurring_rules (id, description, amount, currency, category, kind, frequency, day1, day2, weekday, month, payment_method, start_date, end_date, active, last_generated, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.description, rule.amount, rule.currency, rule.category, rule.kind, rule.frequency,
        rule.day1, rule.day2, rule.weekday, rule.month, rule.paymentMethod, rule.startDate, rule.endDate,
        rule.active ? 1 : 0, rule.lastGenerated, rule.createdAt, rule.updatedAt],
    );
    return rule;
  }

  async update(id: string, patch: Partial<Omit<RecurringRule, 'id' | 'createdAt'>>): Promise<RecurringRule | null> {
    const db = await getDatabase();
    const cols: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      description: 'description', amount: 'amount', currency: 'currency', category: 'category',
      kind: 'kind', frequency: 'frequency', day1: 'day1', day2: 'day2', weekday: 'weekday',
      month: 'month', paymentMethod: 'payment_method', startDate: 'start_date', endDate: 'end_date',
      active: 'active', lastGenerated: 'last_generated',
    };
    for (const [k, v] of Object.entries(patch ?? {})) {
      const col = map[k];
      if (!col || v === undefined) continue;
      cols.push(`${col} = ?`);
      params.push(k === 'active' ? (v ? 1 : 0) : v);
    }
    if (cols.length === 0) {
      const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
      return row ? rowToRule(row) : null;
    }
    cols.push(`updated_at = ?`);
    params.push(new Date().toISOString(), id);
    await db.runAsync(`UPDATE recurring_rules SET ${cols.join(', ')} WHERE id = ?`, params as (string | number | null)[]);
    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
    return row ? rowToRule(row) : null;
  }

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM recurring_rules');
  }
}

export class InMemoryRecurringRepository implements RecurringRepository {
  private store = new Map<string, RecurringRule>();

  async getAll(): Promise<RecurringRule[]> {
    return Array.from(this.store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getActive(): Promise<RecurringRule[]> {
    return (await this.getAll()).filter((r) => r.active);
  }
  async create(input: NewRecurringRule): Promise<RecurringRule> {
    const now = new Date().toISOString();
    const rule: RecurringRule = { ...input, id: input.id ?? newId(), createdAt: now, updatedAt: now };
    this.store.set(rule.id, rule);
    return rule;
  }
  async update(id: string, patch: Partial<Omit<RecurringRule, 'id' | 'createdAt'>>): Promise<RecurringRule | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id, updatedAt: new Date().toISOString() } as RecurringRule;
    this.store.set(id, updated);
    return updated;
  }
  async remove(id: string): Promise<void> {
    this.store.delete(id);
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}

export const recurringRepository: RecurringRepository = new SqliteRecurringRepository();
