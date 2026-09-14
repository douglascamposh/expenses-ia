import { fireEvent, render } from '@testing-library/react-native';
import { CategoryPicker } from '../CategoryPicker';
import {
  SYSTEM_CATEGORY,
  setCustomCategories,
  type CategoryConfig,
} from '@/expenses/categories/expenseCategories';

function custom(i: number): CategoryConfig {
  return {
    id: `CAT_${i}` as CategoryConfig['id'],
    label: `Cat ${i}`,
    icon: 'shippingbox.fill',
    emoji: '📦',
    color: '#3b82f6',
    kind: 'GASTO',
  };
}

afterEach(() => {
  setCustomCategories([]);
});

describe('CategoryPicker colapsable (categorías del usuario)', () => {
  it('sin customs solo muestra la del sistema y no hay Ver más', () => {
    const { getByText, queryByLabelText } = render(<CategoryPicker selected={SYSTEM_CATEGORY.id} onSelect={jest.fn()} />);
    expect(getByText(/Otros/)).toBeTruthy();
    expect(queryByLabelText('Ver más categorías')).toBeNull();
  });

  it('muestra las primeras 6 y botón Ver más con el resto', () => {
    setCustomCategories(Array.from({ length: 8 }, (_, i) => custom(i)));
    const onSelect = jest.fn();
    const { getByText, queryByText } = render(<CategoryPicker selected="CAT_0" onSelect={onSelect} />);
    expect(getByText(/Cat 0/)).toBeTruthy();
    expect(getByText('Ver más (3)')).toBeTruthy();
    // Una categoría del final no está visible aún
    expect(queryByText(/Cat 7/)).toBeNull();
  });

  it('Ver más expande todo y permite elegir', () => {
    setCustomCategories(Array.from({ length: 8 }, (_, i) => custom(i)));
    const onSelect = jest.fn();
    const { getByText, getByLabelText } = render(<CategoryPicker selected="CAT_0" onSelect={onSelect} />);
    fireEvent.press(getByLabelText('Ver más categorías'));
    expect(getByText(/Cat 7/)).toBeTruthy();
    expect(getByText('Ver menos')).toBeTruthy();
    fireEvent.press(getByText(/Cat 7/));
    expect(onSelect).toHaveBeenCalledWith('CAT_7');
    fireEvent.press(getByLabelText('Ver menos categorías'));
    expect(getByText('Ver más (3)')).toBeTruthy();
  });

  it('la seleccionada fuera de las primeras sigue visible', () => {
    setCustomCategories(Array.from({ length: 8 }, (_, i) => custom(i)));
    const { getByText } = render(<CategoryPicker selected="CAT_7" onSelect={jest.fn()} />);
    expect(getByText(/Cat 7/)).toBeTruthy();
  });
});
