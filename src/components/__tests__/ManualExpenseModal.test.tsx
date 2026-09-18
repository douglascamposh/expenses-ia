import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ManualExpenseModal } from '../ManualExpenseModal';
import type { NewExpense } from '@/expenses/models/Expense';
import { setCustomCategories } from '@/expenses/categories/expenseCategories';

const mockDispatch = jest.fn(() => ({ unwrap: () => Promise.resolve([]) }));
jest.mock('@/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

describe('ManualExpenseModal (flujo mockup)', () => {
  it('vacío muestra descripción, monto y carrusel sin moneda', () => {
    const { getByPlaceholderText, getByLabelText, queryByText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} />,
    );
    expect(getByPlaceholderText('En qué gasté')).toBeTruthy();
    expect(getByPlaceholderText('Monto')).toBeTruthy();
    expect(getByLabelText('Guardar')).toBeTruthy();
    expect(queryByText('Cambiar moneda')).toBeNull();
  });

  it('monto + descripción + categoría guarda con la moneda por defecto', async () => {
    const onSave = jest.fn();
    const today = new Date().toISOString().split('T')[0];
    const { getByPlaceholderText, getByLabelText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Compra en Amazon');
    fireEvent.changeText(getByPlaceholderText('Monto'), '250');
    // Elegir la categoría del sistema desde el carrusel
    fireEvent.press(getByLabelText('Otros'));
    fireEvent.press(getByLabelText('Guardar'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const draft = onSave.mock.calls[0][0] as NewExpense;
    expect(draft.amount).toBe(250);
    expect(draft.description).toBe('Compra en Amazon');
    expect(draft.currency).toBe('BOB');
    expect(draft.date).toBe(today);
    expect(draft.paymentMethod).toBe('CASH');
    expect(draft.kind).toBe('EXPENSE');
  });

  it('toggle a ingreso pinta el flujo y guarda INCOME', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText, getByLabelText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Sueldo');
    fireEvent.changeText(getByPlaceholderText('Monto'), '1000');
    fireEvent.press(getByLabelText('Marcar como ingreso'));
    fireEvent.press(getByLabelText('Otros'));
    fireEvent.press(getByLabelText('Guardar'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0][0] as NewExpense).kind).toBe('INCOME');
  });

  it('sin categoría muestra toast y no guarda', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText, getByLabelText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Algo');
    fireEvent.changeText(getByPlaceholderText('Monto'), '10');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('La transacción requiere categoría')).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sin monto muestra toast y no guarda', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText, getByLabelText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Algo');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Ingresa un monto mayor a 0')).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('+ abre directo el formulario de nueva categoría y la deja seleccionada', async () => {
    mockDispatch.mockClear();
    setCustomCategories([
      { id: 'MASCOTAS', label: 'Mascotas', icon: 'paw', emoji: '🐶', color: '#10b981', kind: 'GASTO' } as never,
    ]);
    try {
      const { getByLabelText, getByText, getAllByLabelText, getByPlaceholderText, queryByText } = render(
        <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} />,
      );
      // + ya no abre lista: abre el formulario
      fireEvent.press(getByLabelText('Agregar categoría'));
      expect(getByText('Nueva categoría')).toBeTruthy();
      fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
      // Guardar del formulario (el último 'Guardar' en pantalla: form + modal)
      const savers = getAllByLabelText('Guardar');
      fireEvent.press(savers[savers.length - 1]);
      await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
      // Creada (dispatch del thunk) y seleccionada en el carrusel
      await waitFor(() => expect(queryByText('Nueva categoría')).toBeNull());
      expect(getByLabelText('Mascotas')).toBeTruthy();
    } finally {
      setCustomCategories([]);
    }
  });

  it('chip de recurrencia default Una vez y cambia a Mensual', async () => {
    const { getByText, getByLabelText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} />,
    );
    await waitFor(() => expect(getByText('Una vez')).toBeTruthy());
    fireEvent.press(getByLabelText('Cambiar recurrencia'));
    await waitFor(() => expect(getByText('Repetir')).toBeTruthy());
    fireEvent.press(getByLabelText('Mensual'));
    await waitFor(() => expect(getByText('Mensual')).toBeTruthy());
  });

  it('usa la moneda por defecto recibida y ya no hay campo etiqueta', async () => {
    const onSave = jest.fn();
    const { getByPlaceholderText, getByLabelText, queryByPlaceholderText } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={onSave} defaultCurrency="PEN" />,
    );
    expect(queryByPlaceholderText('Etiqueta')).toBeNull();
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Menú');
    fireEvent.changeText(getByPlaceholderText('Monto'), '50');
    fireEvent.press(getByLabelText('Otros'));
    fireEvent.press(getByLabelText('Guardar'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const draft = onSave.mock.calls[0][0] as NewExpense;
    expect(draft.currency).toBe('PEN');
    expect(draft.description).toBe('Menú');
  });

  it('X llama onClose', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <ManualExpenseModal visible saving={false} onClose={onClose} onSave={() => {}} />,
    );
    fireEvent.press(getByLabelText('Cerrar formulario'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('conserva el borrador al reabrir con el mismo resetKey', () => {
    const { getByPlaceholderText, rerender } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} resetKey={1} />,
    );
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Taxi al centro');
    rerender(
      <ManualExpenseModal visible={false} saving={false} onClose={() => {}} onSave={() => {}} resetKey={1} />,
    );
    rerender(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} resetKey={1} />,
    );
    expect(getByPlaceholderText('En qué gasté').props.value).toBe('Taxi al centro');
  });

  it('reinicia el borrador con un resetKey nuevo', () => {
    const { getByPlaceholderText, rerender } = render(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} resetKey={1} />,
    );
    fireEvent.changeText(getByPlaceholderText('En qué gasté'), 'Taxi al centro');
    rerender(
      <ManualExpenseModal visible saving={false} onClose={() => {}} onSave={() => {}} resetKey={2} />,
    );
    expect(getByPlaceholderText('En qué gasté').props.value).toBe('');
  });
});
