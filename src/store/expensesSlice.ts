import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { ExpenseService } from '@/expenses/services/ExpenseService';
import type { Expense, NewExpense } from '@/expenses/models/Expense';
import { formatMonthRange } from '@/expenses/utils/format';

export type CategorySummary = { category: string; currency: string; total: number };

export interface ExpensesState {
  items: Expense[];
  recent: Expense[];
  summary: CategorySummary[];
  totalMonth: Record<string, number>;
  loading: boolean;
  error: string | null;
  /** Cola de borradores pendientes (voz). Vive en Redux para no perder contexto. */
  pendingQueue: NewExpense[];
  saving: boolean;
  saveError: string | null;
}

const initialState: ExpensesState = {
  items: [],
  recent: [],
  summary: [],
  totalMonth: {},
  loading: true,
  error: null,
  pendingQueue: [],
  saving: false,
  saveError: null,
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

/** Lee SQLite (fuente de verdad) y devuelve snapshot normalizado. */
export const fetchExpenses = createAsyncThunk(
  'expenses/fetchAll',
  async (limit: number = 10) => {
    const { from } = formatMonthRange(new Date());
    const [all, rec, summ] = await Promise.all([
      expenseRepository.getAll(),
      expenseRepository.getRecent(limit),
      expenseRepository.getCategorySummary(from),
    ]);
    const safeAll = toSafeArray<Expense>(all);
    const safeRec = toSafeArray<Expense>(rec);
    const safeSumm = toSafeArray<CategorySummary>(summ);
    return {
      items: safeAll,
      recent: safeRec,
      summary: safeSumm,
      totalMonth: computeTotals(safeSumm, safeAll, from),
    };
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

export const deleteExpense = createAsyncThunk('expenses/delete', async (id: string, { dispatch, rejectWithValue }) => {
  try {
    await expenseRepository.delete(id);
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
        state.error = null;
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.error.message as string) ?? 'Error cargando gastos';
        // Nunca dejar nulls: mantener arrays previos o []
        state.items = toSafeArray(state.items);
        state.recent = toSafeArray(state.recent);
        state.summary = toSafeArray(state.summary);
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
      .addCase(deleteExpense.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(updateExpense.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error.message ?? 'No se pudo actualizar';
      });
  },
});

export const { setPendingQueue, updatePendingDraft, removePendingAt, clearPending, clearSaveError } = expensesSlice.actions;
export default expensesSlice.reducer;
