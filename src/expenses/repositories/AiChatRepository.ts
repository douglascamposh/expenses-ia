import { getDatabase } from '@/database/sqlite';

export type AiChatRole = 'user' | 'ai';

export interface AiChatMessage {
  id: number;
  role: AiChatRole;
  /** JSON serializado del mensaje (texto usuario o respuesta IA). */
  content: string;
  createdAt: string;
}

export interface AiChatRepository {
  add(role: AiChatRole, content: string): Promise<AiChatMessage>;
  /** Página newest-first; con beforeId trae las anteriores (scroll al pasado). */
  list(opts: { limit: number; beforeId?: number | null }): Promise<AiChatMessage[]>;
  clearAll(): Promise<void>;
}

function rowToMessage(row: Record<string, unknown>): AiChatMessage {
  const role = row.role === 'ai' ? 'ai' : 'user';
  return {
    id: Number(row.id ?? 0),
    role,
    content: String(row.content ?? '{}'),
    createdAt: String(row.created_at ?? ''),
  };
}

export class SqliteAiChatRepository implements AiChatRepository {
  async add(role: AiChatRole, content: string): Promise<AiChatMessage> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const res = await db.runAsync(
      'INSERT INTO ai_messages (role, content, created_at) VALUES (?, ?, ?)',
      [role, content, now],
    );
    return { id: Number(res?.lastInsertRowId ?? 0), role, content, createdAt: now };
  }

  async list({ limit, beforeId }: { limit: number; beforeId?: number | null }): Promise<AiChatMessage[]> {
    const db = await getDatabase();
    const rows = beforeId != null
      ? (await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM ai_messages WHERE id < ? ORDER BY id DESC LIMIT ?',
        [beforeId, limit],
      )) ?? []
      : (await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM ai_messages ORDER BY id DESC LIMIT ?',
        [limit],
      )) ?? [];
    return (rows ?? []).map(rowToMessage);
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM ai_messages');
  }
}

export const aiChatRepository = new SqliteAiChatRepository();

// In-memory para tests
export class InMemoryAiChatRepository implements AiChatRepository {
  private store: AiChatMessage[] = [];
  private seq = 0;

  async add(role: AiChatRole, content: string): Promise<AiChatMessage> {
    this.seq += 1;
    const m: AiChatMessage = { id: this.seq, role, content, createdAt: new Date().toISOString() };
    this.store.push(m);
    return m;
  }

  async list({ limit, beforeId }: { limit: number; beforeId?: number | null }): Promise<AiChatMessage[]> {
    const all = [...this.store].sort((a, b) => b.id - a.id);
    const filtered = beforeId != null ? all.filter((m) => m.id < beforeId) : all;
    return filtered.slice(0, limit);
  }

  async clearAll(): Promise<void> {
    this.store = [];
    this.seq = 0;
  }
}
