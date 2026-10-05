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
import { barColor, barFill, gradientPair, normKey, pastel } from '@/expenses/utils/colors';

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

function gradOf(tree: unknown, testID: string): unknown {
  const node = (tree as { root: { findByProps(p: object): { props: { colors: unknown } } } }).root.findByProps({
    testID,
  });
  return node.props.colors;
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
    expect(tree.getAllByText('10%').length).toBeGreaterThanOrEqual(1);
    // Única barra → queda seleccionada: degradado del rojo elegido + relleno pastel
    expect(gradOf(tree, 'grad-COMPRAS')).toEqual(gradientPair('#ef4444', 'COMPRAS', 'light'));
    expect(bgOf(tree, 'fill-COMPRAS')).toBe(pastel('#ef4444', 0.55, 'COMPRAS'));
    expect(barColor('COMPRAS')).toBe('#ec4899');
  });

  it('controlado sin filtro: píldora compacta con % y tap filtra', () => {
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
          selectedId={null}
          onSelect={onSelect}
        />
      </Provider>,
    );
    // Compacta por defecto pero con % visible
    expect(tree.getAllByText('10%').length).toBeGreaterThanOrEqual(1);
    expect(tree.getByTestId('compact-COMPRAS')).toBeTruthy();
    fireEvent.press(tree.getByLabelText('Ver Compras'));
    expect(onSelect).toHaveBeenCalledWith('COMPRAS');
  });

  it('el relleno muestra el % del budget y se capa al 100% si se pasa', () => {
    setCustomCategories([{ ...COMPRAS, color: '#ef4444' }]);
    const testStore = configureStore({
      reducer: { categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const tree = render(
      <Provider store={testStore}>
        <CategoryCarousel
          budgets={[{ category: 'COMPRAS', currency: 'BOB', limit: 400, spent: 0, pct: 0 }]}
          summary={[{ category: 'COMPRAS', currency: 'BOB', total: 308 }]}
          selectedId="COMPRAS"
          onSelect={() => {}}
        />
      </Provider>,
    );
    // 308 de 400 = 77%: el relleno lo muestra visual, el texto dice lo que falta
    const fill = tree.getByTestId('fill-COMPRAS');
    const flatFill = [fill.props.style].flat(Infinity);
    expect(flatFill).toContainEqual(expect.objectContaining({ width: '77%' }));
    expect(tree.getAllByText('77%').length).toBeGreaterThanOrEqual(1);
    expect(tree.getByText(/Falta 23%/)).toBeTruthy();
    // Sin dash: solo pista + relleno
    expect(tree.queryByTestId('dash-COMPRAS')).toBeNull();
  });

  it('sobre el límite: relleno al 100% y aviso', () => {
    setCustomCategories([{ ...COMPRAS, color: '#ef4444' }]);
    const testStore = configureStore({
      reducer: { categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const tree = render(
      <Provider store={testStore}>
        <CategoryCarousel
          budgets={[{ category: 'COMPRAS', currency: 'BOB', limit: 400, spent: 0, pct: 0 }]}
          summary={[{ category: 'COMPRAS', currency: 'BOB', total: 500 }]}
          selectedId="COMPRAS"
          onSelect={() => {}}
        />
      </Provider>,
    );
    const fill = tree.getByTestId('fill-COMPRAS');
    const flatFill = [fill.props.style].flat(Infinity);
    expect(flatFill).toContainEqual(expect.objectContaining({ width: '100%' }));
    expect(tree.getByText(/\+25% sobre/)).toBeTruthy();
  });

  it('sin budget: expandida sólida, sin relleno ni rayitas', () => {
    setCustomCategories([{ ...COMPRAS, color: '#ef4444' }]);
    const testStore = configureStore({
      reducer: { categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const tree = render(
      <Provider store={testStore}>
        <CategoryCarousel
          budgets={[]}
          summary={[{ category: 'COMPRAS', currency: 'BOB', total: 40 }]}
          selectedId="COMPRAS"
          onSelect={() => {}}
        />
      </Provider>,
    );
    expect(tree.queryByTestId('fill-COMPRAS')).toBeNull();
    expect(tree.queryByTestId('dash-COMPRAS')).toBeNull();
    expect(gradOf(tree, 'grad-COMPRAS')).toEqual(gradientPair('#ef4444', 'COMPRAS', 'light'));
  });

  it('long-press avisa la categoría y no alterna el filtro al soltar', () => {
    setCustomCategories([{ ...COMPRAS, color: '#ef4444' }]);
    const testStore = configureStore({
      reducer: { categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const onSelect = jest.fn();
    const onLongPressCategory = jest.fn();
    const tree = render(
      <Provider store={testStore}>
        <CategoryCarousel
          budgets={[]}
          summary={[{ category: 'COMPRAS', currency: 'BOB', total: 40 }]}
          selectedId={null}
          onSelect={onSelect}
          onLongPressCategory={onLongPressCategory}
        />
      </Provider>,
    );
    const bar = tree.getByLabelText('Ver Compras');
    fireEvent(bar, 'longPress');
    expect(onLongPressCategory).toHaveBeenCalledWith('COMPRAS');
    // El onPress que RN dispara al soltar tras el long-press se ignora
    fireEvent.press(bar);
    expect(onSelect).not.toHaveBeenCalled();
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

  it('gradientPair deriva [claro, base] del color según el modo', () => {
    const light = gradientPair('#ef4444', 'COMPRAS', 'light');
    const dark = gradientPair('#ef4444', 'COMPRAS', 'dark');
    expect(light).toHaveLength(2);
    expect(dark).toHaveLength(2);
    expect(light).not.toEqual(dark);
    for (const c of [...light, ...dark]) expect(c).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    // Claro por defecto
    expect(gradientPair('#ef4444', 'COMPRAS')).toEqual(light);
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
