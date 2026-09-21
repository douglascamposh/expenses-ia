import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  SYSTEM_CATEGORY,
  isUserCategory,
  setCustomCategories,
  type CategoryConfig,
} from '@/expenses/categories/expenseCategories';
import { categoryRepository, type CustomCategoryInput } from '@/expenses/repositories/CategoryRepository';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { budgetRepository } from '@/expenses/repositories/BudgetRepository';

export interface CategoriesState {
  /** Solo personalizadas (las 13 por defecto siempre existen). */
  custom: CategoryConfig[];
  loaded: boolean;
  error: string | null;
}

const initialState: CategoriesState = {
  custom: [],
  loaded: false,
  error: null,
};

function syncRegistry(list: CategoryConfig[]): void {
  try {
    setCustomCategories(list);
  } catch {
    // nunca debe romper el flujo
  }
}

/** Lee las personalizadas y actualiza el registro usado por validación/pickers. */
export const fetchCategories = createAsyncThunk('categories/fetch', async () => {
  const list = await categoryRepository.getCustom().catch(() => [] as CategoryConfig[]);
  syncRegistry(list);
  return list;
});

/** Estado previo para no vaciar nada si la re-lectura falla tras mutar. */
function prevCustom(getState: unknown): CategoryConfig[] {
  return (getState as { categories?: { custom?: CategoryConfig[] } })?.categories?.custom ?? [];
}

/**
 * Re-lee tras mutar sin perder datos: si getCustom falla, se parte del
 * estado previo; y la categoría mutada siempre queda incluida (así el
 * registro/pickers nunca la pierden aunque la lectura falle).
 */
async function freshList(
  getState: unknown,
  ensure?: CategoryConfig,
  removeId?: string,
): Promise<CategoryConfig[]> {
  let list: CategoryConfig[];
  try {
    list = await categoryRepository.getCustom();
  } catch {
    list = [...prevCustom(getState)];
  }
  if (removeId) list = list.filter((c) => c && String(c.id) !== String(removeId));
  if (ensure) {
    if (list.some((c) => c && String(c.id) === String(ensure.id))) {
      list = list.map((c) => (c && String(c.id) === String(ensure.id) ? ensure : c));
    } else {
      list = [ensure, ...list];
    }
  }
  return list;
}

export const createCategory = createAsyncThunk(
  'categories/create',
  async (input: CustomCategoryInput, { getState, rejectWithValue }) => {
    try {
      const created = await categoryRepository.create(input);
      const list = await freshList(getState, created);
      syncRegistry(list);
      return list;
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo crear la categoría');
    }
  },
);

export const updateCategory = createAsyncThunk(
  'categories/update',
  async ({ id, input }: { id: string; input: CustomCategoryInput }, { getState, rejectWithValue }) => {
    if (!isUserCategory(id)) {
      return rejectWithValue('Las categorías del sistema no se pueden editar');
    }
    try {
      const updated = await categoryRepository.update(id, input);
      const list = await freshList(getState, updated);
      syncRegistry(list);
      return list;
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo actualizar la categoría');
    }
  },
);

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async (id: string, { getState, rejectWithValue }) => {
    if (String(id) === String(SYSTEM_CATEGORY.id)) {
      return rejectWithValue('La categoría del sistema no se puede eliminar');
    }
    if (!isUserCategory(id)) {
      return rejectWithValue('Las categorías del sistema no se pueden eliminar');
    }
    try {
      // Guarda: no eliminar si tiene gastos o presupuestos
      const [all, budgets] = await Promise.all([
        expenseRepository.getAll().catch(() => []),
        budgetRepository.getAll().catch(() => []),
      ]);
      if ((all ?? []).some((e) => e && String(e.category) === String(id))) {
        return rejectWithValue('Tiene gastos registrados y no se puede eliminar');
      }
      if ((budgets ?? []).some((b) => b && String(b.category) === String(id))) {
        return rejectWithValue('Tiene presupuesto y no se puede eliminar');
      }
      await categoryRepository.delete(id);
      const list = await freshList(getState, undefined, id);
      syncRegistry(list);
      return list;
    } catch (e) {
      return rejectWithValue((e as Error).message ?? 'No se pudo eliminar la categoría');
    }
  },
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.custom = [...(action.payload ?? [])];
        state.loaded = true;
        state.error = null;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.custom = [...(action.payload ?? [])];
        state.error = null;
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error.message ?? 'No se pudo crear';
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.custom = [...(action.payload ?? [])];
        state.error = null;
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error.message ?? 'No se pudo actualizar';
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.custom = [...(action.payload ?? [])];
        state.error = null;
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error.message ?? 'No se pudo eliminar';
      });
  },
});

export default categoriesSlice.reducer;
