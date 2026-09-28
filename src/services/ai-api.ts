import { getAuthToken } from './auth';
import { getBillingBaseUrl } from './billing';
import type { Currency, Expense } from '@/expenses/models/Expense';
import type { RecurringRule } from '@/expenses/models/Recurring';
import type { BudgetProgress } from '@/expenses/models/Budget';

/**
 * Cliente del asistente IA (`POST /api/ask`).
 * El backend no alcanza la BD local: por cada consulta se envía un snapshot
 * de textos (máx. 200 gastos recientes del período). Contrato mock-first:
 * `mockAskAi` permite desarrollar la pantalla sin backend.
 */

export const AI_ASK_PATH = '/api/ask';
/** Timeout del modelo (ms): pasado esto se cae al pipeline local. */
export const AI_TIMEOUT_MS = 30000;
/** Tope de gastos por snapshot (~200 × 60 chars ≈ 12 KB). */
export const AI_MAX_EXPENSES = 200;
/**
 * Cuota mostrada antes de que el backend responda (modo gratis).
 * El backend es la fuente real: gratis devuelve pocas, pago devuelve
 * más amplias; el texto del contador es el mismo en ambos modos.
 */
export const AI_FREE_QUOTA = 30;

export type AiResponseType = 'savings_advice' | 'hormiga' | 'month_review' | 'top_spending' | 'lookup';
export type AiSuggestionKind = 'cut' | 'reduce' | 'subscription' | 'hormiga';

export interface AiSnapshotExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
}

export interface AiSnapshot {
  query: string;
  lang: string;
  model: string;
  currency: string;
  period: { from: string; to: string };
  categories: { id: string; label: string; kind: string }[];
  expenses: AiSnapshotExpense[];
  recurring: { label: string; amount: number; currency: string; frequency: string }[];
  budgets: { category: string; limit: number; spent: number }[];
}

export interface AiSuggestion {
  id: string;
  title: string;
  detail: string;
  estimated_savings: number;
  expense_ids: string[];
  kind: AiSuggestionKind;
}

export interface AiResponse {
  type: AiResponseType;
  title: string;
  summary: string;
  total_savable?: number;
  currency: string;
  suggestions: AiSuggestion[];
  expense_ids: string[];
  quota_remaining?: number;
  latency?: number;
}

export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

export function askAiEndpoint(baseUrl: string = getBillingBaseUrl()): string {
  return `${baseUrl}${AI_ASK_PATH}`;
}

type SnapshotInput = {
  query: string;
  lang: string;
  model?: string;
  currency: string;
  period: { from: string; to: string };
  categories: { id: string; label: string; kind: string }[];
  expenses: Expense[];
  rules: RecurringRule[];
  budgets: BudgetProgress[];
  limit?: number;
};

/** Recorta y normaliza el snapshot que viaja al backend. */
export function buildAiSnapshot(input: SnapshotInput): AiSnapshot {
  const cap = input.limit ?? AI_MAX_EXPENSES;
  const inScope = (input.expenses ?? []).filter(
    (e) => e && e.date >= input.period.from && e.date <= input.period.to,
  );
  const expenses = inScope.slice(0, cap).map((e) => ({
    id: e.id,
    description: e.description ?? '',
    amount: e.amount ?? 0,
    currency: e.currency,
    category: String(e.category),
    date: e.date ?? '',
  }));
  return {
    query: input.query,
    lang: input.lang,
    model: input.model ?? 'gemini',
    currency: input.currency,
    period: input.period,
    categories: input.categories ?? [],
    expenses,
    recurring: (input.rules ?? [])
      .filter((r) => r && r.active !== false)
      .map((r) => ({
        label: r.description ?? '',
        amount: r.amount ?? 0,
        currency: r.currency,
        frequency: r.frequency,
      })),
    budgets: (input.budgets ?? [])
      .filter(Boolean)
      .map((b) => ({ category: String(b.category), limit: b.limit ?? 0, spent: b.spent ?? 0 })),
  };
}

/** Llama al backend real. Falla → el llamador usa fallback local. */
export async function askAi(
  snapshot: AiSnapshot,
  endpoint: string = askAiEndpoint(),
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<AiResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let response: Response;
  try {
    const token = await getAuthToken();
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(snapshot),
      signal: ctrl.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new AiError('La IA tardó demasiado');
    throw new AiError((e as Error)?.message ?? 'Error de red con la IA');
  } finally {
    clearTimeout(timer);
  }
  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new AiError('Respuesta inválida de la IA', response.status);
  }
  if (!response.ok) {
    const msg = typeof json?.error === 'string' ? json.error : `Error ${response.status} de la IA`;
    throw new AiError(msg, response.status);
  }
  return normalizeAiResponse(json, snapshot);
}

/** Valida/defiende la forma de la respuesta del backend. */
export function normalizeAiResponse(json: Record<string, unknown>, snapshot: AiSnapshot): AiResponse {
  const known: AiResponseType[] = ['savings_advice', 'hormiga', 'month_review', 'top_spending', 'lookup'];
  const type: AiResponseType = known.includes(json.type as AiResponseType)
    ? (json.type as AiResponseType)
    : 'lookup';
  const suggestions = Array.isArray(json.suggestions)
    ? (json.suggestions as Record<string, unknown>[]).filter(Boolean).map((s, i) => ({
      id: typeof s.id === 'string' ? s.id : `s${i}`,
      title: typeof s.title === 'string' ? s.title : '',
      detail: typeof s.detail === 'string' ? s.detail : '',
      estimated_savings: Number(s.estimated_savings ?? 0) || 0,
      expense_ids: Array.isArray(s.expense_ids) ? (s.expense_ids as unknown[]).map(String) : [],
      kind: (['cut', 'reduce', 'subscription', 'hormiga'] as string[]).includes(String(s.kind))
        ? (s.kind as AiSuggestionKind)
        : 'cut',
    }))
    : [];
  const expenseIds = Array.isArray(json.expense_ids)
    ? (json.expense_ids as unknown[]).map(String)
    : [];
  // Solo ids que existen en el snapshot (el backend no debe inventar).
  const knownIds = new Set(snapshot.expenses.map((e) => e.id));
  const cleanSuggestions = suggestions.map((s) => ({
    ...s,
    expense_ids: s.expense_ids.filter((id) => knownIds.has(id)),
  }));
  return {
    type,
    title: typeof json.title === 'string' ? json.title : '',
    summary: typeof json.summary === 'string' ? json.summary : '',
    total_savable: typeof json.total_savable === 'number' ? json.total_savable : undefined,
    currency: typeof json.currency === 'string' ? json.currency : snapshot.currency,
    suggestions: cleanSuggestions,
    expense_ids: expenseIds.filter((id) => knownIds.has(id)),
    quota_remaining: typeof json.quota_remaining === 'number' ? json.quota_remaining : undefined,
    latency: typeof json.latency === 'number' ? json.latency : undefined,
  };
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/**
 * Mock determinista para desarrollar sin backend: usa los totales reales
 * del snapshot para que los números se vean creíbles.
 */
export function mockAskAi(query: string, snapshot: AiSnapshot): AiResponse {
  const total = snapshot.expenses.reduce((a, e) => a + (e.amount ?? 0), 0);
  const byCat = new Map<string, { total: number; ids: string[] }>();
  for (const e of snapshot.expenses) {
    const prev = byCat.get(e.category) ?? { total: 0, ids: [] };
    prev.total += e.amount ?? 0;
    prev.ids.push(e.id);
    byCat.set(e.category, prev);
  }
  const top = [...byCat.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  const cur = snapshot.currency;
  const ids = snapshot.expenses.slice(0, 5).map((e) => e.id);
  return {
    type: 'lookup',
    title: `Gastaste ${fmtInt(total)} ${cur}`,
    summary: `Encontré ${snapshot.expenses.length} gastos para "${query}". Conecta el backend para respuestas generativas.`,
    currency: cur,
    suggestions: top
      ? [{
        id: 's-top',
        title: `Revisa ${top[0]}`,
        detail: `Acumula ${fmtInt(top[1].total)} ${cur} en el período.`,
        estimated_savings: Math.round(top[1].total * 0.15),
        expense_ids: top[1].ids.slice(0, 5),
        kind: 'reduce',
      }]
      : [],
    expense_ids: ids,
    quota_remaining: AI_FREE_QUOTA,
    latency: 0,
  };
}
