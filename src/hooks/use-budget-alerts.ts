import { useEffect, useRef } from 'react';
import {
  groupBudgets,
  groupsCrossing,
  markNotified,
  notifiedKey,
  notifyBudgetAlert,
  wasNotified,
} from '@/services/budget-alerts';
import { formatMonthLabel, getCurrencySymbol } from '@/expenses/utils/format';
import type { Currency } from '@/expenses/models/Expense';
import { useAppSelector } from '@/store/hooks';
import { useTranslation } from '@/i18n/useTranslation';

/**
 * Evalúa los presupuestos del mes y dispara una notificación local cuando
 * el gasto alcanza el umbral del usuario (una vez por mes/umbral/moneda).
 * Vive en el Dashboard (siempre montado) para alertar aunque no se abra
 * la pantalla de presupuestos. En Expo Go (sin módulo nativo) usa el
 * fallback en-app vía onFallback.
 */
export function useBudgetAlerts(onFallback?: (title: string, body: string) => void) {
  const { t, lang } = useTranslation();
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const visibleMonth = useAppSelector((s) => s.expenses.visibleMonth);
  const enabled = useAppSelector((s) => s.settings.budgetAlertsEnabled ?? false);
  const threshold = useAppSelector((s) => s.settings.budgetAlertThreshold ?? 80);
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  useEffect(() => {
    if (!enabled || (budgets ?? []).length === 0) return;
    const timer = setTimeout(() => {
      void (async () => {
        const crossing = groupsCrossing(groupBudgets(budgets), threshold);
        if (crossing.length === 0) return;
        const monthKey = `${visibleMonth.year}-${String(visibleMonth.month).padStart(2, '0')}`;
        const monthLabel = formatMonthLabel(new Date(visibleMonth.year, visibleMonth.month - 1, 1), lang);
        for (const g of crossing) {
          const key = notifiedKey(monthKey, threshold, g.currency);
          if (await wasNotified(key)) continue;
          const symbol = getCurrencySymbol(g.currency as Currency);
          const title = t('budgets_notifTitle');
          const body = t('budgets_notifBody', {
            n: Math.round(g.pct * 100),
            month: monthLabel,
            amounts: `${symbol} ${Math.round(g.spent)} / ${Math.round(g.limit)}`,
          });
          const ok = await notifyBudgetAlert(title, body);
          if (ok) {
            await markNotified(key);
          } else {
            // Sin push nativa (p. ej. Expo Go): alerta visible en-app, una vez.
            await markNotified(key);
            onFallbackRef.current?.(title, body);
          }
        }
      })();
    }, 800);
    return () => clearTimeout(timer);
  }, [budgets, enabled, threshold, visibleMonth, lang, t]);
}
