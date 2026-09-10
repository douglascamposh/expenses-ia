import { getDatabase } from '@/database/sqlite';
import { bytesToFloat32, float32ToBytes } from '../utils/vectors';

export interface StoredEmbedding {
  expenseId: string;
  vector: Float32Array;
  model: string;
  dims: number;
}

export interface EmbeddingRepository {
  upsert(expenseId: string, vector: Float32Array, model: string): Promise<void>;
  getAll(model: string): Promise<StoredEmbedding[]>;
  /** Modelos con vectores y su conteo. */
  getModelStats(): Promise<{ model: string; dims: number; count: number }[]>;
  /** IDs de gastos sin vector para un modelo (para backfill). */
  getMissingExpenseIds(model: string, expenseIds: string[]): Promise<string[]>;
  delete(expenseId: string): Promise<void>;
  clearAll(): Promise<void>;
}

function rowToEmbedding(row: Record<string, unknown>): StoredEmbedding {
  return {
    expenseId: row.expense_id as string,
    vector: bytesToFloat32(row.embedding as Uint8Array),
    model: row.model as string,
    dims: row.dims as number,
  };
}

export class SqliteEmbeddingRepository implements EmbeddingRepository {
  async upsert(expenseId: string, vector: Float32Array, model: string): Promise<void> {
    if (!expenseId || !(vector instanceof Float32Array) || vector.length === 0 || !model) {
      throw new Error('Embedding inválido');
    }
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO expense_embeddings (expense_id, embedding, model, dims, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(expense_id) DO UPDATE SET embedding = excluded.embedding, model = excluded.model, dims = excluded.dims, updated_at = excluded.updated_at`,
      [expenseId, float32ToBytes(vector), model, vector.length, new Date().toISOString()],
    );
  }

  async getAll(model: string): Promise<StoredEmbedding[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM expense_embeddings WHERE model = ?',
      [model],
    )) ?? [];
    return (rows ?? []).map(rowToEmbedding);
  }

  async getModelStats(): Promise<{ model: string; dims: number; count: number }[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<{ model: string; dims: number; count: number }>(
      'SELECT model, MAX(dims) as dims, COUNT(*) as count FROM expense_embeddings GROUP BY model',
    )) ?? [];
    return (rows ?? []).map((r) => ({ model: r.model, dims: r.dims, count: r.count }));
  }

  async getMissingExpenseIds(model: string, expenseIds: string[]): Promise<string[]> {
    const safe = (expenseIds ?? []).filter(Boolean);
    if (safe.length === 0) return [];
    const db = await getDatabase();
    const placeholders = safe.map(() => '?').join(',');
    const rows = (await db.getAllAsync<{ expense_id: string }>(
      `SELECT expense_id FROM expense_embeddings WHERE model = ? AND expense_id IN (${placeholders})`,
      [model, ...safe],
    )) ?? [];
    const have = new Set((rows ?? []).map((r) => r.expense_id));
    return safe.filter((id) => !have.has(id));
  }

  async delete(expenseId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expense_embeddings WHERE expense_id = ?', [expenseId]);
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expense_embeddings');
  }
}

export const embeddingRepository = new SqliteEmbeddingRepository();

// In-memory para tests
export class InMemoryEmbeddingRepository implements EmbeddingRepository {
  private store = new Map<string, StoredEmbedding>();

  async upsert(expenseId: string, vector: Float32Array, model: string): Promise<void> {
    if (!expenseId || !(vector instanceof Float32Array) || vector.length === 0 || !model) {
      throw new Error('Embedding inválido');
    }
    this.store.set(expenseId, { expenseId, vector: vector.slice(), model, dims: vector.length });
  }
  async getAll(model: string): Promise<StoredEmbedding[]> {
    return Array.from(this.store.values()).filter((e) => e.model === model);
  }
  async getModelStats(): Promise<{ model: string; dims: number; count: number }[]> {
    const map = new Map<string, { model: string; dims: number; count: number }>();
    for (const e of this.store.values()) {
      const prev = map.get(e.model);
      if (prev) {
        prev.count += 1;
        prev.dims = Math.max(prev.dims, e.dims);
      } else map.set(e.model, { model: e.model, dims: e.dims, count: 1 });
    }
    return Array.from(map.values());
  }
  async getMissingExpenseIds(model: string, expenseIds: string[]): Promise<string[]> {
    const safe = (expenseIds ?? []).filter(Boolean);
    return safe.filter((id) => {
      const e = this.store.get(id);
      return !e || e.model !== model;
    });
  }
  async delete(expenseId: string): Promise<void> {
    this.store.delete(expenseId);
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}
