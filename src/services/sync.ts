import { expenseRepository, type ExpenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { SETTING_KEYS, settingsRepository } from '@/expenses/repositories/SettingsRepository';
import { isValidCurrency, isValidKind, isValidPaymentMethod, type Expense } from '@/expenses/models/Expense';
import {
  SYNC_MAX_CHANGES,
  expenseToSyncChange,
  pullSync,
  pushSync,
  type SyncChangeIn,
  type SyncChangeOut,
  type SyncConflict,
} from './sync-api';

/**
 * Motor de respaldo (push + pull) contra `/api/sync/*`.
 * - Push por lotes (máx. 500): pendientes locales → `applied` se marcan,
 *   `conflicts` se sobrescriben con el servidor (last-write-wins).
 * - Pull incremental con `lastPulledAt` (omitido = completo).
 * - Tombstones locales se purgan tras `tombstoneDays` una vez subidas.
 * - 403 del backend = no es Pro (se propaga como SyncError).
 */

export interface SyncKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface SyncDeps {
  repo: ExpenseRepository;
  kv: SyncKv;
  push: typeof pushSync;
  pull: typeof pullSync;
  deviceId?: string;
  now?: () => string;
  maxChanges?: number;
  tombstoneDays?: number;
  maxPullPages?: number;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
}

function randomDeviceId(): string {
  const hex = () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  return `d-${hex()}${hex()}`.slice(0, 18);
}

function expenseFromCloud(id: string, updatedAt: string, data: Record<string, unknown>): Expense {
  const currency = String(data.currency ?? 'BOB');
  const kind = String(data.kind ?? 'EXPENSE');
  const method = String(data.paymentMethod ?? 'CASH');
  return {
    id,
    amount: Number(data.amount ?? 0) || 0,
    currency: (isValidCurrency(currency) ? currency : 'BOB') as Expense['currency'],
    category: String(data.category ?? 'OTHER') as Expense['category'],
    kind: isValidKind(kind) ? kind : 'EXPENSE',
    description: String(data.description ?? ''),
    date: String(data.date ?? updatedAt.slice(0, 10)),
    paymentMethod: isValidPaymentMethod(method) ? method : 'CASH',
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : updatedAt,
    updatedAt,
    recurringId: typeof data.recurringId === 'string' ? data.recurringId : null,
  };
}

export async function runSync(deps: Partial<SyncDeps> = {}): Promise<SyncResult> {
  const {
    repo = expenseRepository,
    kv = settingsRepository,
    push = pushSync,
    pull = pullSync,
    maxChanges = SYNC_MAX_CHANGES,
    tombstoneDays = 30,
    maxPullPages = 20,
    now = () => new Date().toISOString(),
  } = deps;

  let deviceId = deps.deviceId ?? (await kv.get(SETTING_KEYS.syncDeviceId));
  if (!deviceId) {
    deviceId = randomDeviceId();
    await kv.set(SETTING_KEYS.syncDeviceId, deviceId);
  }

  // ---- PUSH por lotes ----
  let pushed = 0;
  let conflicts = 0;
  for (;;) {
    const upserts = await repo.getPendingUpserts();
    const deletes = await repo.getPendingDeletes();
    const batch: SyncChangeOut[] = [
      ...upserts.map(expenseToSyncChange),
      ...deletes.map((d) => ({ id: d.id, op: 'delete' as const, updatedAt: d.updatedAt })),
    ].slice(0, Math.max(maxChanges, 1));
    if (batch.length === 0) break;
    const res = await push({ deviceId, changes: batch });
    const applied = res.applied ?? [];
    if (applied.length > 0) {
      await repo.markSynced(applied);
      pushed += applied.length;
    }
    for (const c of res.conflicts ?? []) {
      await applyConflict(repo, c);
      conflicts += 1;
    }
    // Sin progreso (nada aplicado ni conflictos) → salir para no loopear.
    if (applied.length === 0 && (res.conflicts ?? []).length === 0) break;
    if (batch.length < Math.max(maxChanges, 1)) break;
  }

  // Ids que siguen pendientes (no subir/borrar por encima en el pull).
  const stillPending = new Set<string>();
  for (const e of await repo.getPendingUpserts()) stillPending.add(e.id);
  for (const d of await repo.getPendingDeletes()) stillPending.add(d.id);

  // ---- PULL incremental ----
  let pulled = 0;
  let since = await kv.get(SETTING_KEYS.lastSyncPulledAt);
  for (let page = 0; page < maxPullPages; page++) {
    const res = await pull(since);
    for (const c of res.changes ?? []) {
      if (await applyPulled(repo, c, stillPending)) pulled += 1;
    }
    since = res.serverTime;
    await kv.set(SETTING_KEYS.lastSyncPulledAt, since);
    if (!res.hasMore) break;
  }

  // ---- GC de tombstones ----
  const cutoff = new Date(Date.parse(now()) - tombstoneDays * 86400000).toISOString();
  await repo.gcTombstones(cutoff);

  return { pushed, pulled, conflicts };
}

async function applyConflict(repo: ExpenseRepository, c: SyncConflict): Promise<void> {
  const data = (c.serverData ?? {}) as Record<string, unknown>;
  await repo.upsertFromCloud(expenseFromCloud(c.id, c.serverUpdatedAt, data), false);
}

async function applyPulled(
  repo: ExpenseRepository,
  c: SyncChangeIn,
  stillPending: Set<string>,
): Promise<boolean> {
  if (c.op === 'delete') {
    // Borrado remoto: no pisar cambios locales aún no subidos.
    if (stillPending.has(c.id)) return false;
    await repo.delete(c.id);
    return true;
  }
  const data = (c.data ?? {}) as Record<string, unknown>;
  // Cambio local aún no subido (incluye borrados): gana lo local por ahora.
  if (stillPending.has(c.id)) return false;
  const local = await repo.getById(c.id);
  // Local más nuevo o igual gana (se subirá en el próximo push).
  if (local && local.updatedAt >= c.updatedAt) return false;
  await repo.upsertFromCloud(expenseFromCloud(c.id, c.updatedAt, data), false);
  return true;
}
