/** Normaliza clave de categoría: sin acentos, mayúsculas, sin espacios extra. */
export function normKey(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Color sólido hardcodeado por categoría (las barras NO dependen del color
 * guardado en DB: ese pipeline fallaba en dispositivo y dejaba barras blancas).
 */
const BAR_FG: Record<string, string> = {
  COMIDA: '#ef4444',
  FOOD: '#ef4444',
  TRANSPORTE: '#f59e0b',
  TRANSPORT: '#f59e0b',
  VIVIENDA: '#3b82f6',
  HOUSING: '#3b82f6',
  SALUD: '#14b8a6',
  HEALTH: '#14b8a6',
  ENTRETENIMIENTO: '#8b5cf6',
  ENTERTAINMENT: '#8b5cf6',
  COMPRAS: '#ec4899',
  SHOPPING: '#ec4899',
  OTROS: '#64748b',
  OTHER: '#64748b',
  SALARIO: '#22c55e',
  INCOME: '#22c55e',
  FREELANCE: '#0ea5e9',
  VENTAS: '#84cc16',
  UTILITIES: '#f59e0b',
  EDUCATION: '#3b82f6',
};

/** Color sólido de la barra para una categoría (siempre válido). */
export function barColor(key: unknown): string {
  return BAR_FG[normKey(key)] ?? resolveColor('', normKey(key));
}

/** Relleno pastel de la barra (filled estilo mockup). */
export function barFill(key: unknown, ratio = 0.5): string {
  return pastel(barColor(key), ratio);
}
const FALLBACK_PALETTE = [
  '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#0ea5e9',
  '#06b6d4', '#10b981', '#84cc16', '#eab308', '#64748b', '#14b8a6',
];

/** Color garantizado: el asignado si es hex válido, si no uno fijo por id. */
export function resolveColor(raw: unknown, seed = ''): string {
  const h = typeof raw === 'string' ? raw.trim() : '';
  if (/^#?[0-9a-f]{6}$/i.test(h)) return h.startsWith('#') ? h : `#${h}`;
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

/** Pastel sólido mezclando el color de la categoría con blanco (fondos estilo mockup). */
export function pastel(raw: unknown, ratio = 0.22, seed = ''): string {
  const hex = resolveColor(raw, seed);
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * ratio + 255 * (1 - ratio));
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
