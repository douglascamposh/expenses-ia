import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { recurringRepository } from '@/expenses/repositories/RecurringRepository';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { draftToRuleInput, generateDueRecurrences } from '@/expenses/services/recurring';
import type { NewRecurringRule, RecurringRule } from '@/expenses/models/Recurring';
import { isValidCategory } from '@/expenses/categories/expenseCategories';
import { isValidCurrency, type Expense, type NewExpense } from '@/expenses/models/Expense';
import { fetchExpenses } from './expensesSlice';

export interface RecurringState {
  rules: RecurringRule[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  /** Cuántos generados en la última corrida (toast informativo). */
  lastGeneratedCount: number;
}

const initialState: RecurringState = {
  rules: [],
  loading: false,
  error: null,
  saving: false,
  saveError: null,
  lastGeneratedCount: 0,
};

function toSafeRules(v: RecurringRule[] | null | undefined): RecurringRule[] {
  if (!Array.isArray(v)) return [];
  return v.filter(Boolean);
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function newExpenseId(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const fetchRules = createAsyncThunk('recurring/fetchAll', async () => {
  const list = await recurringRepository.getAll().catch(() => [] as RecurringRule[]);
  return toSafeRules(list);
});

function validateRuleInput(input: NewRecurringRule): string | null {
  if (!input || typeof input !== 'object') return 'Regla inválida';
  if (typeof input.amount !== 'number' || isNaN(input.amount) || !isFinite(input.amount) || input.amount <= 0) {
    return 'El monto debe ser mayor a 0';
  }
  if (!input.description || String(input.description).trim().length < 2) return 'La descripción es requerida';
  if (!input.currency || !isValidCurrency(String(input.currency))) return 'Moneda inválida';
  if (!input.category || !isValidCategory(String(input.category))) return 'Categoría inválida';
  if (!input.startDate || isNaN(new Date(String(input.startDate)).getTime())) return 'Fecha inválida';
  return null;
}

export const createRule = createAsyncThunk(
  'recurring/create',
  async (input: NewRecurringRule, { rejectWithValue }) => {
    const err = validateRuleInput(input);
    if (err) return rejectWithValue(err);
    try {
      const rule = await recurringRepository.create(input);
      const list = await recurringRepository.getAll().catch(() => [] as RecurringRule[]);
      return { rule, list: toSafeRules(list) };
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo crear la regla');
    }
  },
);

export const updateRule = createAsyncThunk(
  'recurring/update',
  async ({ id, patch }: { id: string; patch: Partial<Omit<RecurringRule, 'id' | 'createdAt'>> }, { rejectWithValue }) => {
    try {
      const rule = await recurringRepository.update(id, patch);
      if (!rule) return rejectWithValue('Regla no encontrada');
      const list = await recurringRepository.getAll().catch(() => [] as RecurringRule[]);
      return { rule, list: toSafeRules(list) };
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo actualizar la regla');
    }
  },
);

export const removeRule = createAsyncThunk(
  'recurring/remove',
  async (id: string, { rejectWithValue }) => {
    try {
      await recurringRepository.remove(id);
      const list = await recurringRepository.getAll().catch(() => [] as RecurringRule[]);
      return toSafeRules(list);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo eliminar la regla');
    }
  },
);

/**
 * Guarda borrador con recurrencia: regla primero y gasto actual con su id.
 * Si falla el gasto, se revierte la regla (una sola transacción lógica).
 */
export const saveRecurringDraft = createAsyncThunk(
  'recurring/saveDraft',
  async (draft: NewExpense, { dispatch, rejectWithValue }) => {
  const freq = draft.recurrence ?? 'ONCE';
  if (freq === 'ONCE') return rejectWithValue('Sin recurrencia');
  const day = new Date(`${draft.date}T00:00:00`);
  if (isNaN(day.getTime())) return rejectWithValue('Fecha inválida');
  const now = new Date().toISOString();
  const ruleInput = draftToRuleInput(draft);
    const err = validateRuleInput(ruleInput);
    if (err) return rejectWithValue(err);
    let rule: RecurringRule;
    try {
      rule = await recurringRepository.create(ruleInput);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo crear la regla');
    }
    const expense: Expense = {
      id: newExpenseId(),
      amount: rule.amount,
      currency: rule.currency,
      category: rule.category,
      kind: rule.kind,
      description: rule.description,
      date: rule.startDate,
      paymentMethod: rule.paymentMethod,
      createdAt: now,
      updatedAt: now,
      recurringId: rule.id,
    };
    try {
      await expenseRepository.create(expense);
    } catch (e) {
      await recurringRepository.remove(rule.id).catch(() => {});
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar el gasto');
    }
    await dispatch(fetchExpenses(10)).unwrap().catch(() => {});
    const list = await recurringRepository.getAll().catch(() => [] as RecurringRule[]);
    return { rule, expense, list: toSafeRules(list) };
  },
);

/**
 * Materializa vencidos al abrir la app. Idempotente por periodKey
 * (regla + fecha) y con tope del motor.
 */
export const generateRecurrences = createAsyncThunk('recurring/generate', async (_, { dispatch }) => {
  const today = todayISO();
  const rules = await recurringRepository.getActive().catch(() => [] as RecurringRule[]);
  const existing = await expenseRepository.getAll().catch(() => [] as Expense[]);
  const existingKeys = new Set(
    (existing ?? [])
      .filter((e) => e && e.recurringId && e.date)
      .map((e) => `${e.recurringId as string}:${e.date}`),
  );
  const { occurrences, updates } = generateDueRecurrences(rules, today, existingKeys);
  let created = 0;
  const byRule = new Map(rules.map((r) => [r.id, r]));
  for (const occ of occurrences) {
    const rule = byRule.get(occ.ruleId);
    if (!rule) continue;
    const now = new Date().toISOString();
    try {
      await expenseRepository.create({
        id: `exp_${occ.periodKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
        amount: rule.amount,
        currency: rule.currency,
        category: rule.category,
        kind: rule.kind,
        description: rule.description,
        date: occ.date,
        paymentMethod: rule.paymentMethod,
        createdAt: now,
        updatedAt: now,
        recurringId: rule.id,
      });
      created += 1;
    } catch {
      // Un período fallido no frena los demás.
    }
  }
  for (const u of updates) {
    await recurringRepository.update(u.id, { lastGenerated: u.lastGenerated ?? today }).catch(() => {});
  }
  if (created > 0) {
    await dispatch(fetchExpenses(10)).unwrap().catch(() => {});
  }
  const list = await recurringRepository.getAll().catch(() => [] as RecurringRule[]);
  return { created, list: toSafeRules(list) };
});

const recurringSlice = createSlice({
  name: 'recurring',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRules.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRules.fulfilled, (state, action) => {
        state.loading = false;
        state.rules = toSafeRules(action.payload);
        state.error = null;
      })
      .addCase(fetchRules.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.error.message as string) ?? 'Error cargando reglas';
        state.rules = toSafeRules(state.rules);
      })
      .addCase(createRule.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(createRule.fulfilled, (state, action) => {
        state.saving = false;
        state.rules = toSafeRules(action.payload.list);
        state.saveError = null;
      })
      .addCase(createRule.rejected, (state, action) => {
        state.saving = false;
        state.saveError = (action.payload as string) ?? action.error.message ?? 'No se pudo guardar';
      })
      .addCase(updateRule.fulfilled, (state, action) => {
        state.rules = toSafeRules(action.payload.list);
        state.saveError = null;
      })
      .addCase(updateRule.rejected, (state, action) => {
        state.saveError = (action.payload as string) ?? action.error.message ?? 'No se pudo actualizar';
      })
      .addCase(removeRule.fulfilled, (state, action) => {
        state.rules = toSafeRules(action.payload);
      })
      .addCase(saveRecurringDraft.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(saveRecurringDraft.fulfilled, (state, action) => {
        state.saving = false;
        state.rules = toSafeRules(action.payload.list);
        state.saveError = null;
      })
      .addCase(saveRecurringDraft.rejected, (state, action) => {
        state.saving = false;
        state.saveError = (action.payload as string) ?? action.error.message ?? 'No se pudo guardar';
      })
      .addCase(generateRecurrences.fulfilled, (state, action) => {
        state.rules = toSafeRules(action.payload.list);
        state.lastGeneratedCount = action.payload.created;
      });
  },
});

export default recurringSlice.reducer;
