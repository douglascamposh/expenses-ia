import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { budgetRepository } from '@/expenses/repositories/BudgetRepository';
import { ExpenseService } from '@/expenses/services/ExpenseService';
import type { Expense, NewExpense } from '@/expenses/models/Expense';
import type { BudgetProgress, NewBudget } from '@/expenses/models/Budget';
import { formatMonthRange } from '@/expenses/utils/format';
import { getCategoryLabel } from '@/expenses/categories/expenseCategories';
import { parseAnalyticsQuery, resolveScopeRange, scopeLabel } from '@/expenses/analytics/queryIntent';

export type CategorySummary = { category: string; currency: string; total: number };

export const SEMANTIC_MAX_RESULTS = 50;

export type VisibleMonth = { year: number; month: number };

export interface ExpensesState {
  items: Expense[];
  recent: Expense[];
  summary: CategorySummary[];
  totalMonth: Record<string, number>;
  /** Ingresos del mes por moneda (no suman a presupuestos). */
  incomeTotalMonth: Record<string, number>;
  /** Mes visible del dashboard (primer filtro): default = mes actual. */
  visibleMonth: VisibleMonth;
  /** Totales de gastos por mes del año visible: alimentan la tira de meses. */
  monthlyTotals: { month: string; currency: string; total: number }[];
  /** Fecha ISO del gasto más antiguo (acota el selector de año). */
  oldestDate: string | null;
  loading: boolean;
  error: string | null;
  /** Cola de borradores pendientes (voz). Vive en Redux para no perder contexto. */
  pendingQueue: NewExpense[];
  saving: boolean;
  saveError: string | null;
  /** Progreso mensual de presupuestos (límite vs gastado). */
  budgets: BudgetProgress[];
  budgetError: string | null;
  /** Respuesta exacta a pregunta analítica ("cuánto gasté", "gasto más fuerte"). */
  analytics: AnalyticsAnswer | null;
}

export interface AnalyticsAnswer {
  kind: 'total' | 'max';
  /** Suma del período o monto del gasto mayor. */
  value: number;
  currency: string;
  /** Gastos que componen la respuesta (total) o el gasto mayor (max). */
  expenseIds: string[];
  count: number;
  scope: string;
  category: string | null;
  categoryLabel: string | null;
  /** Vista previa del gasto mayor (max). */
  preview: { description: string; date: string } | null;
}

const now = new Date();

const initialState: ExpensesState = {
  items: [],
  recent: [],
  summary: [],
  totalMonth: {},
  incomeTotalMonth: {},
  visibleMonth: { year: now.getFullYear(), month: now.getMonth() + 1 },
  monthlyTotals: [],
  oldestDate: null,
  loading: true,
  error: null,
  pendingQueue: [],
  saving: false,
  saveError: null,
  budgets: [],
  budgetError: null,
  analytics: null,
};

function toSafeArray<T>(v: T[] | null | undefined): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter(Boolean);
}

function computeTotals(summary: CategorySummary[], all: Expense[], from: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of toSafeArray(summary)) {
    if (!s || typeof s.total !== 'number') continue;
    totals[s.currency] = (totals[s.currency] ?? 0) + (s.total ?? 0);
  }
  if (toSafeArray(summary).length === 0 && toSafeArray(all).length > 0) {
    for (const e of toSafeArray(all).filter((x) => x && x.date >= from)) {
      totals[e.currency] = (totals[e.currency] ?? 0) + (e.amount ?? 0);
    }
  }
  return totals;
}

/** Lee SQLite (fuente de verdad) y devuelve snapshot normalizado del mes visible. */
export const fetchExpenses = createAsyncThunk(
  'expenses/fetchAll',
  // limit histórico (número) o mes explícito {year, month}; sin mes usa el visible.
  async (arg: number | VisibleMonth = 10, { getState }) => {
    const fallback = (getState() as { expenses: ExpensesState }).expenses.visibleMonth
      ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const visibleMonth: VisibleMonth =
      typeof arg === 'object' && arg !== null && Number.isFinite(arg.year) && Number.isFinite(arg.month)
        ? { year: arg.year, month: Math.min(12, Math.max(1, arg.month)) }
        : fallback;
    const { from, to } = formatMonthRange(new Date(visibleMonth.year, visibleMonth.month - 1, 1));
    // Totales del año visible para la tira de meses.
    const yearFrom = `${visibleMonth.year}-01-01`;
    const yearTo = `${visibleMonth.year}-12-31`;
    // Recientes: mes visible con ambos kinds (el filtro gastos/ingresos lo aplica la UI).
    const [all, recExp, recInc, summ, incomeSumm, budgets, monthlyTotals, oldestDate] = await Promise.all([
      expenseRepository.getAll(),
      expenseRepository.getByMonthRange(from, to, 'EXPENSE', 30).catch(() => [] as Expense[]),
      expenseRepository.getByMonthRange(from, to, 'INCOME', 30).catch(() => [] as Expense[]),
      expenseRepository.getCategorySummary(from, 'EXPENSE', to),
      expenseRepository.getCategorySummary(from, 'INCOME', to).catch(() => [] as CategorySummary[]),
      budgetRepository.getProgress(from, to).catch(() => [] as BudgetProgress[]),
      expenseRepository.getMonthlyTotals(yearFrom, yearTo).catch(() => [] as { month: string; currency: string; total: number }[]),
      expenseRepository.getOldestDate().catch(() => null as string | null),
    ]);
    const safeAll = toSafeArray<Expense>(all);
    const safeRec = [...toSafeArray<Expense>(recExp), ...toSafeArray<Expense>(recInc)]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);
    const safeSumm = toSafeArray<CategorySummary>(summ);
    const safeIncomeSumm = toSafeArray<CategorySummary>(incomeSumm);
    return {
      items: safeAll,
      recent: safeRec,
      summary: safeSumm,
      totalMonth: computeTotals(safeSumm, safeAll.filter((e) => (e.kind ?? 'EXPENSE') === 'EXPENSE' && e.date >= from && e.date <= to), from),
      incomeTotalMonth: computeTotals(safeIncomeSumm, safeAll.filter((e) => e.kind === 'INCOME' && e.date >= from && e.date <= to), from),
      budgets: toSafeArray<BudgetProgress>(budgets),
      visibleMonth,
      monthlyTotals: toSafeArray(monthlyTotals),
      oldestDate,
    };
  },
);

/** Crea/actualiza el presupuesto mensual de una categoría. */
export const upsertBudget = createAsyncThunk(
  'expenses/upsertBudget',
  async (budget: NewBudget, { dispatch, rejectWithValue }) => {
    if (!budget || typeof budget !== 'object') {
      return rejectWithValue('Presupuesto inválido');
    }
    try {
      const saved = await budgetRepository.upsert({ ...budget });
      await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
      return saved;
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar el presupuesto');
    }
  },
);

/** Elimina el presupuesto de una categoría. */
export const deleteBudget = createAsyncThunk(
  'expenses/deleteBudget',
  async (category: string, { dispatch, rejectWithValue }) => {
    try {
      await budgetRepository.delete(category);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo eliminar el presupuesto');
    }
    await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
    return category;
  },
);

/**
 * Relee SQLite tras una mutación. Un fallo de refresh NO debe reportarse
 * como fallo de guardado (el dato ya está en SQLite): se loguea y el
 * estado `error` del fetch lo muestra con Reintentar.
 */
async function refreshBestEffort(refresh: () => Promise<unknown>) {
  try {
    await refresh();
  } catch (e) {
    if (__DEV__) console.error('[expenses] refresh post-mutación falló:', (e as Error)?.message ?? e);
  }
}

/**
 * Responde preguntas analíticas ("cuánto gasté", "gasto más fuerte") con
 * cálculo exacto desde SQLite. Rechaza si no es analítica.
 */
export const answerAnalytics = createAsyncThunk(
  'expenses/answerAnalytics',
  async (
    { query, currency, periodStartDay }: { query: string; currency: string; periodStartDay?: number | null },
    { rejectWithValue },
  ) => {
    const intent = parseAnalyticsQuery(query ?? '');
    if (!intent) return rejectWithValue('no es analítica');
    const { from, to } = resolveScopeRange(intent.scope, new Date(), periodStartDay ?? null);
    const all = await expenseRepository.getAll().catch(() => [] as Expense[]);
    const inScope = (all ?? []).filter((e) => e && e.date >= from && e.date <= to && e.currency === currency);
    const byCat = intent.category ? inScope.filter((e) => e.category === intent.category) : inScope;
    const words = intent.keywords.map((w) => w.toLowerCase());
    const matching =
      words.length === 0
        ? byCat
        : byCat.filter((e) => {
            const desc = (e.description ?? '').toLowerCase();
            return words.every((w) => desc.includes(w));
          });
    if (intent.metric === 'max') {
      if (matching.length === 0) return rejectWithValue('sin datos');
      const top = [...matching].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
      const answer: AnalyticsAnswer = {
        kind: 'max',
        value: top.amount ?? 0,
        currency,
        expenseIds: [top.id],
        count: 1,
        scope: scopeLabel(intent.scope),
        category: intent.category,
        categoryLabel: intent.category ? getCategoryLabel(intent.category, 'es') : null,
        preview: { description: top.description ?? '', date: top.date ?? '' },
      };
      return answer;
    }
    const total = matching.reduce((a, e) => a + (e.amount ?? 0), 0);
    // Total 0 con filtros estrictos (categoría/keywords): probablemente el filtro
    // fue demasiado estrecho → rechazar para degradar a semántico/keyword en vez
    // de mostrar una lista vacía que oculta coincidencias de texto.
    // Total 0 SIN filtros (p. ej. "total este mes") sí es respuesta válida.
    const constrained = intent.category !== null || words.length > 0;
    if (total === 0 && matching.length === 0 && constrained) {
      return rejectWithValue('sin datos (filtro estricto)');
    }
    const answer: AnalyticsAnswer = {
      kind: 'total',
      value: total,
      currency,
      expenseIds: matching.map((e) => e.id).slice(0, SEMANTIC_MAX_RESULTS),
      count: matching.length,
      scope: scopeLabel(intent.scope),
      category: intent.category,
      categoryLabel: intent.category ? getCategoryLabel(intent.category, 'es') : null,
      preview: null,
    };
    return answer;
  },
);

/**
 * Guarda UN borrador en SQLite.
 * Recibe snapshot {index, draft} desde el modal: no depende de closures
 * ni del estado local del componente, por eso no se pierde el contexto.
 */
export const saveOneExpense = createAsyncThunk(
  'expenses/saveOne',
  async ({ index, draft }: { index: number; draft: NewExpense }, { dispatch, rejectWithValue }) => {
    if (!draft || typeof draft !== 'object' || typeof index !== 'number') {
      return rejectWithValue('Gasto inválido');
    }
    let saved: Expense;
    try {
      const service = new ExpenseService(expenseRepository);
      saved = await service.create({ ...(draft as NewExpense) });
    } catch (e) {
      // La cola se conserva para reintentar
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    // Remover de la cola por índice de forma atómica en el reducer
    dispatch(removePendingAt(index));
    // Releer SQLite como fuente de verdad (best-effort)
    await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
    return saved;
  },
);

/** Guarda TODOS los borradores (secuencial para evitar lock de SQLite). */
export const saveAllExpenses = createAsyncThunk(
  'expenses/saveAll',
  async ({ drafts }: { drafts: NewExpense[] }, { dispatch, rejectWithValue }) => {
    const safe = toSafeArray<NewExpense>(drafts);
    if (safe.length === 0) return rejectWithValue('Nada que guardar');
    const service = new ExpenseService(expenseRepository);
    const failures: string[] = [];
    for (const d of safe) {
      try {
        await service.create({ ...(d as NewExpense) });
      } catch (e) {
        failures.push((e as Error).message ?? 'Error');
      }
    }
    if (failures.length === safe.length) {
      // No se guardó nada: conservar la cola para reintentar
      return rejectWithValue(`No se pudo guardar: ${failures.join('; ')}`);
    }
    dispatch(clearPending());
    await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
    if (failures.length > 0) {
      return rejectWithValue(`Algunos no se guardaron: ${failures.join('; ')}`);
    }
    return safe.length;
  },
);

/**
 * Alta manual: guarda un NewExpense construido en el formulario.
 * No toca pendingQueue; reutiliza saving/saveError para el feedback.
 */
export const createExpense = createAsyncThunk(
  'expenses/createOne',
  async (draft: NewExpense, { dispatch, rejectWithValue }) => {
    if (!draft || typeof draft !== 'object') {
      return rejectWithValue('Gasto inválido');
    }
    let saved: Expense;
    try {
      const service = new ExpenseService(expenseRepository);
      saved = await service.create(JSON.parse(JSON.stringify(draft)) as NewExpense);
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo guardar');
    }
    await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
    return saved;
  },
);

export const deleteExpense = createAsyncThunk('expenses/delete', async (id: string, { dispatch, rejectWithValue }) => {
  try {
    // Borrado lógico: se propaga a la nube como tombstone en el próximo sync.
    await expenseRepository.softDelete(id);
  } catch (e) {
    return rejectWithValue((e as Error).message ?? 'No se pudo eliminar');
  }
  await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
  return id;
});

export const updateExpense = createAsyncThunk(
  'expenses/update',
  async ({ id, patch }: { id: string; patch: Partial<Omit<Expense, 'id' | 'createdAt'>> }, { dispatch, rejectWithValue }) => {
    let updated: Expense | null;
    try {
      updated = await expenseRepository.update(id, patch ?? {});
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo actualizar');
    }
    // Fila inexistente: reportarlo en vez de un no-op silencioso
    if (!updated) return rejectWithValue('Gasto no encontrado');
    await refreshBestEffort(() => dispatch(fetchExpenses(10)).unwrap());
    return updated;
  },
);

const expensesSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    setPendingQueue(state, action: PayloadAction<NewExpense[] | null | undefined>) {
      state.pendingQueue = toSafeArray<NewExpense>(action.payload);
      state.saveError = null;
    },
    updatePendingDraft(state, action: PayloadAction<{ index: number; patch: Partial<NewExpense> }>) {
      const { index, patch } = action.payload ?? {};
      const q = toSafeArray<NewExpense>(state.pendingQueue);
      if (typeof index !== 'number' || !patch || !q[index]) return;
      q[index] = { ...q[index], ...patch };
      state.pendingQueue = q;
    },
    removePendingAt(state, action: PayloadAction<number>) {
      const idx = action.payload;
      const q = toSafeArray<NewExpense>(state.pendingQueue);
      state.pendingQueue = q.filter((_, i) => i !== idx);
    },
    clearPending(state) {
      state.pendingQueue = [];
      state.saveError = null;
    },
    clearSaveError(state) {
      state.saveError = null;
    },
    clearSemanticSearch(state) {
      // Solo queda limpiar la respuesta analítica (la semántica se eliminó).
      state.analytics = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExpenses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        state.loading = false;
        state.items = toSafeArray(action.payload.items);
        state.recent = toSafeArray(action.payload.recent);
        state.summary = toSafeArray(action.payload.summary);
        state.totalMonth = action.payload.totalMonth ?? {};
        state.incomeTotalMonth = action.payload.incomeTotalMonth ?? {};
        state.budgets = toSafeArray(action.payload.budgets);
        state.visibleMonth = action.payload.visibleMonth;
        state.monthlyTotals = toSafeArray(action.payload.monthlyTotals);
        state.oldestDate = action.payload.oldestDate;
        state.error = null;
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.error.message as string) ?? 'Error cargando gastos';
        // Nunca dejar nulls: mantener arrays previos o []
        state.items = toSafeArray(state.items);
        state.recent = toSafeArray(state.recent);
        state.summary = toSafeArray(state.summary);
        state.budgets = toSafeArray(state.budgets);
      })
      .addCase(saveOneExpense.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(saveOneExpense.fulfilled, (state) => {
        state.saving = false;
        state.saveError = null;
      })
      .addCase(saveOneExpense.rejected, (state, action) => {
        state.saving = false;
        state.saveError = (action.payload as string) ?? action.error.message ?? 'No se pudo guardar';
      })
      .addCase(saveAllExpenses.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(saveAllExpenses.fulfilled, (state) => {
        state.saving = false;
        state.saveError = null;
      })
      .addCase(saveAllExpenses.rejected, (state, action) => {
        state.saving = false;
        state.saveError = (action.payload as string) ?? action.error.message ?? 'No se pudo guardar';
      })
      .addCase(createExpense.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(createExpense.fulfilled, (state) => {
        state.saving = false;
        state.saveError = null;
      })
      .addCase(createExpense.rejected, (state, action) => {
        state.saving = false;
        state.saveError = (action.payload as string) ?? action.error.message ?? 'No se pudo guardar';
      })
      .addCase(upsertBudget.pending, (state) => {
        state.saving = true;
        state.budgetError = null;
      })
      .addCase(upsertBudget.fulfilled, (state) => {
        state.saving = false;
        state.budgetError = null;
      })
      .addCase(upsertBudget.rejected, (state, action) => {
        state.saving = false;
        state.budgetError = (action.payload as string) ?? action.error.message ?? 'No se pudo guardar el presupuesto';
      })
      .addCase(deleteBudget.fulfilled, (state) => {
        state.budgetError = null;
      })
      .addCase(deleteBudget.rejected, (state, action) => {
        state.budgetError = (action.payload as string) ?? action.error.message ?? 'No se pudo eliminar el presupuesto';
      })
      .addCase(deleteExpense.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(updateExpense.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error.message ?? 'No se pudo actualizar';
      })
      .addCase(answerAnalytics.fulfilled, (state, action) => {
        state.analytics = { ...action.payload };
      })
      .addCase(answerAnalytics.rejected, (state) => {
        state.analytics = null;
      });
  },
});

export const { setPendingQueue, updatePendingDraft, removePendingAt, clearPending, clearSaveError, clearSemanticSearch } = expensesSlice.actions;
export default expensesSlice.reducer;
