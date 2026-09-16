import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  createRule,
  fetchRules,
  generateRecurrences,
  removeRule,
  saveRecurringDraft,
  updateRule,
} from '../recurringSlice';
import expensesReducer from '../expensesSlice';
import { expenseRepository, InMemoryExpenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { budgetRepository, InMemoryBudgetRepository } from '@/expenses/repositories/BudgetRepository';
import { recurringRepository, InMemoryRecurringRepository } from '@/expenses/repositories/RecurringRepository';
import type { NewExpense } from '@/expenses/models/Expense';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';

const memExp = new InMemoryExpenseRepository();
const memBud = new InMemoryBudgetRepository();
const memRec = new InMemoryRecurringRepository();

function bindMemory() {
  const exp = expenseRepository as unknown as InMemoryExpenseRepository;
  exp.create = memExp.create.bind(memExp);
  exp.getAll = memExp.getAll.bind(memExp);
  exp.getRecent = memExp.getRecent.bind(memExp);
  exp.getByMonthRange = memExp.getByMonthRange.bind(memExp);
  exp.getCategorySummary = memExp.getCategorySummary.bind(memExp);
  exp.getMonthlyTotals = memExp.getMonthlyTotals.bind(memExp);
  exp.getOldestDate = memExp.getOldestDate.bind(memExp);
  exp.delete = memExp.delete.bind(memExp);
  exp.update = memExp.update.bind(memExp);
  exp.clearAll = memExp.clearAll.bind(memExp);
  const bud = budgetRepository as unknown as InMemoryBudgetRepository;
  bud.upsert = memBud.upsert.bind(memBud);
  bud.getAll = memBud.getAll.bind(memBud);
  bud.getProgress = memBud.getProgress.bind(memBud);
  bud.delete = memBud.delete.bind(memBud);
  bud.clearAll = memBud.clearAll.bind(memBud);
  const rec = recurringRepository as unknown as InMemoryRecurringRepository;
  rec.getAll = memRec.getAll.bind(memRec);
  rec.getActive = memRec.getActive.bind(memRec);
  rec.create = memRec.create.bind(memRec);
  rec.update = memRec.update.bind(memRec);
  rec.remove = memRec.remove.bind(memRec);
  rec.clearAll = memRec.clearAll.bind(memRec);
}

function makeStore() {
  return configureStore({
    reducer: { recurring: reducer, expenses: expensesReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
}

function draft(overrides: Partial<NewExpense> = {}): NewExpense {
  return {
    amount: 100,
    currency: 'BOB',
    category: ExpenseCategory.FOOD,
    kind: 'EXPENSE',
    description: 'Prueba',
    date: '2026-09-05',
    paymentMethod: 'CASH',
    recurrence: 'MONTHLY',
    ...overrides,
  };
}

beforeEach(async () => {
  bindMemory();
  await memExp.clearAll();
  await memBud.clearAll();
  await memRec.clearAll();
});

describe('recurringSlice', () => {
  it('saveRecurringDraft crea regla + gasto actual vinculado', async () => {
    const store = makeStore();
    const res = await store.dispatch(saveRecurringDraft(draft())).unwrap();
    expect(res.rule.frequency).toBe('MONTHLY');
    expect(res.rule.lastGenerated).toBe('2026-09-05');
    expect(res.expense.recurringId).toBe(res.rule.id);
    expect(res.expense.date).toBe('2026-09-05');
    expect(store.getState().recurring.rules).toHaveLength(1);
    expect((await memExp.getAll())).toHaveLength(1);
  });

  it('saveRecurringDraft revierte la regla si falla el gasto', async () => {
    const store = makeStore();
    (expenseRepository as unknown as InMemoryExpenseRepository).create = jest.fn(async () => {
      throw new Error('DB bloqueada');
    });
    await expect(store.dispatch(saveRecurringDraft(draft())).unwrap()).rejects.toBeDefined();
    expect((await memRec.getAll())).toHaveLength(0);
    expect(store.getState().recurring.saveError).toBeTruthy();
    bindMemory();
  });

  it('saveRecurringDraft rechaza ONCE y montos inválidos', async () => {
    const store = makeStore();
    await expect(store.dispatch(saveRecurringDraft(draft({ recurrence: 'ONCE' }))).unwrap()).rejects.toBeDefined();
    await expect(store.dispatch(saveRecurringDraft(draft({ amount: 0 }))).unwrap()).rejects.toBeDefined();
    expect((await memRec.getAll())).toHaveLength(0);
  });

  it('generateRecurrences materializa vencidos sin duplicar', async () => {
    const store = makeStore();
    await store.dispatch(saveRecurringDraft(draft())).unwrap();
    await memExp.clearAll();
    // Simula siguiente apertura un mes después
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args: unknown[]) {
        super(...(args.length === 0 ? ['2026-10-13T12:00:00.000Z'] : args) as [string]);
      }
    }
    globalThis.Date = FakeDate as unknown as typeof Date;
    try {
      const res = await store.dispatch(generateRecurrences()).unwrap();
      expect(res.created).toBe(1);
      expect((await memExp.getAll()).map((e) => e.date)).toEqual(['2026-10-05']);
      // Segunda corrida: idempotente
      const again = await store.dispatch(generateRecurrences()).unwrap();
      expect(again.created).toBe(0);
      expect((await memExp.getAll())).toHaveLength(1);
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('fetchRules, updateRule (pausa) y removeRule', async () => {
    const store = makeStore();
    const { rule } = await store.dispatch(saveRecurringDraft(draft())).unwrap();
    await store.dispatch(fetchRules()).unwrap();
    expect(store.getState().recurring.rules).toHaveLength(1);
    await store.dispatch(updateRule({ id: rule.id, patch: { active: false } })).unwrap();
    expect(store.getState().recurring.rules[0].active).toBe(false);
    await store.dispatch(removeRule(rule.id)).unwrap();
    expect(store.getState().recurring.rules).toHaveLength(0);
  });

  it('createRule valida entrada', async () => {
    const store = makeStore();
    await expect(
      store.dispatch(createRule({ description: '', amount: 10, currency: 'BOB', category: ExpenseCategory.FOOD, kind: 'EXPENSE', frequency: 'MONTHLY', day1: 1, day2: null, weekday: null, month: null, paymentMethod: 'CASH', startDate: '2026-09-01', endDate: null, active: true, lastGenerated: null })).unwrap(),
    ).rejects.toBeDefined();
  });
});
