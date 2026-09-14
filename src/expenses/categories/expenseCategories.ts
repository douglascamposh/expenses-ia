/**
 * Categorías — el usuario las define; al inicio hay CERO, solo sugerencias.
 * - `SUGGESTED_CATEGORIES`: pack de sugerencias (se proponen al crear, no existen solas).
 * - `EXPENSE_CATEGORIES`: legado de versiones anteriores, solo lectura para
 *   historial/presupuestos viejos. No aparece en pickers ni formularios.
 * - `SYSTEM_CATEGORY` (Otros): respaldo indeleble cuando un match falla.
 * No hardcodear categorías en UI: usar getAllCategories()/getSuggestions().
 */

export enum ExpenseCategory {
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  GROCERIES = 'GROCERIES',
  SHOPPING = 'SHOPPING',
  CLOTHING = 'CLOTHING',
  ENTERTAINMENT = 'ENTERTAINMENT',
  GAMES = 'GAMES',
  HEALTH = 'HEALTH',
  BILLS = 'BILLS',
  HOME = 'HOME',
  EDUCATION = 'EDUCATION',
  TRAVEL = 'TRAVEL',
  OTHER = 'OTHER',
}

/** Las categorías del usuario son de gasto o de ingreso. */
export type CategoryKind = 'GASTO' | 'INGRESO';

export function isValidCategoryKind(k: unknown): k is CategoryKind {
  return k === 'GASTO' || k === 'INGRESO';
}

export type CategoryConfig = {
  id: ExpenseCategory;
  label: string;
  icon: string; // SF Symbol name
  emoji: string; // fallback
  color: string;
  kind: CategoryKind;
};

/**
 * Legado: las 13 por defecto de versiones anteriores. Solo para mostrar
 * historial y presupuestos viejos. NO usar en pickers/formularios nuevos.
 */
export const EXPENSE_CATEGORIES: CategoryConfig[] = [
  { id: ExpenseCategory.FOOD, label: 'Food', icon: 'fork.knife', emoji: '🍔', color: '#f97316', kind: 'GASTO' },
  { id: ExpenseCategory.TRANSPORT, label: 'Transport', icon: 'car.fill', emoji: '🚗', color: '#3b82f6', kind: 'GASTO' },
  { id: ExpenseCategory.GROCERIES, label: 'Groceries', icon: 'cart.fill', emoji: '🛒', color: '#10b981', kind: 'GASTO' },
  { id: ExpenseCategory.SHOPPING, label: 'Shopping', icon: 'bag.fill', emoji: '🛍', color: '#ec4899', kind: 'GASTO' },
  { id: ExpenseCategory.CLOTHING, label: 'Clothing', icon: 'tshirt.fill', emoji: '👕', color: '#8b5cf6', kind: 'GASTO' },
  { id: ExpenseCategory.ENTERTAINMENT, label: 'Entertainment', icon: 'film.fill', emoji: '🎬', color: '#f59e0b', kind: 'GASTO' },
  { id: ExpenseCategory.GAMES, label: 'Games', icon: 'gamecontroller.fill', emoji: '🎮', color: '#06b6d4', kind: 'GASTO' },
  { id: ExpenseCategory.HEALTH, label: 'Health', icon: 'heart.fill', emoji: '❤️', color: '#ef4444', kind: 'GASTO' },
  { id: ExpenseCategory.BILLS, label: 'Bills', icon: 'doc.text.fill', emoji: '🧾', color: '#64748b', kind: 'GASTO' },
  { id: ExpenseCategory.HOME, label: 'Home', icon: 'house.fill', emoji: '🏠', color: '#84cc16', kind: 'GASTO' },
  { id: ExpenseCategory.EDUCATION, label: 'Education', icon: 'book.fill', emoji: '📚', color: '#6366f1', kind: 'GASTO' },
  { id: ExpenseCategory.TRAVEL, label: 'Travel', icon: 'airplane', emoji: '✈️', color: '#0ea5e9', kind: 'GASTO' },
  { id: ExpenseCategory.OTHER, label: 'Other', icon: 'shippingbox.fill', emoji: '📦', color: '#a1a1aa', kind: 'GASTO' },
];

/** Categoría del sistema: respaldo cuando un match (p. ej. IA) falla. No se borra. */
export const SYSTEM_CATEGORY: CategoryConfig = {
  id: ExpenseCategory.OTHER,
  label: 'Otros',
  icon: 'shippingbox.fill',
  emoji: '📦',
  color: '#a1a1aa',
  kind: 'GASTO',
};

/**
 * Sugerencias para crear: el usuario las confirma una por una.
 * No existen en el registro hasta que se crean.
 */
export const SUGGESTED_CATEGORIES: CategoryConfig[] = [
  { id: 'COMER_FUERA' as ExpenseCategory, label: 'Comer fuera', icon: 'fork.knife', emoji: '🍔', color: '#f97316', kind: 'GASTO' },
  { id: 'TRANSPORTE' as ExpenseCategory, label: 'Transporte', icon: 'car.fill', emoji: '🚕', color: '#eab308', kind: 'GASTO' },
  { id: 'COMPRAS' as ExpenseCategory, label: 'Compras', icon: 'bag.fill', emoji: '🛍', color: '#ec4899', kind: 'GASTO' },
  { id: 'SERVICIOS' as ExpenseCategory, label: 'Servicios', icon: 'doc.text.fill', emoji: '🧾', color: '#64748b', kind: 'GASTO' },
  { id: 'SALUD' as ExpenseCategory, label: 'Salud', icon: 'heart.fill', emoji: '❤️', color: '#ef4444', kind: 'GASTO' },
  { id: 'ENTRETENIMIENTO' as ExpenseCategory, label: 'Entretenimiento', icon: 'film.fill', emoji: '🎬', color: '#f59e0b', kind: 'GASTO' },
  { id: 'SALARIO' as ExpenseCategory, label: 'Salario', icon: 'dollarsign.circle.fill', emoji: '💰', color: '#10b981', kind: 'INGRESO' },
  { id: 'TRABAJO_EXTRA' as ExpenseCategory, label: 'Trabajo extra', icon: 'briefcase.fill', emoji: '💼', color: '#0ea5e9', kind: 'INGRESO' },
  { id: 'ALQUILER' as ExpenseCategory, label: 'Alquiler', icon: 'house.fill', emoji: '🏠', color: '#84cc16', kind: 'INGRESO' },
];

const LEGACY_MAP = new Map(EXPENSE_CATEGORIES.map((c) => [c.id, c]));

/** Personalizadas del usuario (las carga categoriesSlice desde SQLite al arrancar). */
let customCategories: CategoryConfig[] = [];

export function setCustomCategories(list: CategoryConfig[]): void {
  customCategories = (list ?? [])
    .filter(Boolean)
    .map((c) => ({ ...c, kind: isValidCategoryKind(c.kind) ? c.kind : 'GASTO' as CategoryKind }));
}

/** Definidas por el usuario + sistema. Sin customs → solo Otros. */
export function getAllCategories(): CategoryConfig[] {
  return [...customCategories, SYSTEM_CATEGORY];
}

/** Sugerencias aún no creadas por el usuario, opcionalmente por kind. */
export function getSuggestions(kind?: CategoryKind): CategoryConfig[] {
  const existing = new Set(getAllCategories().map((c) => String(c.id)));
  const byLabel = new Set(getAllCategories().map((c) => c.label.trim().toLowerCase()));
  return SUGGESTED_CATEGORIES.filter(
    (s) =>
      (!kind || s.kind === kind) &&
      !existing.has(String(s.id)) &&
      !byLabel.has(s.label.trim().toLowerCase()),
  );
}

function normLookup(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

function findConfig(id: string): CategoryConfig | undefined {
  const custom = customCategories.find((c) => String(c.id) === String(id));
  if (custom) return custom;
  if (String(id) === String(SYSTEM_CATEGORY.id)) return SYSTEM_CATEGORY;
  const legacy = LEGACY_MAP.get(id as ExpenseCategory);
  if (legacy) return legacy;
  // Datos con caja/acentos distintos (p. ej. 'Compras' de voz/IA): buscar por
  // id o etiqueta normalizados antes de caer al sistema.
  const want = normLookup(id);
  if (!want) return undefined;
  return (
    customCategories.find((c) => normLookup(c.id) === want) ??
    customCategories.find((c) => normLookup(c.label) === want) ??
    (normLookup(SYSTEM_CATEGORY.id) === want || normLookup(SYSTEM_CATEGORY.label) === want
      ? SYSTEM_CATEGORY
      : undefined)
  );
}

export function getCategoryConfig(id: string): CategoryConfig {
  return findConfig(id) ?? SYSTEM_CATEGORY;
}

/** ¿Existe en el registro del usuario o es la del sistema? (pickers/formularios) */
export function isUserCategory(id: string): boolean {
  return (
    customCategories.some((c) => String(c.id) === String(id)) ||
    String(id) === String(SYSTEM_CATEGORY.id)
  );
}

/** Válida para guardar (usuario + sistema + legado para historial). */
export function isValidCategory(id: string): boolean {
  return isUserCategory(id) || LEGACY_MAP.has(id as ExpenseCategory);
}

/** Normaliza un id de categoría (p. ej. match de IA) o cae a la default. */
export function resolveCategoryId(id: unknown): string {
  const s = String(id ?? '').trim();
  return s && isValidCategory(s) ? s : String(SYSTEM_CATEGORY.id);
}

const LABELS_ES: Record<ExpenseCategory, string> = {
  [ExpenseCategory.FOOD]: 'Comida',
  [ExpenseCategory.TRANSPORT]: 'Transporte',
  [ExpenseCategory.GROCERIES]: 'Supermercado',
  [ExpenseCategory.SHOPPING]: 'Compras',
  [ExpenseCategory.CLOTHING]: 'Ropa',
  [ExpenseCategory.ENTERTAINMENT]: 'Entretenimiento',
  [ExpenseCategory.GAMES]: 'Juegos',
  [ExpenseCategory.HEALTH]: 'Salud',
  [ExpenseCategory.BILLS]: 'Servicios',
  [ExpenseCategory.HOME]: 'Hogar',
  [ExpenseCategory.EDUCATION]: 'Educación',
  [ExpenseCategory.TRAVEL]: 'Viajes',
  [ExpenseCategory.OTHER]: 'Otros',
};

/** Etiqueta de categoría en el idioma dado (base para textos de embedding). */
export function getCategoryLabel(id: string, lang: 'es' | 'en' = 'en'): string {
  const custom = customCategories.find((c) => String(c.id) === String(id));
  if (custom) return custom.label;
  if (String(id) === String(SYSTEM_CATEGORY.id)) return SYSTEM_CATEGORY.label;
  if (lang === 'es' && (Object.values(ExpenseCategory) as string[]).includes(id)) {
    return LABELS_ES[id as ExpenseCategory] ?? id;
  }
  return LEGACY_MAP.get(id as ExpenseCategory)?.label ?? id;
}
