import { ExpenseCategory, isValidCategory } from '../categories/expenseCategories';
import type { Expense, NewExpense } from '../models/Expense';
import { isValidCurrency } from '../models/Expense';
import type { ExpenseRepository } from '../repositories/ExpenseRepository';

export type ValidationResult = { valid: boolean; errors: string[] };

export function validateExpenseCommand(input: unknown): { valid: boolean; errors: string[]; normalized?: NewExpense } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Invalid command'] };
  }
  const obj = input as Record<string, unknown>;

  // Soporta dos formatos: { action: "CREATE_EXPENSE", expense: {...} } y directo { amount, category... }
  let expenseRaw: Record<string, unknown> | null = null;
  let action: string | undefined;

  if ('action' in obj && 'expense' in obj) {
    action = obj.action as string;
    expenseRaw = obj.expense as Record<string, unknown>;
    if (action !== 'CREATE_EXPENSE') errors.push('action debe ser CREATE_EXPENSE');
  } else if ('amount' in obj) {
    expenseRaw = obj;
  } else {
    errors.push('Missing action/expense');
  }

  if (!expenseRaw) return { valid: false, errors };

  const amount = expenseRaw.amount;
  const currency = expenseRaw.currency as string | undefined;
  const category = expenseRaw.category as string | undefined;
  const description = expenseRaw.description as string | undefined;
  const date = expenseRaw.date as string | undefined;
  const confidence = expenseRaw.confidence as number | undefined;

  if (amount === undefined || amount === null) errors.push('amount es requerido');
  else if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) errors.push('amount debe ser número válido');
  else if (amount <= 0) errors.push('amount debe ser > 0');

  if (!currency) errors.push('currency es requerida');
  else if (!isValidCurrency(String(currency))) errors.push('currency debe ser BOB, USD o EUR');

  if (!category) errors.push('category es requerida');
  else if (!isValidCategory(String(category))) errors.push(`category inválida: ${category}`);

  if (!description || String(description).trim().length === 0) errors.push('description es requerida');
  else if (String(description).trim().length < 2) errors.push('description muy corta');

  if (!date) errors.push('date es requerida');
  else {
    const d = new Date(String(date));
    if (isNaN(d.getTime())) errors.push('date inválida');
    else {
      // Normalizar a YYYY-MM-DD
      const iso = String(date);
      if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) {
        // intentar normalizar, pero marcar error si no es parseable a YYYY-MM-DD
        // aceptamos cualquier ISO, la UI generará YYYY-MM-DD
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Normalizar date a YYYY-MM-DD
  let normalizedDate = String(date);
  if (normalizedDate.includes('T')) normalizedDate = normalizedDate.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const d = new Date(String(date));
    normalizedDate = d.toISOString().split('T')[0];
  }

  const normalized: NewExpense = {
    amount: amount as number,
    currency: String(currency) as NewExpense['currency'],
    category: String(category) as ExpenseCategory,
    description: String(description).trim(),
    date: normalizedDate,
    confidence: typeof confidence === 'number' ? confidence : undefined,
  };

  return { valid: true, errors: [], normalized };
}

export function expenseCommandToNewExpense(input: unknown): NewExpense {
  const res = validateExpenseCommand(input);
  if (!res.valid || !res.normalized) throw new Error(res.errors.join(', '));
  return res.normalized;
}

export class ExpenseService {
  constructor(private repo: ExpenseRepository) {}

  async createFromCommand(command: unknown): Promise<Expense> {
    const validation = validateExpenseCommand(command);
    if (!validation.valid || !validation.normalized) {
      throw new Error(validation.errors.join(', '));
    }
    const now = new Date().toISOString();
    const expense: Expense = {
      id: generateId(),
      ...validation.normalized,
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.create(expense);
  }

  async create(expense: NewExpense): Promise<Expense> {
    if (!expense || typeof expense !== 'object') {
      throw new Error('Expense inválido');
    }
    // NewExpense directo es el caso normal desde UI; validar directo primero
    const direct = validateExpenseCommand(expense);
    if (direct.valid && direct.normalized) {
      const now = new Date().toISOString();
      const e: Expense = {
        id: generateId(),
        ...(direct.normalized as NewExpense),
        createdAt: now,
        updatedAt: now,
      };
      return this.repo.create(e);
    }
    // Fallback: soportar { expense: {...} } legado si viene envuelto
    const wrapped = validateExpenseCommand({ action: 'CREATE_EXPENSE', expense });
    if (wrapped.valid && wrapped.normalized) {
      const now = new Date().toISOString();
      const e: Expense = {
        id: generateId(),
        ...(wrapped.normalized as NewExpense),
        createdAt: now,
        updatedAt: now,
      };
      return this.repo.create(e);
    }
    throw new Error((direct.errors ?? []).join(', ') || 'Expense inválido');
  }
}

function generateId(): string {
  // UUID v4 simple sin librería extra
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
