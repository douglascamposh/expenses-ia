import type { Expense } from '../models/Expense';

export interface RecentSection {
  /** YYYY-MM-DD */
  date: string;
  /** hoy · ayer · anteayer · "6 sept" */
  label: string;
  items: Expense[];
  totals: Record<string, number>;
}

/** Últimas fechas con gasto que se muestran. */
export const MAX_RECENT_DATES = 5;
/** Tope de items en recientes. */
export const MAX_RECENT_ITEMS = 30;

export function dayLabel(date: string, lang: 'es' | 'en' = 'es', todayStr?: string): string {
  const today = todayStr ?? new Date().toISOString().split('T')[0];
  if (date === today) return lang === 'en' ? 'today' : 'hoy';
  const base = new Date(today + 'T12:00:00');
  const yesterday = new Date(base);
  yesterday.setDate(base.getDate() - 1);
  if (date === yesterday.toISOString().split('T')[0]) return lang === 'en' ? 'yesterday' : 'ayer';
  const before = new Date(base);
  before.setDate(base.getDate() - 2);
  if (date === before.toISOString().split('T')[0]) return lang === 'en' ? 'day before' : 'anteayer';
  return new Date(date + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'es-BO', { day: 'numeric', month: 'short' });
}

/**
 * Agrupa gastos (ordenados fecha DESC) por día.
 * Máximo `maxDates` fechas y `maxItems` items en total.
 */
export function groupRecent(
  expenses: Expense[],
  maxDates: number = MAX_RECENT_DATES,
  maxItems: number = MAX_RECENT_ITEMS,
  todayStr?: string,
  lang: 'es' | 'en' = 'es',
): RecentSection[] {
  const sections: RecentSection[] = [];
  let count = 0;
  for (const e of expenses ?? []) {
    if (!e) continue;
    if (count >= maxItems) break;
    let sec = sections.find((s) => s.date === e.date);
    if (!sec) {
      // Orden DESC: lo que sigue es más viejo, se puede cortar.
      if (sections.length >= maxDates) break;
      sec = { date: e.date, label: dayLabel(e.date, lang, todayStr), items: [], totals: {} };
      sections.push(sec);
    }
    sec.items.push(e);
    sec.totals[e.currency] = (sec.totals[e.currency] ?? 0) + (e.amount ?? 0);
    count += 1;
  }
  return sections;
}
