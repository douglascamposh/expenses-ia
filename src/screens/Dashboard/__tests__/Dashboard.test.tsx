import { render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';

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
    reducer: { expenses: expensesReducer },
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
});
