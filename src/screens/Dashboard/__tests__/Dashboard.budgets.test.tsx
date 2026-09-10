import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';

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
    getCategorySummary: jest.fn(() => Promise.resolve([{ category: 'FOOD', currency: 'BOB', total: 600 }])),
    create: jest.fn((e) => Promise.resolve(e)),
  },
}));

jest.mock('@/expenses/repositories/BudgetRepository', () => ({
  budgetRepository: {
    upsert: jest.fn((b) => Promise.resolve({ ...b, updatedAt: '2026-09-07T00:00:00.000Z' })),
    getAll: jest.fn(() => Promise.resolve([])),
    getProgress: jest.fn(() =>
      Promise.resolve([
        { category: 'FOOD', currency: 'BOB', limit: 500, spent: 600, pct: 1.2, over: true },
        { category: 'TRANSPORT', currency: 'BOB', limit: 400, spent: 60, pct: 0.15, over: false },
      ]),
    ),
    delete: jest.fn(() => Promise.resolve()),
  },
}));

describe('Dashboard lista unificada de categorías', () => {
  it('cada categoría sale una sola vez: FOOD con presupuesto, sin duplicar el resumen', async () => {
    const testStore = configureStore({
      reducer: { expenses: expensesReducer, settings: settingsReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const { getByText, getAllByText, getByLabelText } = render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    );
    await waitFor(() => expect(getByText('Categorías')).toBeTruthy());
    // FOOD sale una sola vez, con formato presupuesto (600/500, 120%)
    expect(getAllByText('Food')).toHaveLength(1);
    expect(getByText('Bs 600 / 500')).toBeTruthy();
    expect(getByText(/120%/)).toBeTruthy();
    // TRANSPORT con presupuesto también
    expect(getByText('Bs 60 / 400')).toBeTruthy();
    // Enlace a la pantalla dedicada (no debe crashear al pulsar)
    fireEvent.press(getByLabelText('Ver todas las categorías'));
  });
});
