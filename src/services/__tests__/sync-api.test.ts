import { getBillingBaseUrl } from '../billing';
import { pullSync, pushSync, SyncError } from '../sync-api';

jest.mock('@/services/auth', () => ({
  getAuthToken: jest.fn(() => Promise.resolve('tok')),
}));

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) }),
  );
}

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = undefined;
});

describe('sync-api', () => {
  it('pushSync envía el DTO y mapea la respuesta', async () => {
    mockFetchOnce({ applied: ['a'], conflicts: [], serverTime: '2026-09-22T11:00:00.000Z' });
    const r = await pushSync({
      deviceId: 'd1',
      changes: [{ id: 'a', op: 'upsert', updatedAt: '2026-09-22T10:00:00.000Z', data: { amount: 1, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'x', date: '2026-09-22', paymentMethod: 'CASH', createdAt: '2026-09-22T10:00:00.000Z' } }],
    });
    expect(r).toEqual({ applied: ['a'], conflicts: [], serverTime: '2026-09-22T11:00:00.000Z' });
    const fetchMock = globalThis.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/sync/push'),
      expect.objectContaining({ method: 'POST' }),
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ deviceId: 'd1' });
    expect(Array.isArray(sent.changes)).toBe(true);
  });

  it('pushSync 403 lanza SyncError con status', async () => {
    mockFetchOnce({ error: 'pro requerido' }, false, 403);
    await expect(pushSync({ deviceId: 'd1', changes: [] })).rejects.toMatchObject({ status: 403 });
    await expect(pushSync({ deviceId: 'd1', changes: [] })).rejects.toThrow(SyncError);
  });

  it('pullSync agrega since y parsea cambios', async () => {
    mockFetchOnce({ changes: [{ id: 'b', op: 'delete', updatedAt: '2026-09-22T11:00:00.000Z' }], serverTime: '2026-09-22T12:00:00.000Z', hasMore: false });
    const r = await pullSync('2026-09-22T10:00:00.000Z');
    expect(r.changes).toHaveLength(1);
    expect(r.serverTime).toBe('2026-09-22T12:00:00.000Z');
    const fetchMock = globalThis.fetch as jest.Mock;
    expect(fetchMock.mock.calls[0][0] as string).toContain('since=2026-09-22T10%3A00%3A00.000Z');
  });

  it('pullSync no duplica la base en la URL', async () => {
    mockFetchOnce({ changes: [], serverTime: '2026-09-22T12:00:00.000Z', hasMore: false });
    await pullSync('2026-09-22T10:00:00.000Z');
    const fetchMock = globalThis.fetch as jest.Mock;
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(`${getBillingBaseUrl()}/api/sync/pull?since=2026-09-22T10%3A00%3A00.000Z`);
  });
});
