/** Similitud coseno entre dos vectores. Devuelve -1..1 (0 si alguno es nulo). */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Float32Array → Uint8Array (little-endian) para guardar como BLOB en SQLite. */
export function float32ToBytes(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
}

/** Uint8Array (little-endian) → Float32Array. */
export function bytesToFloat32(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 4 !== 0) throw new Error('BLOB de embedding corrupto');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/** Valida un vector crudo del backend y lo normaliza a Float32Array. */
export function normalizeVector(raw: unknown, dims?: number): Float32Array {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Embedding vacío o inválido');
  const vec = Float32Array.from(raw, (v) => {
    const n = Number(v);
    if (!isFinite(n)) throw new Error('Embedding con valores no numéricos');
    return n;
  });
  if (dims !== undefined && dims !== vec.length) {
    throw new Error(`Dims inconsistentes: esperado ${dims}, recibido ${vec.length}`);
  }
  return vec;
}
