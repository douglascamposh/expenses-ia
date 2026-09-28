import {
  AI_FREE_QUOTA,
  AI_MAX_EXPENSES,
  askAi,
  askAiEndpoint,
  buildAiSnapshot,
  mockAskAi,
  normalizeAiResponse,
  type AiSnapshot,
} from '../ai-api';

jest.mock('@/services/auth', () => ({
  getAuthToken: jest.fn(() => Promise.resolve('tok')),
}));

const realFetch = globalThis.fetch;

function snapshot(over?: Partial<AiSnapshot>): AiSnapshot {
  return {
    query: 'q',
    lang: 'es',
    model: 'gemini',
    currency: 'BOB',
    period: { from: '2026-09-01', to: '2026-09-30' },
    categories: [],
    expenses: [
      { id: 'e1', description: 'Cine', amount: 80, currency: 'BOB', category: 'X', date: '2026-09-12' },
    ],
    recurring: [],
    budgets: [],
    ...over,
  };
}

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = realFetch;
});

describe('ai-api contrato', () => {
  it('endpoint cuelga de la base configurada', () => {
    expect(askAiEndpoint('https://x.test')).toBe('https://x.test/api/ask');
  });

  it('snapshot recorta a 200 y filtra por período', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: `e${i}`, description: 'x', amount: 1, currency: 'BOB', category: 'X', date: '2026-09-10',
    }));
    const snap = buildAiSnapshot({
      query: 'q', lang: 'es', currency: 'BOB',
      period: { from: '2026-09-01', to: '2026-09-30' },
      categories: [],
      expenses: [
        ...many,
        { id: 'old', description: 'x', amount: 1, currency: 'BOB', category: 'X', date: '2026-08-01' },
      ] as never,
      rules: [],
      budgets: [],
    });
    expect(snap.expenses).toHaveLength(AI_MAX_EXPENSES);
    expect(snap.expenses.some((e) => e.id === 'old')).toBe(false);
  });

  it('normalize descarta ids inventados y tipos raros', () => {
    const snap = snapshot();
    const r = normalizeAiResponse({
      type: 'raro',
      title: 'T',
      summary: 'S',
      suggestions: [{ id: 's1', title: 'A', detail: 'B', estimated_savings: 10, expense_ids: ['e1', 'zx'], kind: 'nope' }],
      expense_ids: ['e1', 'zx'],
      quota_remaining: 7,
    }, snap);
    expect(r.type).toBe('lookup');
    expect(r.expense_ids).toEqual(['e1']);
    expect(r.suggestions[0].expense_ids).toEqual(['e1']);
    expect(r.suggestions[0].kind).toBe('cut');
    expect(r.quota_remaining).toBe(7);
  });

  it('askAi manda Bearer y parsea', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ type: 'lookup', title: 'T', summary: 'S', suggestions: [], expense_ids: [] }),
      }),
    );
    const r = await askAi(snapshot(), 'https://x.test/api/ask');
    expect(r.title).toBe('T');
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('askAi !ok lanza AiError con status', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ error: 'límite' }) }),
    );
    await expect(askAi(snapshot(), 'https://x.test/api/ask')).rejects.toMatchObject({ status: 429 });
  });

  it('timeout aborta y lanza AiError', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }),
    );
    await expect(askAi(snapshot(), 'https://x.test/api/ask', 10)).rejects.toThrow(/tardó/);
  });

  it('mock responde con totales del snapshot', () => {
    const r = mockAskAi('algo', snapshot());
    expect(r.quota_remaining).toBe(AI_FREE_QUOTA);
    expect(r.title).toMatch(/80/);
    expect(r.expense_ids).toEqual(['e1']);
  });
});
