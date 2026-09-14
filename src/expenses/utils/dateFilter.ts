export type DateFilter = 'all' | 'today' | 'week' | 'month';

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];

/** Filtros con etiqueta localizada (por defecto español). */
export function getDateFilters(lang: 'es' | 'en' = 'es'): { id: DateFilter; label: string }[] {
  if (lang === 'en') {
    return [
      { id: 'all', label: 'All' },
      { id: 'today', label: 'Today' },
      { id: 'week', label: 'This week' },
      { id: 'month', label: 'This month' },
    ];
  }
  return DATE_FILTERS;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** true si el YYYY-MM-DD cae dentro del filtro (comparación por strings ISO). */
export function inDateFilter(date: string, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const today = new Date();
  const todayStr = toISODate(today);
  if (filter === 'today') return date === todayStr;
  if (filter === 'month') return date.slice(0, 7) === todayStr.slice(0, 7);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  return date >= toISODate(weekAgo) && date <= todayStr;
}
