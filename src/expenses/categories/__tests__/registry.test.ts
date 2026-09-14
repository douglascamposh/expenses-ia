import {
  SYSTEM_CATEGORY,
  getAllCategories,
  getCategoryConfig,
  getSuggestions,
  isUserCategory,
  isValidCategory,
  resolveCategoryId,
  setCustomCategories,
  type CategoryConfig,
} from '../expenseCategories';

function custom(id: string, label: string, kind: 'GASTO' | 'INGRESO' = 'GASTO'): CategoryConfig {
  return { id: id as CategoryConfig['id'], label, icon: 'shippingbox.fill', emoji: '📦', color: '#3b82f6', kind };
}

afterEach(() => {
  setCustomCategories([]);
});

describe('registro de categorías del usuario (cero defaults)', () => {
  it('sin customs solo existe la del sistema', () => {
    expect(getAllCategories()).toEqual([SYSTEM_CATEGORY]);
    expect(getCategoryConfig('FOOD').id).toBe('FOOD'); // legado visible para historial
    expect(getCategoryConfig('NOEXISTE')).toEqual(SYSTEM_CATEGORY);
  });

  it('isUserCategory distingue usuario/sistema/legado', () => {
    setCustomCategories([custom('MASCOTAS', 'Mascotas')]);
    expect(isUserCategory('MASCOTAS')).toBe(true);
    expect(isUserCategory('OTHER')).toBe(true);
    expect(isUserCategory('FOOD')).toBe(false);
  });

  it('isValidCategory acepta legado para historial', () => {
    expect(isValidCategory('FOOD')).toBe(true);
    expect(isValidCategory('NOEXISTE')).toBe(false);
  });

  it('resolveCategoryId cae a la default con desconocidas', () => {
    setCustomCategories([custom('MASCOTAS', 'Mascotas')]);
    expect(resolveCategoryId('MASCOTAS')).toBe('MASCOTAS');
    expect(resolveCategoryId('NOEXISTE')).toBe('OTHER');
    expect(resolveCategoryId('')).toBe('OTHER');
    expect(resolveCategoryId(null)).toBe('OTHER');
  });

  it('getSuggestions propone y excluye las ya creadas', () => {
    const all = getSuggestions();
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((s) => s.kind === 'INGRESO')).toBe(true);
    setCustomCategories([custom('COMER_FUERA', 'Comer fuera')]);
    const rest = getSuggestions();
    expect(rest.some((s) => s.label === 'Comer fuera')).toBe(false);
    expect(getSuggestions('INGRESO').every((s) => s.kind === 'INGRESO')).toBe(true);
  });
});
