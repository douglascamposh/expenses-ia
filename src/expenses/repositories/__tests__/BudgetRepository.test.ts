import { InMemoryBudgetRepository, SqliteBudgetRepository } from '../BudgetRepository';
import { ExpenseCategory } from '../../categories/expenseCategories';

describe('InMemoryBudgetRepository', () => {
  it('upsert crea y actualiza por categoría', async () => {
    const repo = new InMemoryBudgetRepository();
    await repo.upsert({ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' });
    expect(await repo.getByCategory(ExpenseCategory.FOOD)).toMatchObject({ amount: 500 });
    await repo.upsert({ category: ExpenseCategory.FOOD, amount: 700, currency: 'BOB' });
    expect(await repo.getAll()).toHaveLength(1);
    expect(await repo.getByCategory(ExpenseCategory.FOOD)).toMatchObject({ amount: 700 });
  });

  it('upsert rechaza monto inválido', async () => {
    const repo = new InMemoryBudgetRepository();
    await expect(repo.upsert({ category: ExpenseCategory.FOOD, amount: 0, currency: 'BOB' })).rejects.toThrow(/mayor a 0/);
    await expect(repo.upsert({ category: 'NOPE' as never, amount: 10, currency: 'BOB' })).rejects.toThrow(/inválida/);
  });

  it('getProgress calcula pct y over con totales del mes', async () => {
    const repo = new InMemoryBudgetRepository((category, currency) => {
      if (category === ExpenseCategory.FOOD && currency === 'BOB') return 250;
      if (category === ExpenseCategory.TRANSPORT && currency === 'BOB') return 600;
      return 0;
    });
    await repo.upsert({ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' });
    await repo.upsert({ category: ExpenseCategory.TRANSPORT, amount: 500, currency: 'BOB' });
    const progress = await repo.getProgress('2026-09-01');
    const food = progress.find((p) => p.category === ExpenseCategory.FOOD)!;
    const transport = progress.find((p) => p.category === ExpenseCategory.TRANSPORT)!;
    expect(food).toMatchObject({ spent: 250, limit: 500, pct: 0.5, over: false });
    expect(transport).toMatchObject({ spent: 600, over: true });
  });

  it('delete elimina', async () => {
    const repo = new InMemoryBudgetRepository();
    await repo.upsert({ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' });
    await repo.delete(ExpenseCategory.FOOD);
    expect(await repo.getAll()).toEqual([]);
  });
});

describe('SqliteBudgetRepository (mock expo-sqlite, fachada sobre categorías)', () => {
  it('upsert rechaza si la categoría no existe como custom', async () => {
    const repo = new SqliteBudgetRepository();
    await expect(repo.upsert({ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' })).rejects.toThrow(/inválida/);
  });

  it('upsert inválido lanza sin tocar SQLite', async () => {
    const repo = new SqliteBudgetRepository();
    await expect(repo.upsert({ category: ExpenseCategory.FOOD, amount: -5, currency: 'BOB' })).rejects.toThrow();
  });
});
