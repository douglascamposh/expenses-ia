import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  clearPending,
  fetchExpenses,
  saveAllExpenses,
  saveOneExpense,
  setPendingQueue,
} from '../expensesSlice';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { InMemoryExpenseRepository } from '@/expenses/repositories/ExpenseRepository';

// Usar repo en memoria pinchado sobre el singleton SQLite
const mem = new InMemoryExpenseRepository();
const sqlite = expenseRepository as unknown as Record<string, unknown>;
const orig = { ...sqlite };

function bindMemory() {
  (expenseRepository as unknown as InMemoryExpenseRepository).create = mem.create.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getAll = mem.getAll.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getRecent = mem.getRecent.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getCategorySummary = mem.getCategorySummary.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).delete = mem.delete.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).update = mem.update.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).clearAll = mem.clearAll.bind(mem);
}

function makeStore() {
  return configureStore({ reducer: { expenses: reducer }, middleware: (g) => g({ serializableCheck: false }) });
}

beforeEach(async () => {
  bindMemory();
  await mem.clearAll();
});

afterAll(() => {
  Object.assign(sqlite, orig);
});

describe('expenses slice único (SQLite fuente de verdad)', () => {
  it('setPendingQueue nunca deja null (regresión forEach of null)', () => {
    const store = makeStore();
    store.dispatch(setPendingQueue(null as unknown as []));
    expect(store.getState().expenses.pendingQueue).toEqual([]);
    store.dispatch(setPendingQueue(undefined as unknown as []));
    expect(store.getState().expenses.pendingQueue).toEqual([]);
  });

  it('saveOne guarda en SQLite, remueve de la cola y refresca', async () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07' },
      ]),
    );
    const draft = store.getState().expenses.pendingQueue[0];
    const saved = await store.dispatch(saveOneExpense({ index: 0, draft: { ...draft } })).unwrap();
    expect(saved.id).toBeDefined();
    // Cola vacía sin nulls
    expect(store.getState().expenses.pendingQueue).toEqual([]);
    // SQLite contiene el gasto (recuperable)
    const all = await mem.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].description).toBe('Comida');
    // Redux refrescado desde SQLite
    expect(store.getState().expenses.items).toHaveLength(1);
    expect(store.getState().expenses.saving).toBe(false);
  });

  it('saveOne con draft inválido no crashea, reporta saveError', async () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([{ amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Gasto X', date: '2026-09-07' }]),
    );
    await expect(store.dispatch(saveOneExpense({ index: 0, draft: null as never })).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.saveError).toBeTruthy();
    // La cola se conserva para reintentar
    expect(store.getState().expenses.pendingQueue).toHaveLength(1);
  });

  it('saveAll guarda varios y limpia', async () => {
    const store = makeStore();
    const drafts: NewExpense[] = [
      { amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07' },
      { amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Taxi centro', date: '2026-09-07' },
    ];
    const n = await store.dispatch(saveAllExpenses({ drafts: drafts.map((d) => ({ ...d })) })).unwrap();
    expect(n).toBe(2);
    expect(store.getState().expenses.pendingQueue).toEqual([]);
    expect((await mem.getAll())).toHaveLength(2);
  });

  it('fetchExpenses con repo que devuelve null no deja nulls', async () => {
    (expenseRepository.getAll as jest.Mock) = jest.fn(async () => null as never);
    (expenseRepository.getRecent as jest.Mock) = jest.fn(async () => null as never);
    (expenseRepository.getCategorySummary as jest.Mock) = jest.fn(async () => null as never);
    const store = makeStore();
    await store.dispatch(fetchExpenses(10)).unwrap();
    const s = store.getState().expenses;
    expect(s.items).toEqual([]);
    expect(s.recent).toEqual([]);
    expect(s.summary).toEqual([]);
    expect(s.totalMonth).toEqual({});
    bindMemory();
  });

  it('saveOne cumple aunque el refresh falle (el dato ya está en SQLite)', async () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07' },
      ]),
    );
    const draft = store.getState().expenses.pendingQueue[0];
    // Simular DB bloqueada solo en lectura: create funciona, getAll falla
    const failingGetAll = jest.fn(async () => {
      throw new Error('database is locked');
    });
    (expenseRepository.getAll as unknown as jest.Mock) = failingGetAll;
    const saved = await store.dispatch(saveOneExpense({ index: 0, draft: { ...draft } })).unwrap();
    expect(saved.id).toBeDefined();
    // La cola se limpió y NO hay saveError (el guardado sí ocurrió)
    expect(store.getState().expenses.pendingQueue).toEqual([]);
    expect(store.getState().expenses.saveError).toBeNull();
    // El fallo de lectura queda visible como error de lista (con Reintentar), no silencioso
    expect(store.getState().expenses.error).toMatch(/locked/);
    // El dato está en SQLite y es recuperable
    expect((await mem.getAll())).toHaveLength(1);
    bindMemory();
  });

  it('saveAll con fallo total conserva la cola para reintentar', async () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([
        { amount: 0, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'X', date: '2026-09-07' },
      ]),
    );
    const drafts = store.getState().expenses.pendingQueue.map((d) => ({ ...d }));
    await expect(store.dispatch(saveAllExpenses({ drafts })).unwrap()).rejects.toMatch(/No se pudo guardar/);
    // Nada se guardó -> la cola se conserva
    expect(store.getState().expenses.pendingQueue).toHaveLength(1);
  });

  it('clearPending limpia', () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([{ amount: 1, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Varios', date: '2026-09-07' }]),
    );
    store.dispatch(clearPending());
    expect(store.getState().expenses.pendingQueue).toEqual([]);
  });
});
