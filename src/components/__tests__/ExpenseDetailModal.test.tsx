import { fireEvent, render } from '@testing-library/react-native';
import { ExpenseDetailModal } from '../ExpenseDetailModal';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
import type { Expense } from '@/expenses/models/Expense';

const base: Expense = {
  id: 'e1',
  amount: 35,
  currency: 'BOB',
  category: ExpenseCategory.FOOD,
  description: 'Comida',
  date: '2026-09-07',
  paymentMethod: 'CARD',
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
};

describe('ExpenseDetailModal (edición en fullscreen)', () => {
  it('editar abre el modal fullscreen y guardar llama onEdit con el patch', () => {
    const onEdit = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <ExpenseDetailModal expense={base} visible onClose={() => {}} onDelete={() => {}} onEdit={onEdit} saving={false} />,
    );
    fireEvent.press(getByText('Edit'));
    expect(getByText('Editar gasto')).toBeTruthy();
    fireEvent.changeText(getByDisplayValue('Comida'), 'Cena');
    fireEvent.press(getByText('Guardar'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toMatchObject({ description: 'Cena', amount: 35, paymentMethod: 'CARD' });
  });

  it('muestra la tarjeta resumen con monto y fecha', () => {
    const { getByText } = render(
      <ExpenseDetailModal expense={base} visible onClose={() => {}} onDelete={() => {}} onEdit={() => {}} saving={false} />,
    );
    fireEvent.press(getByText('Edit'));
    expect(getByText('Bs 35.00')).toBeTruthy();
    expect(getByText(/Food ·/)).toBeTruthy();
  });

  it('Cancelar cierra sin llamar onEdit', () => {
    const onEdit = jest.fn();
    const { getByText, getByDisplayValue, queryByText } = render(
      <ExpenseDetailModal expense={base} visible onClose={() => {}} onDelete={() => {}} onEdit={onEdit} saving={false} />,
    );
    fireEvent.press(getByText('Edit'));
    fireEvent.changeText(getByDisplayValue('Comida'), 'Cena');
    fireEvent.press(getByText('Cancelar'));
    expect(onEdit).not.toHaveBeenCalled();
    expect(queryByText('Guardar')).toBeNull();
  });
});
