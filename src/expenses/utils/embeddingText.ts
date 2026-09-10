import { getCategoryLabel } from '../categories/expenseCategories';
import type { AppLang, PaymentMethod } from '../models/Expense';

type EmbeddableExpense = {
  description?: string | null;
  category?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: PaymentMethod | null;
};

const PAID_PHRASE: Record<PaymentMethod, Record<AppLang, string>> = {
  CASH: { es: 'pagado en efectivo', en: 'paid in cash' },
  CARD: { es: 'pagado con tarjeta', en: 'paid by card' },
};

/**
 * Texto compuesto para embeddings en un idioma:
 * "description category amount currency paid-phrase".
 * El método de pago viaja en el idioma del texto para que queries
 * como "gastos en efectivo" o "paid by card" recuperen el gasto.
 */
export function buildEmbeddingText(expense: EmbeddableExpense, lang: AppLang = 'es'): string {
  const method: PaymentMethod = expense.paymentMethod ?? 'CASH';
  const parts = [
    expense.description?.trim() || undefined,
    getCategoryLabel(expense.category ?? 'OTHER', lang),
    `${expense.amount ?? 0} ${expense.currency ?? ''}`.trim(),
    PAID_PHRASE[method]?.[lang] ?? PAID_PHRASE.CASH[lang],
  ].filter((p) => p && p.length > 0);
  return parts.join(' ');
}

/**
 * Texto bilingüe (ES + EN) para un solo vector por gasto.
 * Los modelos multilingües recuperan queries en ambos idiomas;
 * añadir un idioma futuro = agregar plantilla + re-embed, sin migrar SQLite.
 */
export function buildBilingualEmbeddingText(expense: EmbeddableExpense): string {
  return `${buildEmbeddingText(expense, 'es')} / ${buildEmbeddingText(expense, 'en')}`;
}
