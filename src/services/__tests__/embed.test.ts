import { EmbedError, embedText } from '../expense-api';

const realFetch = globalThis.fetch;

function mockFetch(json: unknown, ok = true, status = 200) {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(json) }),
  );
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('embedText', () => {
  it('parsea embedding + model + dims', async () => {
    mockFetch({ embedding: [0.1, 0.2, 0.3], model: 'test-model', dims: 3 });
    const res = await embedText('hola');
    expect(res.vector).toEqual(Float32Array.from([0.1, 0.2, 0.3]));
    expect(res.model).toBe('test-model');
    expect(res.dims).toBe(3);
  });

  it('contrato real del backend (gemini-embedding-2, 768)', async () => {
    const embedding = Array.from({ length: 768 }, (_, i) => (i % 2 === 0 ? -0.015243125 : 0.044122394));
    mockFetch({ embedding, model: 'gemini-embedding-2', dims: 768 });
    const res = await embedText('Compra en Amazon');
    expect(res.vector).toBeInstanceOf(Float32Array);
    expect(res.vector).toHaveLength(768);
    expect(res.model).toBe('gemini-embedding-2');
    expect(res.dims).toBe(768);
  });

  it('acepta alias vector/data y deriva dims/model', async () => {
    mockFetch({ vector: [1, 2] });
    const res = await embedText('hola');
    expect(res.dims).toBe(2);
    expect(res.model).toBe('backend-default');
  });

  it('texto vacío, sin embedding, dims inconsistentes y error HTTP lanzan', async () => {
    await expect(embedText('  ')).rejects.toBeInstanceOf(EmbedError);
    mockFetch({ model: 'm' });
    await expect(embedText('hola')).rejects.toThrow(/no devolvió/);
    mockFetch({ embedding: [1, 2], dims: 5 });
    await expect(embedText('hola')).rejects.toThrow(/inconsistentes/);
    mockFetch({ error: 'cuota excedida' }, false, 429);
    await expect(embedText('hola')).rejects.toThrow(/cuota/);
  });
});
