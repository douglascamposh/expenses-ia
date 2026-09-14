import { fireEvent, render } from '@testing-library/react-native';
import { ExpenseRow } from '../ExpenseRow';
import type { Expense } from '@/expenses/models/Expense';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';

const expense: Expense = {
  id: 'e1', amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, kind: 'EXPENSE',
  description: 'Almuerzo', date: '2026-09-12', paymentMethod: 'CASH',
  createdAt: '2026-09-12T10:00:00.000Z', updatedAt: '2026-09-12T10:00:00.000Z',
};

describe('ExpenseRow (swipe → papelera)', () => {
  it('muestra la fila y la papelera revela onTrashPress', () => {
    const onTrash = jest.fn();
    const refs = { current: new Map() };
    const { getByLabelText } = render(
      <ExpenseRow expense={expense} onPress={jest.fn()} onTrashPress={onTrash} swipeRefs={refs} onOpen={jest.fn()} />,
    );
    expect(getByLabelText('Ver Almuerzo')).toBeTruthy();
    fireEvent.press(getByLabelText('Eliminar Almuerzo'));
    expect(onTrash).toHaveBeenCalledWith(expense);
  });

  it('tap en la fila abre el detalle', () => {
    const onPress = jest.fn();
    const refs = { current: new Map() };
    const { getByLabelText } = render(
      <ExpenseRow expense={expense} onPress={onPress} onTrashPress={jest.fn()} swipeRefs={refs} onOpen={jest.fn()} />,
    );
    fireEvent.press(getByLabelText('Ver Almuerzo'));
    expect(onPress).toHaveBeenCalled();
  });
});
