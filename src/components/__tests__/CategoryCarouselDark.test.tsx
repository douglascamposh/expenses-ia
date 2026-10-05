import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CategoryCarousel } from '../CategoryCarousel';
import categoriesReducer from '@/store/categoriesSlice';
import {
  setCustomCategories,
  type CategoryConfig,
} from '@/expenses/categories/expenseCategories';
import { gradientPair } from '@/expenses/utils/colors';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'dark',
}));

const COMPRAS: CategoryConfig = {
  id: 'COMPRAS' as CategoryConfig['id'],
  label: 'Compras',
  icon: 'bag.fill',
  emoji: '🛍',
  color: '#ef4444',
  kind: 'GASTO',
};

function renderCarousel() {
  setCustomCategories([COMPRAS]);
  const testStore = configureStore({
    reducer: { categories: categoriesReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <CategoryCarousel
        budgets={[{ category: 'COMPRAS', currency: 'BOB', limit: 400, spent: 40, pct: 0.1 }]}
        summary={[{ category: 'COMPRAS', currency: 'BOB', total: 40 }]}
        onPressCategory={() => {}}
      />
    </Provider>,
  );
}

afterEach(() => {
  setCustomCategories([]);
});

describe('CategoryCarousel modo oscuro', () => {
  it('usa el degradado saturado y texto blanco', () => {
    const tree = renderCarousel();
    const grad = tree.root.findByProps({ testID: 'grad-COMPRAS' });
    expect(grad.props.colors).toEqual(gradientPair('#ef4444', 'COMPRAS', 'dark'));
    // Monto en blanco (compacta + expandida lo renderizan)
    const amounts = tree.root.findAllByProps({ children: 40 });
    expect(amounts.length).toBeGreaterThanOrEqual(1);
    for (const n of amounts) {
      const flat = [n.props.style].flat(Infinity);
      expect(flat).toContainEqual(expect.objectContaining({ color: '#FFFFFF' }));
    }
  });
});
