import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer, { setPendingQueue } from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';

jest.mock('@/hooks/use-audio-recording', () => ({
  useAudioRecording: () => ({
    state: 'idle',
    errorMessage: null,
    result: null,
    durationMs: 0,
    isRecording: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-analyze-audio', () => ({
  useAnalyzeAudio: () => ({
    status: 'idle',
    expenses: null,
    error: null,
    isLoading: false,
    analyze: jest.fn(),
    reset: jest.fn(),
  }),
}));

const drafts: NewExpense[] = [
  { amount: 250, currency: 'BOB', category: ExpenseCategory.FOOD, description: 'Comida', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
  { amount: 10, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Bus', date: '2026-09-07', paymentMethod: 'CASH', kind: 'EXPENSE' },
];

describe('repro: flujo Save completo en Dashboard', () => {
  it('Guardar guarda en repo y limpia la cola sin crash', async () => {
    const testStore = configureStore({
      reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const { getAllByLabelText, queryByText } = render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    );
    // Simular llegada de resultados del servidor
    testStore.dispatch(setPendingQueue(drafts.map((d) => ({ ...d }))));
    await waitFor(() => expect(getAllByLabelText('Guardar').length).toBeGreaterThan(0));
    fireEvent.press(getAllByLabelText('Guardar')[0]);
    // El thunk debe guardar y remover 1 de la cola -> queda 1 gasto detectado
    await waitFor(() => expect(queryByText('1 gasto detectado')).toBeTruthy(), { timeout: 5000 });
    expect(testStore.getState().expenses.saveError).toBeNull();
  });
});
