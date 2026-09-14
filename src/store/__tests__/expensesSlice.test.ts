import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  backfillEmbeddings,
  clearPending,
  createExpense,
  deleteBudget,
  embedExpense,
  fetchExpenses,
  saveAllExpenses,
  answerAnalytics,
  saveOneExpense,
  semanticSearch,
  setPendingQueue,
  updateExpense,
  upsertBudget,
} from '../expensesSlice';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';
import { expenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { InMemoryExpenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { budgetRepository } from '@/expenses/repositories/BudgetRepository';
import { InMemoryBudgetRepository } from '@/expenses/repositories/BudgetRepository';
import { embeddingRepository, InMemoryEmbeddingRepository } from '@/expenses/repositories/EmbeddingRepository';

// Usar repo en memoria pinchado sobre el singleton SQLite
const mem = new InMemoryExpenseRepository();
const memBud = new InMemoryBudgetRepository();
const budSingleton = budgetRepository as unknown as Record<string, unknown>;
const budOrig = { ...budSingleton };
const sqlite = expenseRepository as unknown as Record<string, unknown>;
const orig = { ...sqlite };

const memEmb = new InMemoryEmbeddingRepository();
const embSingleton = embeddingRepository as unknown as Record<string, unknown>;
const embOrig = { ...embSingleton };

function bindMemory() {
  (expenseRepository as unknown as InMemoryExpenseRepository).create = mem.create.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getAll = mem.getAll.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getRecent = mem.getRecent.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getByMonthRange = mem.getByMonthRange.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getCategorySummary = mem.getCategorySummary.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).delete = mem.delete.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).update = mem.update.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).clearAll = mem.clearAll.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getMonthlyTotals = mem.getMonthlyTotals.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getOldestDate = mem.getOldestDate.bind(mem);
  (budgetRepository as unknown as InMemoryBudgetRepository).upsert = memBud.upsert.bind(memBud);
  (budgetRepository as unknown as InMemoryBudgetRepository).getAll = memBud.getAll.bind(memBud);
  (budgetRepository as unknown as InMemoryBudgetRepository).getProgress = memBud.getProgress.bind(memBud);
  (budgetRepository as unknown as InMemoryBudgetRepository).delete = memBud.delete.bind(memBud);
  (budgetRepository as unknown as InMemoryBudgetRepository).clearAll = memBud.clearAll.bind(memBud);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).upsert = memEmb.upsert.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getAll = memEmb.getAll.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getModelStats = memEmb.getModelStats.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getMissingExpenseIds =
    memEmb.getMissingExpenseIds.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).delete = memEmb.delete.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).clearAll = memEmb.clearAll.bind(memEmb);
}

function makeStore() {
  return configureStore({ reducer: { expenses: reducer }, middleware: (g) => g({ serializableCheck: false }) });
}

const realFetch = globalThis.fetch;

function mockEmbedFetch(vector: number[], model = 'test-model') {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ embedding: vector, model, dims: vector.length }) }),
  );
}

beforeEach(async () => {
  bindMemory();
  await mem.clearAll();
  await memBud.clearAll();
  await memEmb.clearAll();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

afterAll(() => {
  Object.assign(sqlite, orig);
  Object.assign(budgetRepository as unknown as Record<string, unknown>, budOrig);
  Object.assign(embSingleton, embOrig);
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
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
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
      setPendingQueue([{ amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Gasto X', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' }]),
    );
    await expect(store.dispatch(saveOneExpense({ index: 0, draft: null as never })).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.saveError).toBeTruthy();
    // La cola se conserva para reintentar
    expect(store.getState().expenses.pendingQueue).toHaveLength(1);
  });

  it('saveAll guarda varios y limpia', async () => {
    const store = makeStore();
    const drafts: NewExpense[] = [
      { amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
      { amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Taxi centro', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
    ];
    const n = await store.dispatch(saveAllExpenses({ drafts: drafts.map((d) => ({ ...d })) })).unwrap();
    expect(n).toBe(2);
    expect(store.getState().expenses.pendingQueue).toEqual([]);
    expect((await mem.getAll())).toHaveLength(2);
  });

  it('fetchExpenses con repo que devuelve null no deja nulls', async () => {
    (expenseRepository.getAll as jest.Mock) = jest.fn(async () => null as never);
    (expenseRepository.getRecent as jest.Mock) = jest.fn(async () => null as never);
    (expenseRepository as unknown as { getByMonthRange: unknown }).getByMonthRange = jest.fn(async () => null as never);
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

  it('fetchExpenses({year, month}) fija visibleMonth y trae ese snapshot', async () => {
    bindMemory();
    await mem.clearAll();
    await mem.create({
      id: 'oct-1', amount: 100, currency: 'BOB', category: ExpenseCategory.FOOD, kind: 'EXPENSE',
      description: 'Oct', date: '2026-10-05', paymentMethod: 'CASH',
      createdAt: '2026-10-05T10:00:00.000Z', updatedAt: '2026-10-05T10:00:00.000Z',
    });
    await mem.create({
      id: 'nov-1', amount: 500, currency: 'BOB', category: ExpenseCategory.FOOD, kind: 'EXPENSE',
      description: 'Nov', date: '2026-11-05', paymentMethod: 'CASH',
      createdAt: '2026-11-05T10:00:00.000Z', updatedAt: '2026-11-05T10:00:00.000Z',
    });
    const store = makeStore();
    await store.dispatch(fetchExpenses({ year: 2026, month: 10 })).unwrap();
    const s = store.getState().expenses;
    expect(s.visibleMonth).toEqual({ year: 2026, month: 10 });
    // Recientes y totales solo de octubre (noviembre no se filtra).
    expect(s.recent.map((e) => e.id)).toEqual(['oct-1']);
    expect(s.totalMonth).toEqual({ BOB: 100 });
    expect(s.monthlyTotals).toContainEqual({ month: '2026-10', currency: 'BOB', total: 100 });
    expect(s.monthlyTotals).toContainEqual({ month: '2026-11', currency: 'BOB', total: 500 });
    expect(s.oldestDate).toBe('2026-10-05');
    // Sin mes explícito conserva el visible (refresh tras crear).
    await store.dispatch(fetchExpenses(10)).unwrap();
    expect(store.getState().expenses.visibleMonth).toEqual({ year: 2026, month: 10 });
    await mem.clearAll();
  });

  it('saveOne cumple aunque el refresh falle (el dato ya está en SQLite)', async () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
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
        { amount: 0, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'X', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
      ]),
    );
    const drafts = store.getState().expenses.pendingQueue.map((d) => ({ ...d }));
    await expect(store.dispatch(saveAllExpenses({ drafts })).unwrap()).rejects.toMatch(/No se pudo guardar/);
    // Nada se guardó -> la cola se conserva
    expect(store.getState().expenses.pendingQueue).toHaveLength(1);
  });

  it('createExpense (alta manual) guarda y refresca sin tocar la cola', async () => {
    const store = makeStore();
    const draft: NewExpense = {
      amount: 50, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Taxi', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE',
    };
    const saved = await store.dispatch(createExpense(draft)).unwrap();
    expect(saved.id).toBeDefined();
    expect(store.getState().expenses.pendingQueue).toEqual([]);
    expect(store.getState().expenses.saving).toBe(false);
    expect(store.getState().expenses.saveError).toBeNull();
    expect((await mem.getAll())).toHaveLength(1);
    expect(store.getState().expenses.items).toHaveLength(1);
  });

  it('createExpense con draft inválido reporta saveError', async () => {
    const store = makeStore();
    await expect(
      store.dispatch(createExpense({ amount: 0, currency: 'BOB', category: ExpenseCategory.FOOD, description: '', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' })).unwrap(),
    ).rejects.toBeDefined();
    expect(store.getState().expenses.saveError).toBeTruthy();
    expect(store.getState().expenses.saving).toBe(false);
    expect((await mem.getAll())).toHaveLength(0);
  });

  it('upsertBudget válido cumple y limpia budgetError', async () => {
    const store = makeStore();
    const saved = await store.dispatch(
      upsertBudget({ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' }),
    ).unwrap();
    expect(saved).toMatchObject({ category: ExpenseCategory.FOOD, amount: 500 });
    expect(store.getState().expenses.budgetError).toBeNull();
    expect(store.getState().expenses.saving).toBe(false);
  });

  it('upsertBudget inválido reporta budgetError', async () => {
    const store = makeStore();
    await expect(
      store.dispatch(upsertBudget({ category: ExpenseCategory.FOOD, amount: 0, currency: 'BOB' })).unwrap(),
    ).rejects.toBeDefined();
    expect(store.getState().expenses.budgetError).toBeTruthy();
  });

  it('deleteBudget cumple', async () => {
    const store = makeStore();
    const res = await store.dispatch(deleteBudget(ExpenseCategory.FOOD)).unwrap();
    expect(res).toBe(ExpenseCategory.FOOD);
    expect(store.getState().expenses.budgetError).toBeNull();
  });

  it('embedExpense persiste el vector (best-effort)', async () => {
    mockEmbedFetch([1, 0, 0], 'm1');
    const store = makeStore();
    const res = await store.dispatch(embedExpense({ expenseId: 'e1', text: 'Cena pagado en efectivo' })).unwrap();
    expect(res).toMatchObject({ expenseId: 'e1', model: 'm1' });
    expect((await memEmb.getAll('m1')).map((e) => e.expenseId)).toEqual(['e1']);
  });

  it('embedExpense con red caída no rompe (cumple como rechazado interno)', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
    const store = makeStore();
    await expect(store.dispatch(embedExpense({ expenseId: 'e9', text: 'x' })).unwrap()).rejects.toBeDefined();
    expect((await memEmb.getAll('m1'))).toEqual([]);
  });

  it('backfillEmbeddings indexa los faltantes con tope', async () => {
    mockEmbedFetch([0, 1, 0], 'm1');
    const store = makeStore();
    await mem.create({
      id: 'a', amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'A',
      date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
    });
    await mem.create({
      id: 'b', amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'B',
      date: '2026-09-07', paymentMethod: 'CARD', kind: 'EXPENSE', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
    });
    await store.dispatch(fetchExpenses(10)).unwrap();
    const res = await store.dispatch(backfillEmbeddings({ limit: 25 })).unwrap();
    expect(res.indexed).toBe(2);
    expect(res.model).toBe('m1');
    expect(await memEmb.getMissingExpenseIds('m1', ['a', 'b'])).toEqual([]);
  });

  it('semanticSearch ordena por coseno y degrada a keyword sin red', async () => {
    const store = makeStore();
    await memEmb.upsert('doc-comida', Float32Array.from([1, 0, 0]), 'm1');
    await memEmb.upsert('doc-lejos', Float32Array.from([0, 1, 0]), 'm1');
    mockEmbedFetch([1, 0, 0], 'm1');
    const res = await store.dispatch(semanticSearch('comida')).unwrap();
    expect(res.expenseIds).toEqual(['doc-comida']);
    expect(store.getState().expenses.searchMode).toBe('semantic');
    expect(store.getState().expenses.semanticIds).toEqual(['doc-comida']);
    // Sin red → fallback keyword
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
    await expect(store.dispatch(semanticSearch('comida')).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.searchMode).toBe('keyword');
    expect(store.getState().expenses.semanticIds).toBeNull();
  });

  it('clearPending limpia', () => {
    const store = makeStore();
    store.dispatch(
      setPendingQueue([{ amount: 1, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Varios', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' }]),
    );
    store.dispatch(clearPending());
    expect(store.getState().expenses.pendingQueue).toEqual([]);
  });
});

describe('vectores en save/edit (búsqueda semántica)', () => {
  async function waitForVector(id: string, model = 'test-model', timeoutMs = 5000) {
    const start = Date.now();
    for (;;) {
      const docs = await memEmb.getAll(model);
      const doc = docs.find((d) => d.expenseId === id);
      if (doc) return doc;
      if (Date.now() - start > timeoutMs) throw new Error(`sin vector para ${id}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  it('saveOne embebe el gasto guardado (T1)', async () => {
    mockEmbedFetch([0.5, 0.5]);
    const store = makeStore();
    store.dispatch(
      setPendingQueue([
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
      ]),
    );
    const saved = await store.dispatch(saveOneExpense({ index: 0, draft: { ...store.getState().expenses.pendingQueue[0] } })).unwrap();
    const doc = await waitForVector(saved.id);
    expect(doc.model).toBe('test-model');
    expect(Array.from(doc.vector)).toEqual([0.5, 0.5]);
  });

  it('createExpense manual embebe el gasto (T2)', async () => {
    mockEmbedFetch([0.25, 0.75]);
    const store = makeStore();
    const saved = await store.dispatch(
      createExpense({ amount: 10, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Bus', date: '2026-09-07', paymentMethod: 'CARD', kind: 'EXPENSE' }),
    ).unwrap();
    const doc = await waitForVector(saved.id);
    expect(Array.from(doc.vector)).toEqual([0.25, 0.75]);
  });

  it('updateExpense re-embebe con el texto editado (T3)', async () => {
    const texts: string[] = [];
    let calls = 0;
    (globalThis as { fetch?: unknown }).fetch = jest.fn((_url: unknown, init?: { body?: string }) => {
      calls += 1;
      try {
        texts.push(JSON.parse(String(init?.body))?.text ?? '');
      } catch {
        texts.push('');
      }
      const vec = calls === 1 ? [1, 0] : [0, 1];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ embedding: vec, model: 'test-model', dims: 2 }) });
    });
    const store = makeStore();
    const saved = await store.dispatch(
      createExpense({ amount: 20, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' }),
    ).unwrap();
    await waitForVector(saved.id);
    await store.dispatch(updateExpense({ id: saved.id, patch: { description: 'Cena' } })).unwrap();
    // Esperar al segundo embed (el del edit)
    const start = Date.now();
    for (;;) {
      const docs = await memEmb.getAll('test-model');
      const doc = docs.find((d) => d.expenseId === saved.id);
      if (doc && Array.from(doc.vector).join(',') === '0,1') break;
      if (Date.now() - start > 5000) throw new Error('el edit no actualizó el vector');
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(texts[texts.length - 1]).toContain('Cena');
  });

  it('saveAll deja 0 faltantes tras el backfill (T4)', async () => {
    mockEmbedFetch([0, 0, 1]);
    const store = makeStore();
    const n = await store.dispatch(saveAllExpenses({ drafts: [
      { amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
      { amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Taxi', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
    ] })).unwrap();
    expect(n).toBe(2);
    const ids = (await mem.getAll()).map((e) => e.id);
    expect(ids).toHaveLength(2);
    const start = Date.now();
    for (;;) {
      const missing = await memEmb.getMissingExpenseIds('test-model', ids);
      if (missing.length === 0) break;
      if (Date.now() - start > 8000) throw new Error(`backfill no cubrió: ${missing.join(',')}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  });

  it('semanticSearch sin matches sobre el umbral degrada a keyword (T5)', async () => {
    const store = makeStore();
    await memEmb.upsert('doc-lejos', Float32Array.from([0, 1, 0]), 'm1');
    mockEmbedFetch([1, 0, 0], 'm1'); // query ortogonal → score 0 < 0.35
    await expect(store.dispatch(semanticSearch('comida')).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.searchMode).toBe('keyword');
    expect(store.getState().expenses.semanticIds).toBeNull();
  });

  it('semanticSearch con lista pareja degrada a keyword (sin discriminación)', async () => {
    const store = makeStore();
    // 6 docs casi idénticos al query → spread < 0.08
    for (let i = 0; i < 6; i++) {
      await memEmb.upsert(`doc-${i}`, Float32Array.from([1, 0.01 * i, 0]), 'm1');
    }
    mockEmbedFetch([1, 0, 0], 'm1');
    await expect(store.dispatch(semanticSearch('gastos')).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.searchMode).toBe('keyword');
  });

  it('semanticSearch con claro ganador devuelve top recortado', async () => {
    const store = makeStore();
    await memEmb.upsert('doc-top', Float32Array.from([1, 0, 0]), 'm1');
    await memEmb.upsert('doc-mid', Float32Array.from([0.5, 0.5, 0]), 'm1');
    await memEmb.upsert('doc-lejos', Float32Array.from([0, 1, 0]), 'm1');
    mockEmbedFetch([1, 0, 0], 'm1');
    const res = await store.dispatch(semanticSearch('comida')).unwrap();
    // top=1 → corte 0.75: mid (0.707) fuera, lejos (0) fuera
    expect(res.expenseIds).toEqual(['doc-top']);
    expect(store.getState().expenses.searchMode).toBe('semantic');
  });
});

function monthISO(day: number): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

describe('answerAnalytics (preguntas analíticas exactas)', () => {
  async function seedMonth() {
    await mem.create({
      id: 'a1', amount: 120, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo',
      date: monthISO(3), paymentMethod: 'CASH', kind: 'EXPENSE', createdAt: monthISO(3), updatedAt: monthISO(3),
    } as never);
    await mem.create({
      id: 'a2', amount: 350, currency: 'BOB', category: ExpenseCategory.ENTERTAINMENT, description: 'Cine con amigos',
      date: monthISO(5), paymentMethod: 'CARD', kind: 'EXPENSE', createdAt: monthISO(5), updatedAt: monthISO(5),
    } as never);
    await mem.create({
      id: 'a3', amount: 20, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Café',
      date: monthISO(7), paymentMethod: 'CASH', kind: 'EXPENSE', createdAt: monthISO(7), updatedAt: monthISO(7),
    } as never);
    await mem.create({
      id: 'old', amount: 999, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Viejo',
      date: '2020-01-10', paymentMethod: 'CASH', kind: 'EXPENSE', createdAt: '2020-01-10', updatedAt: '2020-01-10',
    } as never);
  }

  it('total este mes excluye meses viejos', async () => {
    const store = makeStore();
    await seedMonth();
    const res = await store.dispatch(answerAnalytics({ query: 'cuánto gasté en total este mes', currency: 'BOB' })).unwrap();
    expect(res).toMatchObject({ kind: 'total', value: 490, currency: 'BOB', count: 3, scope: 'este mes' });
    expect(res.expenseIds).toEqual(expect.arrayContaining(['a1', 'a2', 'a3']));
    expect(res.expenseIds).not.toContain('old');
    expect(store.getState().expenses.analytics?.value).toBe(490);
  });

  it('gasto más fuerte devuelve el top con preview', async () => {
    const store = makeStore();
    await seedMonth();
    const res = await store.dispatch(answerAnalytics({ query: 'cuál fue mi gasto más fuerte este mes', currency: 'BOB' })).unwrap();
    expect(res).toMatchObject({ kind: 'max', value: 350, expenseIds: ['a2'] });
    expect(res.preview).toMatchObject({ description: 'Cine con amigos' });
  });

  it('total en el cine filtra por categoría', async () => {
    const store = makeStore();
    await seedMonth();
    const res = await store.dispatch(answerAnalytics({ query: 'cuánto gasté en el cine', currency: 'BOB' })).unwrap();
    expect(res).toMatchObject({ kind: 'total', value: 350, category: 'ENTERTAINMENT', count: 1 });
  });

  it('total con keywords filtra por descripción', async () => {
    const store = makeStore();
    await seedMonth();
    await mem.create({
      id: 'g1', amount: 45, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Alimento para gato',
      date: monthISO(9), paymentMethod: 'CASH', kind: 'EXPENSE', createdAt: monthISO(9), updatedAt: monthISO(9),
    } as never);
    const res = await store.dispatch(answerAnalytics({ query: 'cuánto gasté en alimento para el gato', currency: 'BOB' })).unwrap();
    expect(res).toMatchObject({ kind: 'total', value: 45, count: 1 });
    expect(res.expenseIds).toEqual(['g1']);
  });

  it('total 0 con filtro estricto rechaza (degrada a semántico)', async () => {
    const store = makeStore();
    await seedMonth();
    await expect(
      store.dispatch(answerAnalytics({ query: 'cuánto gasté en alimento para el gato', currency: 'BOB' })).unwrap(),
    ).rejects.toBeDefined();
    expect(store.getState().expenses.analytics).toBeNull();
  });

  it('total 0 sin filtros sí es respuesta válida', async () => {
    const store = makeStore();
    const res = await store.dispatch(answerAnalytics({ query: 'cuánto gasté en total este mes', currency: 'BOB' })).unwrap();
    expect(res).toMatchObject({ kind: 'total', value: 0, count: 0 });
    expect(store.getState().expenses.analytics?.value).toBe(0);
  });

  it('no analítica rechaza (→ semántico)', async () => {
    const store = makeStore();
    await expect(store.dispatch(answerAnalytics({ query: 'almuerzo', currency: 'BOB' })).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.analytics).toBeNull();
  });

  it('max sin datos rechaza', async () => {
    const store = makeStore();
    await expect(store.dispatch(answerAnalytics({ query: 'gasto más fuerte hoy', currency: 'BOB' })).unwrap()).rejects.toBeDefined();
  });

  it('updateExpense de gasto inexistente reporta error (no silencioso)', async () => {
    const store = makeStore();
    await expect(store.dispatch(updateExpense({ id: 'nope', patch: { description: 'X' } })).unwrap()).rejects.toMatch(
      /no encontrado/i,
    );
  });

  it('semántico exitoso limpia una respuesta analítica previa', async () => {
    const store = makeStore();
    await seedMonth();
    await store.dispatch(answerAnalytics({ query: 'cuánto gasté en total este mes', currency: 'BOB' })).unwrap();
    expect(store.getState().expenses.analytics).not.toBeNull();
    await memEmb.upsert('doc-comida', Float32Array.from([1, 0, 0]), 'm1');
    mockEmbedFetch([1, 0, 0], 'm1');
    await store.dispatch(semanticSearch('comida')).unwrap();
    expect(store.getState().expenses.analytics).toBeNull();
    expect(store.getState().expenses.searchMode).toBe('semantic');
  });
});

describe('kind EXPENSE/INCOME', () => {
  it('los ingresos no suman a totales de gasto ni presupuestos', async () => {
    const store = makeStore();
    await store.dispatch(createExpense({ amount: 100, currency: 'BOB', category: ExpenseCategory.FOOD, kind: 'EXPENSE', description: 'Comida', date: monthISO(3), paymentMethod: 'CASH' })).unwrap();
    await store.dispatch(createExpense({ amount: 1000, currency: 'BOB', category: ExpenseCategory.OTHER, kind: 'INCOME', description: 'Sueldo', date: monthISO(4), paymentMethod: 'CASH' })).unwrap();
    await store.dispatch(fetchExpenses(10)).unwrap();
    const s = store.getState().expenses;
    expect(s.totalMonth.BOB).toBe(100);
    expect(s.incomeTotalMonth.BOB).toBe(1000);
    // El resumen del carrusel solo lleva gastos
    expect(s.summary.every((x) => x.total !== 1000)).toBe(true);
  });
});
