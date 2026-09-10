import { configureStore } from '@reduxjs/toolkit';
import reducer, { createCategory, deleteCategory, fetchCategories } from '../categoriesSlice';
import { expenseRepository, InMemoryExpenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { budgetRepository, InMemoryBudgetRepository } from '@/expenses/repositories/BudgetRepository';
import { categoryRepository, InMemoryCategoryRepository } from '@/expenses/repositories/CategoryRepository';
import { isValidCategory, setCustomCategories } from '@/expenses/categories/expenseCategories';

const memCat = new InMemoryCategoryRepository();
const memExp = new InMemoryExpenseRepository();
const memBud = new InMemoryBudgetRepository();
const catSingleton = categoryRepository as unknown as Record<string, unknown>;
const expSingleton = expenseRepository as unknown as Record<string, unknown>;
const budSingleton = budgetRepository as unknown as Record<string, unknown>;
const catOrig = { ...catSingleton };
const expOrig = { ...expSingleton };
const budOrig = { ...budSingleton };

function makeStore() {
  return configureStore({ reducer: { categories: reducer }, middleware: (g) => g({ serializableCheck: false }) });
}

beforeEach(async () => {
  (categoryRepository as unknown as InMemoryCategoryRepository).getCustom = memCat.getCustom.bind(memCat);
  (categoryRepository as unknown as InMemoryCategoryRepository).create = memCat.create.bind(memCat);
  (categoryRepository as unknown as InMemoryCategoryRepository).delete = memCat.delete.bind(memCat);
  (categoryRepository as unknown as InMemoryCategoryRepository).clearAll = memCat.clearAll.bind(memCat);
  (expenseRepository as unknown as InMemoryExpenseRepository).getAll = memExp.getAll.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).clearAll = memExp.clearAll.bind(memExp);
  (budgetRepository as unknown as InMemoryBudgetRepository).getAll = memBud.getAll.bind(memBud);
  (budgetRepository as unknown as InMemoryBudgetRepository).clearAll = memBud.clearAll.bind(memBud);
  await memCat.clearAll();
  await memExp.clearAll();
  await memBud.clearAll();
  setCustomCategories([]);
});

afterEach(() => {
  setCustomCategories([]);
});

afterAll(() => {
  Object.assign(catSingleton, catOrig);
  Object.assign(expSingleton, expOrig);
  Object.assign(budSingleton, budOrig);
});

describe('categories slice', () => {
  it('fetchCategories sincroniza el registro de validación', async () => {
    await memCat.create({ label: 'Mascotas', emoji: '🐶', color: '#f97316' });
    const store = makeStore();
    expect(isValidCategory('MASCOTAS')).toBe(false);
    await store.dispatch(fetchCategories()).unwrap();
    expect(store.getState().categories.custom).toHaveLength(1);
    expect(isValidCategory('MASCOTAS')).toBe(true);
  });

  it('createCategory actualiza estado y registro', async () => {
    const store = makeStore();
    await store.dispatch(createCategory({ label: 'Jardín', emoji: '🌿', color: '#10b981' })).unwrap();
    expect(store.getState().categories.custom.map((c) => String(c.id))).toEqual(['JARDIN']);
    expect(isValidCategory('JARDIN')).toBe(true);
  });

  it('createCategory rechaza nombres inválidos', async () => {
    const store = makeStore();
    await expect(store.dispatch(createCategory({ label: 'X', emoji: '🐶', color: '#f97316' })).unwrap()).rejects.toBeDefined();
    expect(store.getState().categories.error).toBeTruthy();
  });

  it('deleteCategory bloquea defaults y categorías en uso', async () => {
    const store = makeStore();
    await expect(store.dispatch(deleteCategory('FOOD')).unwrap()).rejects.toMatch(/sistema/);
    await memCat.create({ label: 'Mascotas', emoji: '🐶', color: '#f97316' });
    await store.dispatch(fetchCategories()).unwrap();
    await memExp.create({
      id: 'e1', amount: 10, currency: 'BOB', category: 'MASCOTAS' as never, description: 'Vet',
      date: '2026-09-07', paymentMethod: 'CASH', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
    });
    await expect(store.dispatch(deleteCategory('MASCOTAS')).unwrap()).rejects.toMatch(/gastos/);
    await memExp.clearAll();
    await memBud.upsert({ category: 'MASCOTAS' as never, amount: 100, currency: 'BOB' });
    await expect(store.dispatch(deleteCategory('MASCOTAS')).unwrap()).rejects.toMatch(/presupuesto/);
  });

  it('deleteCategory libre elimina y limpia el registro', async () => {
    const store = makeStore();
    await memCat.create({ label: 'Mascotas', emoji: '🐶', color: '#f97316' });
    await store.dispatch(fetchCategories()).unwrap();
    await store.dispatch(deleteCategory('MASCOTAS')).unwrap();
    expect(store.getState().categories.custom).toEqual([]);
    expect(isValidCategory('MASCOTAS')).toBe(false);
  });
});
