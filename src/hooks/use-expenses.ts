import { useCallback, useEffect, useState } from 'react';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import type { Expense } from '@/expenses/models/Expense';
import { formatMonthRange } from '@/expenses/utils/format';

export function useExpenses(limit: number = 10) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recent, setRecent] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ category: string; currency: string; total: number }[]>([]);
  const [totalMonth, setTotalMonth] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from } = formatMonthRange(new Date());
      const [all, rec, summ] = await Promise.all([
        expenseRepository.getAll(),
        expenseRepository.getRecent(limit),
        expenseRepository.getCategorySummary(from),
      ]);
      const safeAll = all ?? [];
      const safeRec = rec ?? [];
      const safeSumm = summ ?? [];
      setExpenses(safeAll);
      setRecent(safeRec);
      setSummary(safeSumm);
      // Calcular total por moneda
      const totals: Record<string, number> = {};
      for (const s of safeSumm ?? []) {
        if (!s) continue;
        totals[s.currency] = (totals[s.currency] ?? 0) + (s.total ?? 0);
      }
      // Si no hay summary pero hay all, fallback
      if (safeSumm.length === 0 && safeAll.length > 0) {
        for (const e of (safeAll ?? []).filter((x) => x?.date >= from)) {
          if (!e) continue;
          totals[e.currency] = (totals[e.currency] ?? 0) + (e.amount ?? 0);
        }
      }
      setTotalMonth(totals);
    } catch (e) {
      setError((e as Error).message ?? 'Error cargando gastos');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { expenses, recent, summary, totalMonth, loading, error, refresh };
}
