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
  paymentMethod: 'CARD', kind: 'EXPENSE',
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
};

function renderModal(props = {}) {
  return render(
    <ExpenseDetailModal
      expense={base}
      visible
      onClose={() => {}}
      onSave={() => {}}
      {...props}
    />,
  );
}

describe('ExpenseDetailModal (misma interfaz que agregar)', () => {
  it('muestra el borrador editable y un solo Guardar (sin Edit/Delete)', () => {
    const { getByDisplayValue, getByLabelText, queryByText } = renderModal();
    expect(getByDisplayValue('Comida')).toBeTruthy();
    expect(getByDisplayValue('35')).toBeTruthy();
    expect(getByLabelText('Guardar')).toBeTruthy();
    expect(queryByText('Edit')).toBeNull();
    expect(queryByText('Delete')).toBeNull();
  });

  it('Guardar envía el patch editado', () => {
    const onSave = jest.fn();
    const { getByDisplayValue, getByLabelText } = renderModal({ onSave });
    fireEvent.changeText(getByDisplayValue('Comida'), 'Cena');
    fireEvent.press(getByLabelText('Otros'));
    fireEvent.press(getByLabelText('Guardar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ description: 'Cena', amount: 35, category: 'OTHER' });
  });

  it('Cerrar llama onClose', () => {
    const onClose = jest.fn();
    const { getAllByLabelText } = renderModal({ onClose });
    // [0] = backdrop, [último] = botón X del detalle
    const closers = getAllByLabelText('Cerrar');
    fireEvent.press(closers[closers.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin tag visible: oculta Etiqueta, pago con icono y conserva el tag al guardar', () => {
    const onSave = jest.fn();
    const tagged: Expense = { ...base, description: 'Comida #fiesta' };
    const { getByDisplayValue, getByLabelText, getByText, queryByPlaceholderText } = render(
      <ExpenseDetailModal expense={tagged} visible onClose={() => {}} onSave={onSave} />,
    );
    // Descripción limpia y sin input de etiqueta
    expect(getByDisplayValue('Comida')).toBeTruthy();
    expect(queryByPlaceholderText('Etiqueta')).toBeNull();
    // Pago con icono en vez de almohadilla (CARD → tarjeta)
    expect(getByText('tarjeta')).toBeTruthy();
    fireEvent.press(getByLabelText('Guardar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ description: 'Comida #fiesta' });
  });

  it('sin gasto no renderiza nada', () => {
    const { queryByLabelText } = render(
      <ExpenseDetailModal expense={null} visible onClose={() => {}} onSave={() => {}} />,
    );
    expect(queryByLabelText('Guardar')).toBeNull();
  });
});
