import { bytesToFloat32, cosineSimilarity, float32ToBytes, normalizeVector } from '../vectors';

describe('cosineSimilarity', () => {
  it('idénticos → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });
  it('ortogonales → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('opuestos → -1', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });
  it('vector nulo → 0', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
  it('invariante a escala', () => {
    expect(cosineSimilarity([1, 1], [5, 5])).toBeCloseTo(1);
  });
});

describe('bytes round-trip', () => {
  it('Float32Array sobrevive BLOB', () => {
    const v = Float32Array.from([0.1, -2.5, 3.14159]);
    expect(bytesToFloat32(float32ToBytes(v))).toEqual(v);
  });
  it('bytes corruptos lanzan', () => {
    expect(() => bytesToFloat32(new Uint8Array(3))).toThrow(/corrupto/);
  });
});

describe('normalizeVector', () => {
  it('acepta array válido', () => {
    expect(normalizeVector([1, 2], 2)).toEqual(Float32Array.from([1, 2]));
  });
  it('rechaza vacío, no numérico y dims inconsistentes', () => {
    expect(() => normalizeVector([], 0)).toThrow();
    expect(() => normalizeVector(['x'], 1)).toThrow(/numéricos/);
    expect(() => normalizeVector([1, 2], 3)).toThrow(/inconsistentes/);
  });
});
