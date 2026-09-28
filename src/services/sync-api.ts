import { getAuthToken } from './auth';
import { getBillingBaseUrl } from './billing';
import type { Expense } from '@/expenses/models/Expense';

/**
 * Cliente del respaldo en la nube (`POST /api/sync/push`, `GET /api/sync/pull`).
 * Contrato: ids estables del celular, timestamps ISO UTC, máx. 500 cambios/push.
 */

export const SYNC_PUSH_PATH = '/api/sync/push';
export const SYNC_PULL_PATH = '/api/sync/pull';
/** Tope de cambios por push (límite del batch). */
export const SYNC_MAX_CHANGES = 500;

export type SyncOp = 'upsert' | 'delete';

export interface SyncChangeOut {
  id: string;
  op: SyncOp;
  updatedAt: string;
  data?: {
    amount: number;
    currency: string;
    category: string;
    kind: string;
    description: string;
    date: string;
    paymentMethod: string;
    createdAt: string;
    recurringId?: string | null;
  };
}

export interface SyncPushRequest {
  deviceId: string;
  changes: SyncChangeOut[];
}

export interface SyncConflict {
  id: string;
  serverUpdatedAt: string;
  serverData: Record<string, unknown>;
}

export interface SyncPushResponse {
  applied: string[];
  conflicts: SyncConflict[];
  serverTime: string;
}

export interface SyncChangeIn {
  id: string;
  op: SyncOp;
  updatedAt: string;
  data?: Record<string, unknown>;
}

export interface SyncPullResponse {
  changes: SyncChangeIn[];
  serverTime: string;
  hasMore: boolean;
}

export class SyncError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

export function expenseToSyncChange(e: Expense): SyncChangeOut {
  return {
    id: e.id,
    op: 'upsert',
    updatedAt: e.updatedAt,
    data: {
      amount: e.amount ?? 0,
      currency: e.currency,
      category: String(e.category),
      kind: e.kind ?? 'EXPENSE',
      description: e.description ?? '',
      date: e.date ?? '',
      paymentMethod: e.paymentMethod ?? 'CASH',
      createdAt: e.createdAt ?? '',
      recurringId: e.recurringId ?? null,
    },
  };
}

async function authedJson(path: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  const token = await getAuthToken();
  // pullSync pasa URL completa (base + path + ?since); no duplicar la base.
  const url = /^https?:\/\//i.test(path) ? path : `${getBillingBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    // Cuerpo vacío o inválido: se valida abajo.
  }
  return { status: response.status, json };
}

/** Sube un lote de cambios. 403 = no es Pro. */
export async function pushSync(
  body: SyncPushRequest,
  endpoint: string = `${getBillingBaseUrl()}${SYNC_PUSH_PATH}`,
): Promise<SyncPushResponse> {
  const token = await getAuthToken();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new SyncError((e as Error)?.message ?? 'Error de red en sincronización');
  }
  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SyncError('Respuesta inválida del servidor', response.status);
  }
  if (response.status === 403) throw new SyncError('Se requiere Pro para respaldar', 403);
  if (!response.ok) {
    const msg = typeof json?.error === 'string' ? json.error : `Error ${response.status} en sincronización`;
    throw new SyncError(msg, response.status);
  }
  const applied = Array.isArray(json.applied) ? (json.applied as unknown[]).map(String) : [];
  const conflicts = Array.isArray(json.conflicts) ? (json.conflicts as SyncConflict[]) : [];
  return {
    applied,
    conflicts,
    serverTime: typeof json.serverTime === 'string' ? json.serverTime : new Date().toISOString(),
  };
}

/** Baja cambios desde `since` (omitido = pull completo). */
export async function pullSync(
  since?: string | null,
  endpoint: string = `${getBillingBaseUrl()}${SYNC_PULL_PATH}`,
): Promise<SyncPullResponse> {
  const url = since ? `${endpoint}?since=${encodeURIComponent(since)}` : endpoint;
  const { status, json } = await authedJson(url, { method: 'GET' }).catch((e: unknown) => {
    throw new SyncError((e as Error)?.message ?? 'Error de red en sincronización');
  });
  if (status === 403) throw new SyncError('Se requiere Pro para respaldar', 403);
  if (status < 200 || status >= 300) {
    const msg = typeof json?.error === 'string' ? json.error : `Error ${status} en sincronización`;
    throw new SyncError(msg, status);
  }
  const changes = Array.isArray(json.changes) ? (json.changes as SyncChangeIn[]) : [];
  return {
    changes,
    serverTime: typeof json.serverTime === 'string' ? json.serverTime : new Date().toISOString(),
    hasMore: json.hasMore === true,
  };
}
