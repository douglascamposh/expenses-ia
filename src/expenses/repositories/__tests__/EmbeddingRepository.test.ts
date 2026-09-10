import { InMemoryEmbeddingRepository } from '../EmbeddingRepository';

function vec(...v: number[]): Float32Array {
  return Float32Array.from(v);
}

describe('InMemoryEmbeddingRepository', () => {
  it('upsert/getAll filtra por modelo', async () => {
    const repo = new InMemoryEmbeddingRepository();
    await repo.upsert('a', vec(1, 0), 'm1');
    await repo.upsert('b', vec(0, 1), 'm2');
    expect((await repo.getAll('m1')).map((e) => e.expenseId)).toEqual(['a']);
    // re-upsert actualiza modelo y vector
    await repo.upsert('a', vec(0, 1), 'm2');
    expect(await repo.getAll('m1')).toEqual([]);
    expect((await repo.getAll('m2')).map((e) => e.expenseId).sort()).toEqual(['a', 'b']);
  });

  it('upsert inválido lanza', async () => {
    const repo = new InMemoryEmbeddingRepository();
    await expect(repo.upsert('', vec(1), 'm')).rejects.toThrow();
    await expect(repo.upsert('a', Float32Array.from([]), 'm')).rejects.toThrow();
    await expect(repo.upsert('a', vec(1), '')).rejects.toThrow();
  });

  it('stats y missing para backfill', async () => {
    const repo = new InMemoryEmbeddingRepository();
    await repo.upsert('a', vec(1, 2), 'm1');
    await repo.upsert('b', vec(3, 4), 'm1');
    expect(await repo.getModelStats()).toEqual([{ model: 'm1', dims: 2, count: 2 }]);
    expect(await repo.getMissingExpenseIds('m1', ['a', 'b', 'c'])).toEqual(['c']);
    expect(await repo.getMissingExpenseIds('otro', ['a'])).toEqual(['a']);
  });

  it('delete y clearAll', async () => {
    const repo = new InMemoryEmbeddingRepository();
    await repo.upsert('a', vec(1), 'm');
    await repo.delete('a');
    expect(await repo.getAll('m')).toEqual([]);
    await repo.upsert('b', vec(1), 'm');
    await repo.clearAll();
    expect(await repo.getModelStats()).toEqual([]);
  });
});
