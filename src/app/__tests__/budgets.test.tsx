import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BudgetsScreen from '../budgets';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import { formatMonthLabel } from '@/expenses/utils/format';

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

jest.mock('@/expenses/repositories/BudgetRepository', () => ({
  budgetRepository: {
    upsert: jest.fn((b) => Promise.resolve({ ...b, updatedAt: '2026-09-07T00:00:00.000Z' })),
    getAll: jest.fn(() => Promise.resolve([])),
    getProgress: jest.fn(() =>
      Promise.resolve([
        { category: 'FOOD', currency: 'BOB', limit: 200, spent: 120, pct: 0.6, over: false },
        { category: 'TRANSPORT', currency: 'BOB', limit: 150, spent: 60, pct: 0.4, over: false },
      ]),
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
      <BudgetsScreen />
    </Provider>,
  );
}

describe('BudgetsScreen', () => {
  it('muestra total agregado y lista de categorías', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Total de presupuestos')).toBeTruthy());
    expect(getByText(/60%/)).toBeTruthy();
    expect(getByText(/40%/)).toBeTruthy();
    expect(getByText('Food')).toBeTruthy();
  });

  it('botón abre el modal de agregar presupuesto', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('+ Agregar presupuesto')).toBeTruthy());
    fireEvent.press(getByText('+ Agregar presupuesto'));
    await waitFor(() => expect(getByText('Editar presupuesto')).toBeTruthy());
  });

  it('píldora de período y filas estilo mockup', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Total de presupuestos')).toBeTruthy());
    // Píldora con el mes en curso (etiqueta del período actual)
    expect(getByText(formatMonthLabel(new Date()))).toBeTruthy();
    // Fila compacta: símbolo + gastado/límite
    expect(getByText('Bs 120 / 200')).toBeTruthy();
    expect(getByText('Bs 60 / 150')).toBeTruthy();
  });

  it('botón circular + abre el modal', async () => {
    const { getByText, getByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText('Total de presupuestos')).toBeTruthy());
    fireEvent.press(getByLabelText('Agregar presupuesto'));
    await waitFor(() => expect(getByText('Editar presupuesto')).toBeTruthy());
  });
});
