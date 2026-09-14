import type { Currency } from '../models/Expense';

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

export function formatDateLabel(date: string, lang: 'es' | 'en' = 'es'): string {
  // date: YYYY-MM-DD
  const d = new Date(date + 'T12:00:00');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  if (date === todayStr) return lang === 'en' ? 'Today' : 'Hoy';
  if (date === yStr) return lang === 'en' ? 'Yesterday' : 'Ayer';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-BO', { day: 'numeric', month: 'short' });
}

export function formatMonthLabel(date: Date = new Date(), lang: 'es' | 'en' = 'es'): string {
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-BO', { month: 'long', year: 'numeric' });
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export function formatMonthRange(date: Date = new Date()): { from: string; to: string } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}
