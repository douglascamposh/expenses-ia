import { fireEvent, render } from '@testing-library/react-native';
import { ExpenseForm } from '../ExpenseForm';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';

const base: NewExpense = {
  amount: 35,
  currency: 'BOB',
  category: ExpenseCategory.FOOD,
  description: 'Comida',
  date: '2026-09-07',
  paymentMethod: 'CASH',
};

describe('ExpenseForm (monto + moneda lado a lado)', () => {
  it('muestra monto y botón de moneda juntos', () => {
    const { getByDisplayValue, getByLabelText } = render(
      <ExpenseForm value={base} onChange={() => {}} />,
    );
    expect(getByDisplayValue('35')).toBeTruthy();
    expect(getByLabelText('Cambiar moneda')).toBeTruthy();
  });

  it('la categoría abre el modal y elegir actualiza', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <ExpenseForm value={base} onChange={onChange} />,
    );
    fireEvent.press(getByLabelText('Cambiar categoría'));
    expect(getByLabelText('Elegir Other')).toBeTruthy();
    fireEvent.press(getByLabelText('Elegir Other'));
    expect(onChange).toHaveBeenCalledWith({ category: 'OTHER' });
  });

  it('la fecha abre el calendario y elegir actualiza', () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText } = render(
      <ExpenseForm value={base} onChange={onChange} />,
    );
    fireEvent.press(getByLabelText('Cambiar fecha'));
    expect(getByText('Seleccionar fecha')).toBeTruthy();
    fireEvent.press(getByLabelText('Elegir 2026-09-10'));
    fireEvent.press(getByText('Aceptar'));
    expect(onChange).toHaveBeenCalledWith({ date: '2026-09-10' });
  });

  it('el selector expande la lista y cambia la moneda', () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByText } = render(
      <ExpenseForm value={base} onChange={onChange} />,
    );
    // Lista colapsada: USD no visible
    expect(queryByText('USD')).toBeNull();
    fireEvent.press(getByLabelText('Cambiar moneda'));
    expect(getByText('USD')).toBeTruthy();
    fireEvent.press(getByText('USD'));
    expect(onChange).toHaveBeenCalledWith({ currency: 'USD' });
  });
});
