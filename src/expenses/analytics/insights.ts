import type { BudgetProgress } from '../models/Budget';
import type { Expense } from '../models/Expense';
import type { RecurringRule } from '../models/Recurring';

/**
 * Heurísticas locales de la IA (fallback offline + chips deterministas).
 * Puras y testeables: entran gastos/reglas, salen estructuras listas
 * para mostrar. Cuando el backend (`/api/ask`) responde, se prefiere eso.
 */

export type AdviceKind = 'hormiga' | 'review' | 'top' | 'save';
export type Lang = 'es' | 'en' | 'pt';

export interface HormigaGroup {
  key: string;
  label: string;
  count: number;
  total: number;
  currency: string;
  ids: string[];
}

export interface HormigaResult {
  groups: HormigaGroup[];
  total: number;
  count: number;
  currency: string;
}

export interface TopResult {
  category: string;
  total: number;
  share: number;
  count: number;
  currency: string;
}

export interface ReviewResult {
  total: number;
  count: number;
  currency: string;
  top: TopResult | null;
  prevTotal: number | null;
  deltaPct: number | null;
}

export type SavingKind = 'hormiga' | 'subscription' | 'top';

export interface SavingSuggestion {
  kind: SavingKind;
  title: string;
  detail: string;
  estimated: number;
  currency: string;
  expenseIds: string[];
}

export interface SavingResult {
  total: number;
  currency: string;
  suggestions: SavingSuggestion[];
}

function isExpense(e: Expense): boolean {
  return (e.kind ?? 'EXPENSE') === 'EXPENSE';
}

function normKey(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Gastos chicos y repetidos (café, snacks…): los "hormiga". */
export function detectHormiga(
  expenses: Expense[],
  currency: string,
  opts?: { maxAmount?: number; minCount?: number; top?: number },
): HormigaResult {
  const maxAmount = opts?.maxAmount ?? 30;
  const minCount = opts?.minCount ?? 3;
  const topN = opts?.top ?? 5;
  const byKey = new Map<string, HormigaGroup>();
  for (const e of expenses ?? []) {
    if (!e || !isExpense(e) || e.currency !== currency) continue;
    const amount = e.amount ?? 0;
    if (!(amount > 0) || amount > maxAmount) continue;
    const label = (e.description ?? '').trim();
    if (!label) continue;
    const key = normKey(label);
    const g = byKey.get(key) ?? { key, label, count: 0, total: 0, currency, ids: [] };
    g.count += 1;
    g.total += amount;
    if (g.ids.length < 5) g.ids.push(e.id);
    byKey.set(key, g);
  }
  const groups = [...byKey.values()]
    .filter((g) => g.count >= minCount)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
  return {
    groups,
    total: groups.reduce((a, g) => a + g.total, 0),
    count: groups.reduce((a, g) => a + g.count, 0),
    currency,
  };
}

/** Categoría dominante del período. */
export function topSpending(expenses: Expense[], currency: string): TopResult | null {
  const scoped = (expenses ?? []).filter((e) => e && isExpense(e) && e.currency === currency);
  const total = scoped.reduce((a, e) => a + (e.amount ?? 0), 0);
  if (scoped.length === 0 || total <= 0) return null;
  const byCat = new Map<string, { total: number; count: number }>();
  for (const e of scoped) {
    const prev = byCat.get(String(e.category)) ?? { total: 0, count: 0 };
    prev.total += e.amount ?? 0;
    prev.count += 1;
    byCat.set(String(e.category), prev);
  }
  const [category, v] = [...byCat.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  return { category, total: v.total, share: (v.total / total) * 100, count: v.count, currency };
}

/** Resumen del mes + variación vs anterior. */
export function monthReview(current: Expense[], prev: Expense[], currency: string): ReviewResult {
  const scoped = (current ?? []).filter((e) => e && isExpense(e) && e.currency === currency);
  const total = scoped.reduce((a, e) => a + (e.amount ?? 0), 0);
  const prevScoped = (prev ?? []).filter((e) => e && isExpense(e) && e.currency === currency);
  const prevTotal = prevScoped.length > 0 ? prevScoped.reduce((a, e) => a + (e.amount ?? 0), 0) : null;
  return {
    total,
    count: scoped.length,
    currency,
    top: topSpending(current, currency),
    prevTotal,
    deltaPct: prevTotal !== null && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
  };
}

export interface SavingInput {
  expenses: Expense[];
  rules: RecurringRule[];
  budgets: BudgetProgress[];
  currency: string;
  lang?: Lang;
}

/** De dónde recortar: suscripciones + hormiga + categoría top. */
export function savingAdvice(input: SavingInput): SavingResult {
  const { expenses, rules, currency } = input;
  const lang = input.lang ?? 'es';
  const money = (n: number) => `${fmtInt(n)} ${currency}`;
  const suggestions: SavingSuggestion[] = [];

  for (const r of rules ?? []) {
    if (!r || r.active === false || (r.kind ?? 'EXPENSE') !== 'EXPENSE' || r.currency !== currency) continue;
    const amount = r.amount ?? 0;
    if (!(amount > 0)) continue;
    suggestions.push({
      kind: 'subscription',
      title: r.description ?? '',
      detail: lang === 'en'
        ? `Recurs ${money(amount)} (${String(r.frequency).toLowerCase()}). Cancelling saves it all.`
        : `Se repite por ${money(amount)} (${String(r.frequency).toLowerCase()}). Cancelarla lo ahorra todo.`,
      estimated: Math.round(amount),
      currency,
      expenseIds: [],
    });
  }

  const hormiga = detectHormiga(expenses, currency);
  if (hormiga.total > 0) {
    const topLabel = hormiga.groups[0]?.label ?? '';
    suggestions.push({
      kind: 'hormiga',
      title: lang === 'en' ? `Cut ant expenses (${hormiga.count})` : `Recorta gastos hormiga (${hormiga.count})`,
      detail: lang === 'en'
        ? `${money(hormiga.total)} in small repeat purchases${topLabel ? `, e.g. ${topLabel}` : ''}. Halving them saves ${money(hormiga.total / 2)}.`
        : `${money(hormiga.total)} en compras chicas repetidas${topLabel ? `, p. ej. ${topLabel}` : ''}. Reducirlas a la mitad ahorra ${money(hormiga.total / 2)}.`,
      estimated: Math.round(hormiga.total / 2),
      currency,
      expenseIds: hormiga.groups.flatMap((g) => g.ids).slice(0, 10),
    });
  }

  const top = topSpending(expenses, currency);
  if (top) {
    suggestions.push({
      kind: 'top',
      title: lang === 'en' ? `Review ${top.category}` : `Revisa ${top.category}`,
      detail: lang === 'en'
        ? `It takes ${money(top.total)} (${Math.round(top.share)}% of the month). Cutting 15% saves ${money(top.total * 0.15)}.`
        : `Acumula ${money(top.total)} (${Math.round(top.share)}% del mes). Recortar 15% ahorra ${money(top.total * 0.15)}.`,
      estimated: Math.round(top.total * 0.15),
      currency,
      expenseIds: [],
    });
  }

  suggestions.sort((a, b) => b.estimated - a.estimated);
  return { total: suggestions.reduce((a, s) => a + s.estimated, 0), currency, suggestions };
}

/** Clasifica texto libre a un análisis local (null = probar analytics/semántico). */
export function routeAiQuery(query: string): AdviceKind | null {
  const q = normKey(query ?? '');
  if (q.length < 2) return null;
  if (/(hormiga|hormigas|fuga|fugas|peque[ñn]os|chicos|gastos chicos)/.test(q)) return 'hormiga';
  if (/(revision|resumen)/.test(q)) return 'review';
  if (/(ahorrar|ahorro|ahorras|ahorre|recorta|reducir gastos|quitar gastos)/.test(q)) return 'save';
  if (/(donde gasto|top|categoria que mas|mayor gasto|gasto mas)/.test(q)) return 'top';
  return null;
}
