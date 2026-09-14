import { fireEvent, render } from '@testing-library/react-native';
import { UnifiedVoiceModal } from '../UnifiedVoiceModal';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
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
      onDismissResults={() => {}}
      saving={false}
      {...props}
    />,
  );
}

describe('UnifiedVoiceModal resultados (pantalla completa)', () => {
  it('muestra todos los detectados con scroll y Save all', () => {
    const { getByText } = renderResults();
    expect(getByText('3 gastos detectados')).toBeTruthy();
    expect(getByText('Almuerzo')).toBeTruthy();
    expect(getByText('Bus')).toBeTruthy();
    expect(getByText('Cena')).toBeTruthy();
    expect(getByText('Save all (3)')).toBeTruthy();
  });

  it('editar un borrador y guardar llama onSaveOne', () => {
    const onSaveOne = jest.fn();
    const { getAllByText, getByDisplayValue } = renderResults({ onSaveOne });
    fireEvent.press(getAllByText('Edit')[0]);
    fireEvent.changeText(getByDisplayValue('Almuerzo'), 'Almuerzo editado');
    fireEvent.press(getAllByText('Save')[0]);
    expect(onSaveOne).toHaveBeenCalledTimes(1);
    expect(onSaveOne.mock.calls[0][0]).toBe(0);
    expect(onSaveOne.mock.calls[0][1]).toMatchObject({ description: 'Almuerzo editado' });
  });

  it('Save all envía todos y Cancel descarta', () => {
    const onSaveAll = jest.fn();
    const onDismissResults = jest.fn();
    const { getByText } = renderResults({ onSaveAll, onDismissResults });
    fireEvent.press(getByText('Save all (3)'));
    expect(onSaveAll).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ description: 'Almuerzo' })]));
    fireEvent.press(getByText('Cancel'));
    expect(onDismissResults).toHaveBeenCalledTimes(1);
  });

  it('un solo gasto no muestra Save all', () => {
    const { queryByText } = renderResults({ expenses: [drafts[0]] } as never);
    expect(queryByText(/Save all/)).toBeNull();
  });
});
