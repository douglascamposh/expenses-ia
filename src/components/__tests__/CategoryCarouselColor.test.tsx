import { fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CategoryCarousel } from '../CategoryCarousel';
import categoriesReducer from '@/store/categoriesSlice';
import {
  getCategoryConfig,
  setCustomCategories,
  type CategoryConfig,
} from '@/expenses/categories/expenseCategories';
import { barColor, barFill, normKey, pastel } from '@/expenses/utils/colors';

const COMPRAS: CategoryConfig = {
  id: 'COMPRAS' as CategoryConfig['id'],
  label: 'Compras',
  icon: 'bag.fill',
  emoji: '🛍',
  color: '#ef4444',
  kind: 'GASTO',
};

function bgOf(tree: unknown, testID: string): string | undefined {
  const node = (tree as { root: { findByProps(p: object): { props: { style: unknown } } } }).root.findByProps({
    testID,
  });
  const style = node.props.style as unknown;
  const flat = Array.isArray(style) ? style.flat(Infinity) : [style];
  const entry = flat.find(
    (s) => s && typeof s === 'object' && 'backgroundColor' in (s as object),
  ) as { backgroundColor?: string } | undefined;
  return entry?.backgroundColor;
}

afterEach(() => {
  setCustomCategories([]);
});

describe('CategoryCarousel color de la categoría', () => {
  it('compras muestra 10% con el pastel de su color elegido', () => {
    setCustomCategories([COMPRAS]);
    const testStore = configureStore({
      reducer: { categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const tree = render(
      <Provider store={testStore}>
        <CategoryCarousel
          budgets={[{ category: 'COMPRAS', currency: 'BOB', limit: 400, spent: 40, pct: 0.1 }]}
          summary={[{ category: 'COMPRAS', currency: 'BOB', total: 40 }]}
          onPressCategory={() => {}}
        />
      </Provider>,
    );
    expect(tree.getByText('10%')).toBeTruthy();
    // Única barra → queda seleccionada (pastel 0.55 del rojo elegido)
    expect(bgOf(tree, 'bar-COMPRAS')).toBe(pastel('#ef4444', 0.55, 'COMPRAS'));
    expect(barColor('COMPRAS')).toBe('#ec4899');
  });

  it('barColor no depende del color guardado y cubre todas las sugerencias', () => {
    for (const key of [
      'COMIDA', 'TRANSPORTE', 'VIVIENDA', 'SALUD', 'ENTRETENIMIENTO',
      'COMPRAS', 'OTROS', 'SALARIO', 'FREELANCE', 'VENTAS',
      'compras', 'Compras', '  COMPRAS  ',
    ]) {
      expect(barColor(key)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(barFill(key, 0.5)).toBe(pastel(barColor(key), 0.5));
    }
    expect(barColor('COMPRAS')).toBe(barColor('compras'));
  });

  it('normKey quita acentos y mayúsculas', () => {
    expect(normKey('Música')).toBe('MUSICA');
    expect(normKey('compras')).toBe('COMPRAS');
  });

  it("getCategoryConfig resuelve 'Compras'/'compras' a la custom COMPRAS", () => {
    setCustomCategories([{ ...COMPRAS, color: '#ef4444' }]);
    expect(getCategoryConfig('Compras').id).toBe('COMPRAS');
    expect(getCategoryConfig('compras').id).toBe('COMPRAS');
  });

  it('controlado: tap alterna selección vía onSelect (filtro inline)', () => {
    setCustomCategories([{ ...COMPRAS, color: '#ef4444' }]);
    const testStore = configureStore({
      reducer: { categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const onSelect = jest.fn();
    const tree = render(
      <Provider store={testStore}>
        <CategoryCarousel
          budgets={[{ category: 'COMPRAS', currency: 'BOB', limit: 400, spent: 40, pct: 0.1 }]}
          summary={[{ category: 'COMPRAS', currency: 'BOB', total: 40 }]}
          selectedId="COMPRAS"
          onSelect={onSelect}
        />
      </Provider>,
    );
    fireEvent.press(tree.getByLabelText('Ver Compras'));
    // Ya seleccionada → toggle a null (quita filtro)
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
