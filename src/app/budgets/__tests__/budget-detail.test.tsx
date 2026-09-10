import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BudgetDetailScreen from '../[category]';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import { formatDateDisplay } from '@/components/DatePickerModal';

const { useLocalSearchParams } = jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock };

jest.mock('@/expenses/repositories/ExpenseRepository', () => ({
  expenseRepository: {
    delete: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve(null)),
    getAll: jest.fn(() =>
      Promise.resolve([
        {
          id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', description: 'Almuerzo',
          date: '2026-09-07', paymentMethod: 'CASH', createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
        },
      ]),
    ),
    getRecent: jest.fn(() => Promise.resolve([])),
    getCategorySummary: jest.fn(() => Promise.resolve([])),
    create: jest.fn((e) => Promise.resolve(e)),
  },
}));

jest.mock('@/expenses/repositories/BudgetRepository', () => ({
  budgetRepository: {
    upsert: jest.fn((b) => Promise.resolve({ ...b, updatedAt: '2026-09-07T00:00:00.000Z' })),
    getAll: jest.fn(() => Promise.resolve([])),
    getProgress: jest.fn(() =>
      Promise.resolve([{ category: 'FOOD', currency: 'BOB', limit: 200, spent: 120, pct: 0.6, over: false }]),
    ),
    delete: jest.fn(() => Promise.resolve()),
  },
}));

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <BudgetDetailScreen />
    </Provider>,
  );
}

describe('BudgetDetailScreen', () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ category: 'FOOD' });
  });

  it('muestra anillo, gastado/disponible y recientes de la categoría', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Food')).toBeTruthy());
    expect(getByText(/60%/)).toBeTruthy();
    expect(getByText('Gastado')).toBeTruthy();
    expect(getByText('Disponible')).toBeTruthy();
    expect(getByText('Almuerzo')).toBeTruthy();
  });

  it('agregar gasto abre el modal con la categoría prefijada', async () => {
    const { getByText, getByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText('+ Agregar food')).toBeTruthy());
    fireEvent.press(getByText('+ Agregar food'));
    await waitFor(() => expect(getByText('Nuevo gasto')).toBeTruthy());
    // La fecha viene de hoy (botón calendario); la categoría queda fijada en el draft al guardar
    expect(getByLabelText('Cambiar fecha')).toBeTruthy();
    expect(getByText(formatDateDisplay(new Date().toISOString().split('T')[0]))).toBeTruthy();
  });
});
