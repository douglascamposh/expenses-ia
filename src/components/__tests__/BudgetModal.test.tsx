import { fireEvent, render } from '@testing-library/react-native';
import { BudgetModal } from '../BudgetModal';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';

describe('BudgetModal', () => {
  it('lista presupuestos y guarda uno nuevo válido', () => {
    const onSave = jest.fn();
    const { getByText, getAllByText, getByPlaceholderText } = render(
      <BudgetModal
        visible
        saving={false}
        budgets={[{ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' }]}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />,
    );
    expect(getByText('Editar presupuesto')).toBeTruthy();
    // Food aparece en la lista y en el selector de categoría
    expect(getAllByText('Food')).toHaveLength(2);

    fireEvent.changeText(getByPlaceholderText('0.00'), '300');
    fireEvent.press(getByText('Guardar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ amount: 300, currency: 'BOB' });
  });

  it('no guarda con monto inválido y muestra error', () => {
    const onSave = jest.fn();
    const { getByText, queryByText } = render(
      <BudgetModal visible saving={false} budgets={[]} onClose={() => {}} onSave={onSave} onDelete={() => {}} />,
    );
    expect(getByText('Nuevo presupuesto')).toBeTruthy();
    fireEvent.press(getByText('Guardar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(queryByText(/mayor a 0/)).toBeTruthy();
  });

  it('Cancelar llama onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <BudgetModal visible saving={false} budgets={[]} onClose={onClose} onSave={() => {}} onDelete={() => {}} />,
    );
    fireEvent.press(getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Eliminar pide confirmación y llama onDelete', () => {
    const onDelete = jest.fn();
    const { getByText } = render(
      <BudgetModal
        visible
        saving={false}
        budgets={[{ category: ExpenseCategory.FOOD, amount: 500, currency: 'BOB' }]}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.press(getByText('Eliminar'));
    fireEvent.press(getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(ExpenseCategory.FOOD);
  });
});
