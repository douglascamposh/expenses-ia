import { getDatabase } from '@/database/sqlite';
import { SYSTEM_CATEGORY, isValidCategoryKind, type CategoryConfig, type CategoryKind } from '../categories/expenseCategories';
import { ExpenseCategory } from '../categories/expenseCategories';

export interface CustomCategoryInput {
  label: string;
  emoji: string;
  color: string;
  kind?: CategoryKind;
}

export interface CategoryRepository {
  getCustom(): Promise<CategoryConfig[]>;
  /** Crea una personalizada (id slug único derivado del nombre). */
  create(input: CustomCategoryInput): Promise<CategoryConfig>;
  /** Edita una personalizada (el id no cambia: gastos y presupuestos lo referencian). */
  update(id: string, input: CustomCategoryInput): Promise<CategoryConfig>;
  delete(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

function rowToConfig(row: Record<string, unknown>): CategoryConfig {
  const rawKind = row.kind as string | null | undefined;
  return {
    id: row.id as ExpenseCategory,
    label: String(row.label ?? ''),
    icon: 'shippingbox.fill',
    emoji: String(row.emoji ?? '📦'),
    color: String(row.color ?? '#a1a1aa'),
    kind: rawKind && isValidCategoryKind(rawKind) ? rawKind : 'GASTO',
  };
}

/** "Mascotas" → MASCOTAS: mayúsculas, sin espacios ni signos. */
export function slugifyCategory(label: string): string {
  const slug = (label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return slug || 'CUSTOM';
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Normaliza para comparar duplicados: sin tildes, minúsculas, sin espacios extra. */
export function normCategoryLabel(label: string): string {
  return (label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function validate(input: CustomCategoryInput): string | null {
  if (!input || typeof input !== 'object') return 'Categoría inválida';
  if (!input.label || input.label.trim().length < 2) return 'El nombre debe tener al menos 2 letras';
  if (input.label.trim().length > 24) return 'El nombre debe tener máximo 24 letras';
  if (!input.emoji || [...input.emoji.trim()].length === 0) return 'Elige un icono';
  if (!HEX_COLOR.test(input.color ?? '')) return 'Color inválido';
  return null;
}

export class SqliteCategoryRepository implements CategoryRepository {
  async getCustom(): Promise<CategoryConfig[]> {
    const db = await getDatabase();
    const rows = (await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM custom_categories ORDER BY created_at ASC',
    )) ?? [];
    return (rows ?? []).map(rowToConfig);
  }

  async create(input: CustomCategoryInput): Promise<CategoryConfig> {
    const err = validate(input);
    if (err) throw new Error(err);
    const db = await getDatabase();
    // Duplicados: mismo nombre (sin tildes/mayúsculas) entre customs o sistema.
    const existing = await this.getCustom().catch(() => [] as CategoryConfig[]);
    const name = normCategoryLabel(input.label);
    if (
      existing.some((c) => normCategoryLabel(c.label) === name) ||
      normCategoryLabel(SYSTEM_CATEGORY.label) === name
    ) {
      throw new Error('Ya existe una categoría con ese nombre');
    }
    const base = slugifyCategory(input.label);
    // Sufijo si el id ya existe (default o custom)
    let id = base;
    let n = 0;
    for (;;) {
      const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM custom_categories WHERE id = ?', [id]);
      if (!row) break;
      n += 1;
      id = `${base}_${n}`;
    }
    const now = new Date().toISOString();
    const kind: CategoryKind = isValidCategoryKind(input.kind) ? input.kind : 'GASTO';
    await db.runAsync(
      'INSERT INTO custom_categories (id, label, emoji, color, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, input.label.trim(), input.emoji.trim(), input.color, kind, now],
    );
    return { id: id as ExpenseCategory, label: input.label.trim(), icon: 'shippingbox.fill', emoji: input.emoji.trim(), color: input.color, kind };
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Id inválido');
    const db = await getDatabase();
    await db.runAsync('DELETE FROM custom_categories WHERE id = ?', [id]);
  }

  async update(id: string, input: CustomCategoryInput): Promise<CategoryConfig> {
    const err = validate(input);
    if (err) throw new Error(err);
    if (!id) throw new Error('Id inválido');
    const db = await getDatabase();
    const existing = await this.getCustom().catch(() => [] as CategoryConfig[]);
    if (!existing.some((c) => String(c.id) === String(id))) throw new Error('Categoría no encontrada');
    const name = normCategoryLabel(input.label);
    if (
      existing.some((c) => String(c.id) !== String(id) && normCategoryLabel(c.label) === name) ||
      normCategoryLabel(SYSTEM_CATEGORY.label) === name
    ) {
      throw new Error('Ya existe una categoría con ese nombre');
    }
    const kind: CategoryKind = isValidCategoryKind(input.kind) ? input.kind : 'GASTO';
    await db.runAsync(
      'UPDATE custom_categories SET label = ?, emoji = ?, color = ?, kind = ? WHERE id = ?',
      [input.label.trim(), input.emoji.trim(), input.color, kind, id],
    );
    return { id: id as ExpenseCategory, label: input.label.trim(), icon: 'shippingbox.fill', emoji: input.emoji.trim(), color: input.color, kind };
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM custom_categories');
  }
}

export const categoryRepository = new SqliteCategoryRepository();

// In-memory para tests
export class InMemoryCategoryRepository implements CategoryRepository {
  private store = new Map<string, CategoryConfig>();

  async getCustom(): Promise<CategoryConfig[]> {
    return Array.from(this.store.values());
  }
  async create(input: CustomCategoryInput): Promise<CategoryConfig> {
    const err = validate(input);
    if (err) throw new Error(err);
    const name = normCategoryLabel(input.label);
    const existing = Array.from(this.store.values());
    if (
      existing.some((c) => normCategoryLabel(c.label) === name) ||
      normCategoryLabel(SYSTEM_CATEGORY.label) === name
    ) {
      throw new Error('Ya existe una categoría con ese nombre');
    }
    const base = slugifyCategory(input.label);
    let id = base;
    let n = 0;
    while (this.store.has(id)) {
      n += 1;
      id = `${base}_${n}`;
    }
    const c: CategoryConfig = { id: id as ExpenseCategory, label: input.label.trim(), icon: 'shippingbox.fill', emoji: input.emoji.trim(), color: input.color, kind: isValidCategoryKind(input.kind) ? input.kind : 'GASTO' };
    this.store.set(id, c);
    return c;
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
  async update(id: string, input: CustomCategoryInput): Promise<CategoryConfig> {
    const err = validate(input);
    if (err) throw new Error(err);
    if (!id) throw new Error('Id inválido');
    const current = this.store.get(id);
    if (!current) throw new Error('Categoría no encontrada');
    const name = normCategoryLabel(input.label);
    const clash = Array.from(this.store.values()).some(
      (c) => String(c.id) !== String(id) && normCategoryLabel(c.label) === name,
    );
    if (clash || normCategoryLabel(SYSTEM_CATEGORY.label) === name) {
      throw new Error('Ya existe una categoría con ese nombre');
    }
    const updated: CategoryConfig = {
      ...current,
      label: input.label.trim(),
      emoji: input.emoji.trim(),
      color: input.color,
      kind: isValidCategoryKind(input.kind) ? input.kind : 'GASTO',
    };
    this.store.set(id, updated);
    return updated;
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}
