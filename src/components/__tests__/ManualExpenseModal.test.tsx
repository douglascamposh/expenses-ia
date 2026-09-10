import { fireEvent, render } from '@testing-library/react-native';
import { ManualExpenseModal } from '../ManualExpenseModal';
import { formatDateDisplay } from '../DatePickerModal';
import type { NewExpense } from '@/expenses/models/Expense';

describe('ManualExpenseModal', () => {
  it('renderiza el formulario con fecha de hoy y guarda un gasto válido', () => {
    const onSave = jest.fn();
    const today = new Date().toISOString().split('T')[0];
    const { getByText, getByPlaceholderText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    expect(getByText('Nuevo gasto')).toBeTruthy();
    // La fecha por defecto es hoy (botón calendario, ya no input de texto)
    expect(getByText(formatDateDisplay(today))).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('0.00'), '250');
    fireEvent.changeText(getByPlaceholderText('¿En qué gastaste?'), 'Compra en Amazon');
    fireEvent.press(getByText('Save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0][0] as NewExpense;
    expect(draft.amount).toBe(250);
    expect(draft.description).toBe('Compra en Amazon');
    expect(draft.currency).toBe('BOB');
    expect(draft.date).toBe(today);
    expect(draft.paymentMethod).toBe('CASH');
  });

  it('permite elegir Tarjeta como método de pago', () => {
    const onSave = jest.fn();
    const today = new Date().toISOString().split('T')[0];
    const { getByText, getByPlaceholderText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');
    fireEvent.changeText(getByPlaceholderText('¿En qué gastaste?'), 'Cena');
    fireEvent.press(getByText(/Tarjeta/));
    fireEvent.press(getByText('Save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0][0] as NewExpense;
    expect(draft.paymentMethod).toBe('CARD');
    expect(draft.date).toBe(today);
  });

  it('no llama onSave con formulario inválido y muestra el error', () => {
    const onSave = jest.fn();
    const { getByText, queryByText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    // Formulario pristine: amount 0 + descripción vacía -> inválido
    fireEvent.press(getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(queryByText(/amount debe ser|description es requerida/i)).toBeTruthy();
  });

  it('usa la moneda por defecto recibida', () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} defaultCurrency="PEN" />,
    );
    fireEvent.changeText(getByPlaceholderText('0.00'), '50');
    fireEvent.changeText(getByPlaceholderText('¿En qué gastaste?'), 'Menú');
    fireEvent.press(getByText('Save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0][0] as NewExpense).currency).toBe('PEN');
  });

  it('Cancel llama onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <ManualExpenseModal visible saving={false} onClose={onClose} onSave={() => {}} />,
    );
    fireEvent.press(getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
