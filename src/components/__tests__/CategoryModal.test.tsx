import { fireEvent, render } from '@testing-library/react-native';
import { CategoryModal } from '../CategoryModal';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '@/expenses/categories/expenseCategories';

describe('CategoryModal', () => {
  it('lista todas las categorías y marca la seleccionada', () => {
    const { getByText, getByLabelText } = render(
      <CategoryModal visible selected={ExpenseCategory.FOOD} onClose={() => {}} onSelect={() => {}} />,
    );
    expect(getByText('Categoría')).toBeTruthy();
    for (const c of EXPENSE_CATEGORIES) {
      expect(getByLabelText(`Elegir ${c.label}`)).toBeTruthy();
    }
  });

  it('elegir llama onSelect con el id', () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <CategoryModal visible selected={ExpenseCategory.FOOD} onClose={() => {}} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText('Elegir Other'));
    expect(onSelect).toHaveBeenCalledWith(ExpenseCategory.OTHER);
  });
});
