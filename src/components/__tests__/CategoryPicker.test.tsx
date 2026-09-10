import { fireEvent, render } from '@testing-library/react-native';
import { CategoryPicker } from '../CategoryPicker';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '@/expenses/categories/expenseCategories';

describe('CategoryPicker colapsable', () => {
  it('muestra las primeras 6 y botón Ver más con el resto', () => {
    const onSelect = jest.fn();
    const { getByText, queryByText } = render(<CategoryPicker selected={ExpenseCategory.FOOD} onSelect={onSelect} />);
    expect(getByText(/Food/)).toBeTruthy();
    expect(getByText(`Ver más (${EXPENSE_CATEGORIES.length - 6})`)).toBeTruthy();
    // Una categoría del final no está visible aún
    expect(queryByText(/Other/)).toBeNull();
  });

  it('Ver más expande todo y permite elegir', () => {
    const onSelect = jest.fn();
    const { getByText, getByLabelText } = render(<CategoryPicker selected={ExpenseCategory.FOOD} onSelect={onSelect} />);
    fireEvent.press(getByLabelText('Ver más categorías'));
    expect(getByText(/Other/)).toBeTruthy();
    expect(getByText('Ver menos')).toBeTruthy();
    fireEvent.press(getByText(/Other/));
    expect(onSelect).toHaveBeenCalledWith(ExpenseCategory.OTHER);
    fireEvent.press(getByLabelText('Ver menos categorías'));
    expect(getByText(`Ver más (${EXPENSE_CATEGORIES.length - 6})`)).toBeTruthy();
  });

  it('la seleccionada fuera de las primeras sigue visible', () => {
    const { getByText } = render(<CategoryPicker selected={ExpenseCategory.OTHER} onSelect={jest.fn()} />);
    expect(getByText(/Other/)).toBeTruthy();
  });
});
