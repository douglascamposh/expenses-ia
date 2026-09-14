import { EXPENSE_CATEGORIES, getAllCategories, getCategoryLabel } from '../categories/expenseCategories';
import { toISODate } from '../utils/dateFilter';

/**
 * Intents analíticos locales (sin LLM): "cuánto gasté", "gasto más fuerte",
 * con alcance temporal y de categoría/palabras.
 */

export type Metric = 'total' | 'max';

export type TimeScope =
  | { kind: 'month' }
  | { kind: 'today' }
  | { kind: 'week' }
  | { kind: 'lastMonths'; n: number }
  | { kind: 'year' };

export interface ParsedIntent {
  metric: Metric;
  /** Id de categoría si alguna matcheó (default o personalizada). */
  category: string | null;
  /** Resto significativo para filtrar por descripción. */
  keywords: string[];
  scope: TimeScope;
}

/** Etiqueta humana del alcance ("este mes", "últimos 3 meses"...). */
export function scopeLabel(scope: TimeScope): string {
  switch (scope.kind) {
    case 'today':
      return 'hoy';
    case 'week':
      return 'esta semana';
    case 'lastMonths':
      return scope.n === 1 ? 'este mes' : `últimos ${scope.n} meses`;
    case 'year':
      return 'este año';
    case 'month':
    default:
      return 'este mes';
  }
}

const MAX_PATTERNS = [
  /mas fuerte/, /mayor gasto/, /gasto mas grande/, /gasto mayor/, /maximo/,
  /biggest/, /largest/, /highest/, /most expensive/, /top gasto/, /top 1/,
];

const TOTAL_PATTERNS = [
  /cuanto/, /total/, /suma/, /sum/, /how much/, /gaste/, /gasto(?! mas|s mayor)/,
  /gastado/, /spent/, /spend/,
];

const STOPWORDS = new Set([
  // ES
  'cuanto', 'cuanta', 'cuantos', 'cuantas', 'dinero', 'he', 'has', 'ha', 'hemos',
  'gastado', 'gastada', 'gastados', 'gastadas', 'gaste', 'gasto', 'gasta', 'gastar',
  'fue', 'es', 'son', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'cual', 'cuales', 'que', 'donde', 'como',
  'en', 'de', 'del', 'al', 'mi', 'mis', 'me', 'este', 'esta', 'estos', 'estas',
  'ese', 'esa',   'mes', 'meses', 'año', 'ano', 'semana', 'dia', 'hoy', 'quiero',
  'saber', 'dime', 'muestrame', 'para', 'por', 'fuerte', 'mayor', 'maximo',
  'total', 'suma', 'mas', 'ultimos', 'estos', 'last', 'past', 'months',
  'uno', 'un', 'una', 'one', 'dos', 'two', 'tres', 'three', 'cuatro', 'four',
  'cinco', 'five', 'seis', 'six', 'siete', 'seven', 'ocho', 'eight',
  'nueve', 'nine', 'diez', 'ten', 'once', 'eleven', 'doce', 'twelve',
  // EN
  'how', 'much', 'money', 'did', 'do', 'i', 'you', 'spend', 'spent', 'spending',
  'on', 'in', 'the', 'a', 'an', 'my', 'this', 'that', 'these', 'those',
  'month', 'months', 'year', 'week', 'today', 'what', 'was', 'were', 'is',
  'biggest', 'largest', 'highest', 'most', 'expensive', 'total', 'sum',
]);

const NUMBER_WORDS: Record<string, number> = {
  uno: 1, un: 1, una: 1, one: 1,
  dos: 2, two: 2, tres: 3, three: 3, cuatro: 4, four: 4, cinco: 5, five: 5,
  seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8, nueve: 9, nine: 9,
  diez: 10, ten: 10, once: 11, eleven: 11, doce: 12, twelve: 12,
};

/** Sinónimos ES/EN → id de categoría por defecto. */
const CATEGORY_SYNONYMS: { id: string; words: string[] }[] = [
  { id: 'FOOD', words: ['comida', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'comer', 'food', 'lunch', 'dinner', 'breakfast', 'restaurant'] },
  { id: 'TRANSPORT', words: ['transporte', 'taxi', 'uber', 'bus', 'micro', 'gasolina', 'combustible', 'pasaje', 'transport'] },
  { id: 'GROCERIES', words: ['supermercado', 'supermercado', 'mercado', 'super', 'groceries', 'market'] },
  { id: 'SHOPPING', words: ['compras', 'shopping', 'tienda', 'store'] },
  { id: 'CLOTHING', words: ['ropa', 'vestido', 'zapatos', 'clothing', 'clothes'] },
  { id: 'ENTERTAINMENT', words: ['cine', 'pelicula', 'peliculas', 'teatro', 'concierto', 'fiesta', 'bar', 'salidas', 'entretenimiento', 'movie', 'movies', 'cinema', 'concert', 'party', 'entertainment'] },
  { id: 'GAMES', words: ['juegos', 'videojuegos', 'games'] },
  { id: 'HEALTH', words: ['salud', 'medico', 'farmacia', 'doctor', 'health'] },
  { id: 'BILLS', words: ['servicios', 'cuentas', 'luz', 'agua', 'internet', 'alquiler', 'bills'] },
  { id: 'HOME', words: ['hogar', 'casa', 'home'] },
  { id: 'EDUCATION', words: ['educacion', 'estudio', 'colegio', 'universidad', 'education'] },
  { id: 'TRAVEL', words: ['viaje', 'viajes', 'vacaciones', 'travel'] },
];

function normalize(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectMetric(text: string): Metric | null {
  if (MAX_PATTERNS.some((p) => p.test(text))) return 'max';
  if (TOTAL_PATTERNS.some((p) => p.test(text))) return 'total';
  return null;
}

function parseCount(text: string): number {
  const digit = text.match(/(\d{1,2})\s*(mes|month)/);
  if (digit) return Math.min(Math.max(parseInt(digit[1] ?? '1', 10), 1), 24);
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\s*(mes|month)`).test(text)) return n;
  }
  return 3;
}

function detectScope(text: string): TimeScope {
  if (/\bhoy\b|\btoday\b/.test(text)) return { kind: 'today' };
  if (/esta semana|this week/.test(text)) return { kind: 'week' };
  if (/este ano|this year/.test(text)) return { kind: 'year' };
  if (/(ultimos|estos|last|past)\s+\S*\s*(mes|month)/.test(text)) {
    return { kind: 'lastMonths', n: parseCount(text) };
  }
  return { kind: 'month' };
}

/** Busca categoría por id, labels ES/EN, sinónimos y personalizadas. Devuelve id + tokens consumidos. */
function detectCategory(text: string): { id: string; consumed: string[] } | null {
  // 1) Labels de personalizadas (dinámico) e ids directos
  const customs = getAllCategories().filter(
    (c) => !EXPENSE_CATEGORIES.some((d) => d.id === c.id),
  );
  const candidates: { id: string; words: string[] }[] = [
    ...customs.map((c) => ({
      id: String(c.id),
      words: [String(c.id).toLowerCase(), c.label.toLowerCase(), getCategoryLabel(String(c.id), 'es').toLowerCase()],
    })),
    ...CATEGORY_SYNONYMS,
    ...EXPENSE_CATEGORIES.map((c) => ({
      id: String(c.id),
      words: [String(c.id).toLowerCase(), c.label.toLowerCase(), getCategoryLabel(String(c.id), 'es').toLowerCase()],
    })),
  ];
  let best: { id: string; word: string } | null = null;
  for (const c of candidates) {
    for (const w of c.words) {
      const word = normalize(w);
      if (!word) continue;
      // Multi-palabra: incluye; una palabra: match exacto por token
      const hit = word.includes(' ') ? text.includes(word) : text.split(' ').includes(word);
      if (hit && (!best || word.length > best.word.length)) best = { id: c.id, word };
    }
  }
  if (!best) return null;
  return { id: best.id, consumed: best.word.split(' ') };
}

/**
 * Parsea una pregunta analítica. null = no es analítica (usar semántico/keyword).
 * Ej: "cuánto gasté en el cine" → {total, ENTERTAINMENT, [], month}
 *     "gasto más fuerte estos tres meses en alimento para el gato" → {max, null, [alimento, gato], lastMonths 3}
 */
export function parseAnalyticsQuery(query: string): ParsedIntent | null {
  const text = normalize(query);
  if (text.length < 3) return null;
  const metric = detectMetric(text);
  if (!metric) return null;
  const scope = detectScope(text);
  const cat = detectCategory(text);
  const consumed = new Set(cat?.consumed ?? []);
  const keywords = text
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !consumed.has(t) && !/^\d+$/.test(t));
  return { metric, category: cat?.id ?? null, keywords, scope };
}

export interface ScopeRange {
  from: string;
  to: string;
}

/**
 * Rango YYYY-MM-DD del alcance. `periodStartDay` (1-28) es el gancho para la
 * futura fecha de reinicio configurable: si viene, "este mes" = período vigente.
 */
export function resolveScopeRange(scope: TimeScope, now: Date = new Date(), periodStartDay?: number | null): ScopeRange {
  const todayStr = toISODate(now);
  switch (scope.kind) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return { from: toISODate(weekAgo), to: todayStr };
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: todayStr };
    case 'lastMonths': {
      const start = new Date(now.getFullYear(), now.getMonth() - (scope.n - 1), 1);
      return { from: toISODate(start), to: todayStr };
    }
    case 'month':
    default: {
      if (periodStartDay && periodStartDay >= 1 && periodStartDay <= 28) {
        const start =
          now.getDate() >= periodStartDay
            ? new Date(now.getFullYear(), now.getMonth(), periodStartDay)
            : new Date(now.getFullYear(), now.getMonth() - 1, periodStartDay);
        return { from: toISODate(start), to: todayStr };
      }
      return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: todayStr };
    }
  }
}
