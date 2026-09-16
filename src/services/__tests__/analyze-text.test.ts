import { analyzeText, normalizeAnalyzeResponse, AnalyzeError, ANALYZE_TEXT_ENDPOINT, isServiceUnavailable } from '../expense-api';

const realFetch = globalThis.fetch;

function mockFetchOnce(json: unknown, ok = true, status = 200) {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(json) }),
  );
}

beforeEach(() => {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ expenses: [] }) }),
  );
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('analyzeText (/api/analyze-text)', () => {
  it('POST JSON con el contrato del backend', async () => {
    await analyzeText('Ayer gasté 25 dólares en un Uber', 'gemini', [
      { id: 'TRANSPORTE', label: 'Transporte', kind: 'GASTO' },
    ]);
    const fetchMock = globalThis.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ANALYZE_TEXT_ENDPOINT);
    expect(url).toContain('/api/analyze-text');
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      text: 'Ayer gasté 25 dólares en un Uber',
      model: 'gemini',
      categories: [{ id: 'TRANSPORTE', label: 'Transporte', kind: 'GASTO' }],
    });
    expect(body.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('normaliza actions CREATE_EXPENSE igual que el audio', async () => {
    mockFetchOnce({
      success: true,
      actions: [
        {
          action: 'CREATE_EXPENSE',
          expense: { amount: 25, category: 'TRANSPORTE', currency: 'BOB', description: 'Uber', date: '2024-03-20' },
        },
      ],
    });
    const res = await analyzeText('Uber 25');
    expect(res.expenses).toHaveLength(1);
    expect(res.expenses[0]).toMatchObject({ amount: 25, category: 'TRANSPORTE' });
  });

  it('texto vacío se rechaza sin red', async () => {
    await expect(analyzeText('   ')).rejects.toBeInstanceOf(AnalyzeError);
    expect(globalThis.fetch as jest.Mock).not.toHaveBeenCalled();
  });

  it('error HTTP propaga el mensaje del backend', async () => {
    mockFetchOnce({ error: 'Modelo no disponible' }, false, 500);
    await expect(analyzeText('hola')).rejects.toThrow('Modelo no disponible');
  });

  it('normalizeAnalyzeResponse cubre todas las formas', () => {
    const e = { amount: 1 };
    expect(normalizeAnalyzeResponse([e])).toEqual([e]);
    expect(normalizeAnalyzeResponse({ expenses: [e] })).toEqual([e]);
    expect(normalizeAnalyzeResponse({ data: [e] })).toEqual([e]);
    expect(normalizeAnalyzeResponse({ result: [e] })).toEqual([e]);
    expect(normalizeAnalyzeResponse({ actions: [{ action: 'X', expense: e }] })).toHaveLength(1);
    expect(normalizeAnalyzeResponse({})).toEqual([]);
  });

  it('isServiceUnavailable detecta el 503 de alta demanda del modelo', async () => {
    // El backend responde 503 con el detalle del modelo saturado.
    mockFetchOnce(
      { error: 'this model is currently experiencing high demand, status: unavailable' },
      false,
      503,
    );
    const failure = await analyzeText('hola').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AnalyzeError);
    expect(isServiceUnavailable(failure)).toBe(true);
  });

  it('isServiceUnavailable cubre estados y textos de servicio caído', () => {
    // Estados transitorios del servicio
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isServiceUnavailable(new AnalyzeError('boom', status))).toBe(true);
    }
    // Texto del backend aunque no venga status
    expect(isServiceUnavailable(new Error('service overloaded, try again later'))).toBe(true);
    expect(isServiceUnavailable(new Error('RESOURCE EXHAUSTED'))).toBe(true);
    // Errores del request del usuario no se clasifican como servicio caído
    expect(isServiceUnavailable(new AnalyzeError('Texto vacío para embedding', 400))).toBe(false);
    expect(isServiceUnavailable(new Error('Gasto inválido'))).toBe(false);
    expect(isServiceUnavailable(null)).toBe(false);
    expect(isServiceUnavailable(undefined)).toBe(false);
  });
});
