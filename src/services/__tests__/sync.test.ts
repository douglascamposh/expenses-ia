import { InMemoryExpenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { runSync } from '../sync';
import { SyncError } from '../sync-api';
import type { Expense } from '@/expenses/models/Expense';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';

function makeExpense(id: string, updatedAt: string, amount = 10): Expense {
  return {
    id,
    amount,
    currency: 'BOB',
    category: ExpenseCategory.FOOD,
    kind: 'EXPENSE',
    description: `G ${id}`,
    date: '2026-09-22',
    paymentMethod: 'CASH',
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt,
  };
}

function makeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

describe('sync engine', () => {
  it('push sube pendientes y los marca; pull aplica remoto más nuevo', async () => {
    const repo = new InMemoryExpenseRepository();
    const kv = makeKv();
    await repo.create(makeExpense('a', '2026-09-22T10:00:00.000Z'));
    const push = jest.fn(() =>
      Promise.resolve({ applied: ['a'], conflicts: [], serverTime: '2026-09-22T11:00:00.000Z' }),
    );
    const pull = jest.fn(() =>
      Promise.resolve({
        changes: [
          {
            id: 'b', op: 'upsert' as const, updatedAt: '2026-09-22T11:00:00.000Z',
            data: { amount: 99, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Remoto', date: '2026-09-22', paymentMethod: 'CASH', createdAt: '2026-09-22T11:00:00.000Z' },
          },
        ],
        serverTime: '2026-09-22T11:00:00.000Z',
        hasMore: false,
      }),
    );
    const r = await runSync({ repo, kv, push, pull, deviceId: 'd1' });
    expect(r).toEqual({ pushed: 1, pulled: 1, conflicts: 0 });
    expect(await repo.getPendingUpserts()).toHaveLength(0);
    expect((await repo.getById('b'))?.amount).toBe(99);
    expect(kv.store.get('lastSyncPulledAt')).toBe('2026-09-22T11:00:00.000Z');
    expect(push).toHaveBeenCalledTimes(1);
    const pushBody = (push.mock.calls[0] as unknown[] | undefined)?.[0] as { deviceId: string; changes: unknown[] };
    expect(pushBody).toMatchObject({ deviceId: 'd1' });
    expect(pushBody.changes).toHaveLength(1);
  });

  it('conflictos del push se sobrescriben con el servidor', async () => {
    const repo = new InMemoryExpenseRepository();
    const kv = makeKv();
    await repo.create(makeExpense('a', '2026-09-22T10:00:00.000Z', 10));
    const push = jest.fn(() =>
      Promise.resolve({
        applied: [],
        conflicts: [{
          id: 'a', serverUpdatedAt: '2026-09-22T12:00:00.000Z',
          serverData: { amount: 50, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Srv', date: '2026-09-22', paymentMethod: 'CASH', createdAt: '2026-09-22T10:00:00.000Z' },
        }],
        serverTime: '2026-09-22T12:00:00.000Z',
      }),
    );
    const pull = jest.fn(() => Promise.resolve({ changes: [], serverTime: '2026-09-22T12:00:00.000Z', hasMore: false }));
    const r = await runSync({ repo, kv, push, pull, deviceId: 'd1', maxChanges: 10 });
    expect(r.conflicts).toBe(1);
    expect((await repo.getById('a'))?.amount).toBe(50);
  });

  it('pull respeta local más nuevo y borrado remoto pisa solo si está subido', async () => {
    const repo = new InMemoryExpenseRepository();
    const kv = makeKv();
    await repo.create(makeExpense('a', '2026-09-22T12:00:00.000Z', 10));
    await repo.markSynced(['a']);
    const push = jest.fn(() => Promise.resolve({ applied: [], conflicts: [], serverTime: '2026-09-22T12:00:00.000Z' }));
    const pull = jest.fn(() => Promise.resolve({
      changes: [
        { id: 'a', op: 'upsert' as const, updatedAt: '2026-09-22T11:00:00.000Z', data: { amount: 1, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Viejo', date: '2026-09-22', paymentMethod: 'CASH', createdAt: '2026-09-22T10:00:00.000Z' } },
      ],
      serverTime: '2026-09-22T12:00:00.000Z',
      hasMore: false,
    }));
    const r = await runSync({ repo, kv, push, pull, deviceId: 'd1' });
    expect(r.pulled).toBe(0);
    expect((await repo.getById('a'))?.amount).toBe(10);
  });

  it('403 del push se propaga (no es Pro)', async () => {
    const repo = new InMemoryExpenseRepository();
    const kv = makeKv();
    await repo.create(makeExpense('a', '2026-09-22T10:00:00.000Z'));
    const push = jest.fn(() => Promise.reject(new SyncError('Se requiere Pro para respaldar', 403)));
    const pull = jest.fn();
    await expect(runSync({ repo, kv, push, pull, deviceId: 'd1' })).rejects.toMatchObject({ status: 403 });
    expect(pull).not.toHaveBeenCalled();
  });
});
