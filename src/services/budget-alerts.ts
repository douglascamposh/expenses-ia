import * as Notifications from 'expo-notifications';
import { SETTING_KEYS, settingsRepository } from '@/expenses/repositories/SettingsRepository';
import type { BudgetProgress } from '@/expenses/models/Budget';

export type BudgetGroup = { currency: string; spent: number; limit: number; pct: number };

/** Agrupa presupuestos por moneda con su % gastado (límite > 0). */
export function groupBudgets(budgets: BudgetProgress[]): BudgetGroup[] {
  const map = new Map<string, { spent: number; limit: number }>();
  for (const b of budgets ?? []) {
    if (!b || !(b.limit > 0)) continue;
    const prev = map.get(b.currency) ?? { spent: 0, limit: 0 };
    prev.spent += b.spent ?? 0;
    prev.limit += b.limit ?? 0;
    map.set(b.currency, prev);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.limit > 0)
    .map(([currency, v]) => ({ currency, spent: v.spent, limit: v.limit, pct: v.spent / v.limit }));
}

/** Grupos que alcanzaron el umbral (%). */
export function groupsCrossing(groups: BudgetGroup[], threshold: number): BudgetGroup[] {
  return groups.filter((g) => g.pct * 100 >= threshold);
}

/** Marca anti-spam: mes + umbral + moneda (cambiar cualquiera rearma). */
export function notifiedKey(monthKey: string, threshold: number, currency: string): string {
  return `${monthKey}:${threshold}:${currency}`;
}

export async function wasNotified(key: string): Promise<boolean> {
  try {
    const marker = await settingsRepository.get(SETTING_KEYS.budgetAlertNotified).catch(() => null);
    return marker === key;
  } catch {
    return false;
  }
}

export async function markNotified(key: string): Promise<void> {
  try {
    await settingsRepository.set(SETTING_KEYS.budgetAlertNotified, key);
  } catch {
    // Mejor esfuerzo: sin marca podría repetirse, sin romper nada.
  }
}

/** Pide permiso de notificaciones (al activar las alertas). */
export async function ensurePermissions(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** Notificación local inmediata (sin servidor; requiere development build). */
export async function notifyBudgetAlert(title: string, body: string): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
    return true;
  } catch {
    return false;
  }
}
