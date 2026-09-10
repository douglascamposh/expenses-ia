import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';

// Mock hooks
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

jest.mock('@/expenses/repositories/ExpenseRepository', () => ({
  expenseRepository: {
    delete: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve(null)),
    getAll: jest.fn(() => Promise.resolve([])),
    getRecent: jest.fn(() => Promise.resolve([])),
    getCategorySummary: jest.fn(() => Promise.resolve([])),
    create: jest.fn((e) => Promise.resolve(e)),
  },
}));

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <DashboardScreen />
    </Provider>,
  );
}

describe('Dashboard', () => {
  it('renders greeting and empty state', async () => {
    const { getByText } = renderWithStore();
    // fetchExpenses corre al montar; esperar a que SQLite mock devuelva []
    await waitFor(() => expect(getByText(/No expenses yet/)).toBeTruthy());
  });

  it('shows CTA when empty', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText(/Start tracking/)).toBeTruthy());
  });

  it('muestra la lista unificada sin duplicar (solo gasto, sin barra)', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getCategorySummary: jest.Mock };
    };
    expenseRepository.getCategorySummary.mockResolvedValueOnce([
      { category: 'FOOD', currency: 'BOB', total: 120 },
    ]);
    const { getByText, getAllByText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Food')).toBeTruthy());
    // Una sola vez y como solo-gasto (sin presupuesto no hay % ni barra)
    expect(getAllByText('Food')).toHaveLength(1);
    expect(getByText('Bs 120 gastados')).toBeTruthy();
    expect(queryByText('100%')).toBeNull();
  });

  it('botón + abre el modal de alta manual', async () => {
    const { getByLabelText, getByText, queryAllByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText(/No expenses yet/)).toBeTruthy());
    // Una sola entrada: el + del header (el + junto al micrófono se quitó)
    expect(queryAllByLabelText('Agregar gasto manual')).toHaveLength(1);
    fireEvent.press(getByLabelText('Agregar gasto manual'));
    await waitFor(() => expect(getByText('Nuevo gasto')).toBeTruthy());
  });
});
