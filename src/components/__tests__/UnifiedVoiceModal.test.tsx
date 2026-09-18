import { fireEvent, render } from '@testing-library/react-native';
import { UnifiedVoiceModal } from '../UnifiedVoiceModal';
import { ExpenseCategory, setCustomCategories } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';

const drafts: NewExpense[] = [
  { amount: 35, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Almuerzo', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
  { amount: 10, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Bus', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
  { amount: 20, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Cena', date: '2026-09-07', paymentMethod: 'CARD', kind: 'EXPENSE' },
];

function renderResults(props = {}) {
  return render(
    <UnifiedVoiceModal
      visible
      phase="results"
      expenses={drafts}
      onStop={() => {}}
      onClose={() => {}}
      onCancelAnalyzing={() => {}}
      onSaveOne={() => {}}
      onSaveAll={() => {}}
      onDeleteOne={() => {}}
      onDismissResults={() => {}}
      saving={false}
      {...props}
    />,
  );
}

describe('UnifiedVoiceModal resultados (pantalla completa)', () => {
  it('muestra todos los detectados con scroll y Guardar todo', () => {
    const { getByText, getByDisplayValue } = renderResults();
    expect(getByText('3 gastos detectados')).toBeTruthy();
    expect(getByDisplayValue('Almuerzo')).toBeTruthy();
    expect(getByDisplayValue('Bus')).toBeTruthy();
    expect(getByDisplayValue('Cena')).toBeTruthy();
    expect(getByText('Guardar todo (3)')).toBeTruthy();
  });

  it('editar un borrador y guardar llama onSaveOne', () => {
    const onSaveOne = jest.fn();
    const { getAllByLabelText, getByDisplayValue } = renderResults({ onSaveOne });
    fireEvent.changeText(getByDisplayValue('Almuerzo'), 'Almuerzo editado');
    fireEvent.press(getAllByLabelText('Guardar')[0]);
    expect(onSaveOne).toHaveBeenCalledTimes(1);
    expect(onSaveOne.mock.calls[0][0]).toBe(0);
    expect(onSaveOne.mock.calls[0][1]).toMatchObject({ description: 'Almuerzo editado' });
  });

  it('Guardar todo envía todos y la X descarta', () => {
    const onSaveAll = jest.fn();
    const onDismissResults = jest.fn();
    const { getByText, getByLabelText } = renderResults({ onSaveAll, onDismissResults });
    fireEvent.press(getByText('Guardar todo (3)'));
    expect(onSaveAll).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ description: 'Almuerzo' })]));
    fireEvent.press(getByLabelText('Cerrar resultados'));
    expect(onDismissResults).toHaveBeenCalledTimes(1);
  });

  it('un solo gasto no muestra Guardar todo', () => {
    const { queryByText } = renderResults({ expenses: [drafts[0]] } as never);
    expect(queryByText(/Guardar todo/)).toBeNull();
  });

  it('la X pide confirmación y Eliminar quita el item', () => {
    const onDeleteOne = jest.fn();
    const { getAllByLabelText, getByText, queryByText } = renderResults({ onDeleteOne });
    fireEvent.press(getAllByLabelText('Eliminar Almuerzo')[0]);
    expect(getByText('¿Eliminar?')).toBeTruthy();
    fireEvent.press(getByText('Eliminar'));
    expect(onDeleteOne).toHaveBeenCalledTimes(1);
    expect(onDeleteOne).toHaveBeenCalledWith(0);
    expect(queryByText('¿Eliminar?')).toBeNull();
  });

  it('Cancelar en la confirmación no quita el item', () => {
    const onDeleteOne = jest.fn();
    const { getAllByLabelText, getByText, queryByText } = renderResults({ onDeleteOne });
    fireEvent.press(getAllByLabelText('Eliminar Bus')[0]);
    fireEvent.press(getByText('Cancelar'));
    expect(onDeleteOne).not.toHaveBeenCalled();
    expect(queryByText('¿Eliminar?')).toBeNull();
  });

  it('editor sin monedas: carrusel cambia categoría y fecha abre selector', () => {
    setCustomCategories([
      { id: 'FOOD', label: 'Food', icon: 'x', emoji: '🍔', color: '#f97316', kind: 'GASTO' },
      { id: 'TRANSPORT', label: 'Transport', icon: 'x', emoji: '🚗', color: '#3b82f6', kind: 'GASTO' },
    ] as never);
    try {
      const onSaveOne = jest.fn();
      const { getAllByLabelText, getByLabelText, getByText, queryByText } = renderResults({ onSaveOne });
      // Sin grilla de monedas (usa la del sistema)
      expect(queryByText('USD')).toBeNull();
      expect(queryByText('EUR')).toBeNull();
      // Carrusel del primer borrador: cambiar a Transporte y guardar
      fireEvent.press(getAllByLabelText('Transport')[0]);
    // Fecha abre el selector, elige un día y acepta
    fireEvent.press(getAllByLabelText('Cambiar fecha')[0]);
    fireEvent.press(getByLabelText('Elegir 2026-09-08'));
    fireEvent.press(getByText('Aceptar'));
    fireEvent.press(getAllByLabelText('Guardar')[0]);
      expect(onSaveOne).toHaveBeenCalledTimes(1);
      expect(onSaveOne.mock.calls[0][1]).toMatchObject({ category: 'TRANSPORT', date: '2026-09-08' });
    } finally {
      setCustomCategories([]);
    }
  });
});
