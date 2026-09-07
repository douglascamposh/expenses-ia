import { InMemoryExpenseRepository } from '../ExpenseRepository';
import type { Expense } from '../../models/Expense';
import { ExpenseCategory } from '../../categories/expenseCategories';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: `id-${Math.random().toString(36).slice(2, 6)}`,
    amount: 35,
    currency: 'BOB',
    category: ExpenseCategory.FOOD,
    description: 'Lunch',
    date: '2026-09-04',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('InMemoryExpenseRepository', () => {
  it('create and getById', async () => {
    const repo = new InMemoryExpenseRepository();
    const e = makeExpense();
    await repo.create(e);
    expect(await repo.getById(e.id)).toEqual(e);
  });

  it('getRecent returns limited and sorted', async () => {
    const repo = new InMemoryExpenseRepository();
    await repo.create(makeExpense({ id: '1', date: '2026-09-04', createdAt: '2026-09-04T10:00:00.000Z' }));
    await repo.create(makeExpense({ id: '2', date: '2026-09-03', createdAt: '2026-09-03T10:00:00.000Z' }));
    await repo.create(makeExpense({ id: '3', date: '2026-09-04', createdAt: '2026-09-04T11:00:00.000Z' }));
    const recent = await repo.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('3'); // más reciente primero
  });

  it('getAll sorted desc', async () => {
    const repo = new InMemoryExpenseRepository();
    await repo.create(makeExpense({ id: 'a', date: '2026-09-01' }));
    await repo.create(makeExpense({ id: 'b', date: '2026-09-05' }));
    const all = await repo.getAll();
    expect(all[0].id).toBe('b');
  });

  it('delete', async () => {
    const repo = new InMemoryExpenseRepository();
    const e = makeExpense();
    await repo.create(e);
    await repo.delete(e.id);
    expect(await repo.getById(e.id)).toBeNull();
  });

  it('update', async () => {
    const repo = new InMemoryExpenseRepository();
    const e = makeExpense({ amount: 35 });
    await repo.create(e);
    const updated = await repo.update(e.id, { amount: 50 });
    expect(updated?.amount).toBe(50);
  });

  it('getCategorySummary grupos por categoría y moneda', async () => {
    const repo = new InMemoryExpenseRepository();
    await repo.create(makeExpense({ amount: 20, category: ExpenseCategory.FOOD, currency: 'BOB' }));
    await repo.create(makeExpense({ amount: 30, category: ExpenseCategory.FOOD, currency: 'BOB' }));
    await repo.create(makeExpense({ amount: 10, category: ExpenseCategory.TRANSPORT, currency: 'BOB' }));
    const summary = await repo.getCategorySummary();
    const food = summary.find((s) => s.category === ExpenseCategory.FOOD);
    expect(food?.total).toBe(50);
  });

  it('no suma monedas diferentes', async () => {
    const repo = new InMemoryExpenseRepository();
    await repo.create(makeExpense({ amount: 100, currency: 'BOB', category: ExpenseCategory.FOOD }));
    await repo.create(makeExpense({ amount: 50, currency: 'USD', category: ExpenseCategory.FOOD }));
    const summary = await repo.getCategorySummary();
    expect(summary).toHaveLength(2);
    const bob = summary.find((s) => s.currency === 'BOB');
    const usd = summary.find((s) => s.currency === 'USD');
    expect(bob?.total).toBe(100);
    expect(usd?.total).toBe(50);
  });
});
