import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';

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
    getByMonthRange: jest.fn(() => Promise.resolve([])),
    getCategorySummary: jest.fn(() => Promise.resolve([{ category: 'FOOD', currency: 'BOB', total: 600 }])),
    getMonthlyTotals: jest.fn(() => Promise.resolve([])),
    getOldestDate: jest.fn(() => Promise.resolve(null)),
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
      reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const { getByText, getAllByText, getByLabelText, getAllByLabelText } = render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    );
    await waitFor(() => expect(getByLabelText('Ver Food')).toBeTruthy(), { timeout: 5000 });
    // FOOD sale una sola vez como barra vertical, con monto y % del total
    expect(getAllByLabelText('Ver Food')).toHaveLength(1);
    expect(getAllByText('600').length).toBeGreaterThanOrEqual(1);
    // 600 de 500 = 120% del budget (igual que el detalle) y sobre el límite
    expect(getByText('120%')).toBeTruthy();
    expect(getByText('+20% sobre')).toBeTruthy();
    // TRANSPORT con presupuesto también
    expect(getByLabelText('Ver Transport')).toBeTruthy();
    expect(getAllByText('60').length).toBeGreaterThanOrEqual(1);
    // Pulsar una categoría no debe crashear
    fireEvent.press(getByLabelText('Ver Food'));
  });

  it('hero muestra restante del presupuesto y toggle gastos/ingresos', async () => {
    const testStore = configureStore({
      reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const { getByText, getByLabelText } = render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    );
    // Restante = (500 + 400) - (600 + 60) = 240
    await waitFor(() => expect(getByText(/presupuesto restante/)).toBeTruthy(), { timeout: 5000 });
    expect(getByText(/240/)).toBeTruthy();
    expect(getByLabelText('Ver gastos del mes')).toBeTruthy();
    expect(getByLabelText('Ver ingresos del mes')).toBeTruthy();
  });
});
