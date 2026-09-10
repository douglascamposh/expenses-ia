import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  backfillEmbeddings,
  clearPending,
  createExpense,
  deleteBudget,
  embedExpense,
  fetchExpenses,
  saveAllExpenses,
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
import { embeddingRepository, InMemoryEmbeddingRepository } from '@/expenses/repositories/EmbeddingRepository';

// Usar repo en memoria pinchado sobre el singleton SQLite
const mem = new InMemoryExpenseRepository();
const sqlite = expenseRepository as unknown as Record<string, unknown>;
const orig = { ...sqlite };

const memEmb = new InMemoryEmbeddingRepository();
const embSingleton = embeddingRepository as unknown as Record<string, unknown>;
const embOrig = { ...embSingleton };

function bindMemory() {
  (expenseRepository as unknown as InMemoryExpenseRepository).create = mem.create.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getAll = mem.getAll.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getRecent = mem.getRecent.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).getCategorySummary = mem.getCategorySummary.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).delete = mem.delete.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).update = mem.update.bind(mem);
  (expenseRepository as unknown as InMemoryExpenseRepository).clearAll = mem.clearAll.bind(mem);
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
  await memEmb.clearAll();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

afterAll(() => {
  Object.assign(sqlite, orig);
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
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH' },
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
      setPendingQueue([{ amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Gasto X', date: '2026-09-07', paymentMethod: 'CASH' }]),
    );
    await expect(store.dispatch(saveOneExpense({ index: 0, draft: null as never })).unwrap()).rejects.toBeDefined();
    expect(store.getState().expenses.saveError).toBeTruthy();
    // La cola se conserva para reintentar
    expect(store.getState().expenses.pendingQueue).toHaveLength(1);
  });

  it('saveAll guarda varios y limpia', async () => {
    const store = makeStore();
    const drafts: NewExpense[] = [
      { amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH' },
      { amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Taxi centro', date: '2026-09-07', paymentMethod: 'CASH' },
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
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH' },
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
        { amount: 0, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'X', date: '2026-09-07', paymentMethod: 'CASH' },
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
      amount: 50, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Taxi', date: '2026-09-07', paymentMethod: 'CASH',
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
      store.dispatch(createExpense({ amount: 0, currency: 'BOB', category: ExpenseCategory.FOOD, description: '', date: '2026-09-07', paymentMethod: 'CASH' })).unwrap(),
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
      date: '2026-09-07', paymentMethod: 'CASH', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
    });
    await mem.create({
      id: 'b', amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'B',
      date: '2026-09-07', paymentMethod: 'CARD', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
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
      setPendingQueue([{ amount: 1, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Varios', date: '2026-09-07', paymentMethod: 'CASH' }]),
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
        { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH' },
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
      createExpense({ amount: 10, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Bus', date: '2026-09-07', paymentMethod: 'CARD' }),
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
      createExpense({ amount: 20, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH' }),
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
      { amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH' },
      { amount: 20, currency: 'BOB', category: ExpenseCategory.OTHER, description: 'Taxi', date: '2026-09-07', paymentMethod: 'CASH' },
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
});
