import { getIdToken } from '@react-native-firebase/auth';

import { __resetAuthForTests } from '../auth';
import { AnalyzeError, analyzeText } from '../expense-api';

const mockGetIdToken = getIdToken as jest.Mock;
const realFetch = globalThis.fetch;

function okJson(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as Response;
}

const EXPENSE_BODY = {
  actions: [
    {
      action: 'CREATE_EXPENSE',
      expense: { amount: 50, currency: 'BOB', category: 'Comida', description: 'Almuerzo' },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetAuthForTests();
  mockGetIdToken.mockResolvedValue('tok-abc');
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('expense-api con Firebase Auth', () => {
  it('envía Authorization Bearer con el ID token', async () => {
    const fetchMock = jest.fn(() => Promise.resolve(okJson(EXPENSE_BODY)));
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    const res = await analyzeText('almuerzo 50');
    expect(res.expenses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const [, init] = calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc');
  });

  it('ante 401 reintenta una vez con token fresco', async () => {
    mockGetIdToken
      .mockResolvedValueOnce('tok-viejo')
      .mockResolvedValueOnce('tok-fresco');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(okJson(EXPENSE_BODY));
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    const res = await analyzeText('almuerzo 50');
    expect(res.expenses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockGetIdToken).toHaveBeenCalledWith(expect.anything(), true);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const [, init2] = calls[1];
    expect((init2.headers as Record<string, string>).Authorization).toBe('Bearer tok-fresco');
  });

  it('si el reintento también es 401, lanza AnalyzeError con status', async () => {
    const fetchMock = jest.fn(() => Promise.resolve(okJson({ error: 'unauthorized' }, 401)));
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    await expect(analyzeText('almuerzo 50')).rejects.toMatchObject({
      name: 'AnalyzeError',
      status: 401,
    } as Partial<AnalyzeError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
