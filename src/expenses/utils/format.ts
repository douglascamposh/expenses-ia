import type { Currency } from '../models/Expense';
import type { Lang } from '@/i18n/translations';

const currencySymbols: Record<Currency, string> = {
  BOB: 'Bs',
  USD: '$',
  EUR: '€',
  ARS: '$',
  BRL: 'R$',
  CLP: '$',
  COP: '$',
  MXN: '$',
  PEN: 'S/',
  PYG: '₲',
  UYU: '$U',
};

export function getCurrencySymbol(currency: Currency): string {
  return currencySymbols[currency] ?? currency;
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = currencySymbols[currency] ?? currency;
  const formatted = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${symbol} ${formatted}`;
}

const LOCALES: Record<Lang, string> = { es: 'es-BO', en: 'en-US', pt: 'pt-BR' };

export function formatDateLabel(date: string, lang: Lang = 'es'): string {
  // date: YYYY-MM-DD
  const d = new Date(date + 'T12:00:00');
  const today = new Date();
  const todayStr = todayLocalISO(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = todayLocalISO(yesterday);
  if (date === todayStr) return lang === 'en' ? 'Today' : lang === 'pt' ? 'Hoje' : 'Hoy';
  if (date === yStr) return lang === 'en' ? 'Yesterday' : lang === 'pt' ? 'Ontem' : 'Ayer';
  return d.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short' });
}

export function formatMonthLabel(date: Date = new Date(), lang: Lang = 'es'): string {
  return date.toLocaleDateString(LOCALES[lang], { month: 'long', year: 'numeric' });
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * YYYY-MM-DD con la zona horaria del sistema (NO UTC).
 * `toISOString()` es UTC: en Bolivia (UTC-4) guardar de noche fechaba "mañana".
 * Todo lo que el usuario ve como "hoy" debe usar esto.
 */
export function todayLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatMonthRange(date: Date = new Date()): { from: string; to: string } {
  const from = todayLocalISO(new Date(date.getFullYear(), date.getMonth(), 1));
  const to = todayLocalISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { from, to };
}
