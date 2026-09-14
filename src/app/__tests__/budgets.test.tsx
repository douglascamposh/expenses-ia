import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BudgetsScreen from '../budgets';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';
import { formatMonthLabel } from '@/expenses/utils/format';

jest.mock('@/expenses/repositories/ExpenseRepository', () => ({
  expenseRepository: {
    delete: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve(null)),
    getAll: jest.fn(() => Promise.resolve([])),
    getRecent: jest.fn(() => Promise.resolve([])),
    getByMonthRange: jest.fn(() => Promise.resolve([])),
    getCategorySummary: jest.fn(() => Promise.resolve([])),
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
        { category: 'COMIDA', currency: 'BOB', limit: 200, spent: 120, pct: 0.6, over: false },
      ]),
    ),
    delete: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/expenses/repositories/CategoryRepository', () => ({
  categoryRepository: {
    getCustom: jest.fn(() =>
      Promise.resolve([
        { id: 'COMIDA', label: 'Comida', icon: 'food', emoji: '🍔', color: '#ef4444', kind: 'GASTO' },
        { id: 'TRANSPORTE', label: 'Transporte', icon: 'car', emoji: '🚕', color: '#eab308', kind: 'GASTO' },
      ]),
    ),
    create: jest.fn((c) => Promise.resolve(c)),
    update: jest.fn((id, c) => Promise.resolve({ id, ...c })),
    delete: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
  },
}));

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <BudgetsScreen />
    </Provider>,
  );
}

describe('BudgetsScreen (lista de categorías)', () => {
  it('muestra total y secciones con/sin presupuesto', async () => {
    const { getByText, getAllByText } = renderWithStore();
    await waitFor(() => expect(getByText('Total de presupuestos')).toBeTruthy());
    expect(getByText(/60%/)).toBeTruthy();
    expect(getByText('Con presupuesto')).toBeTruthy();
    expect(getByText('Sin presupuesto')).toBeTruthy();
    expect(getByText('Comida')).toBeTruthy();
    expect(getByText('BOB 200')).toBeTruthy();
    expect(getByText('Transporte')).toBeTruthy();
    // Transporte + Otros (sistema) sin presupuesto
    expect(getAllByText('Sin presupuesto establecido')).toHaveLength(2);
  });

  it('píldora con el mes visible', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Total de presupuestos')).toBeTruthy());
    expect(getByText(formatMonthLabel(new Date()))).toBeTruthy();
  });

  it('tap en fila sin presupuesto crea el monto inline', async () => {
    const { budgetRepository } = jest.requireMock('@/expenses/repositories/BudgetRepository') as {
      budgetRepository: { upsert: jest.Mock };
    };
    budgetRepository.upsert.mockClear();
    const { getByLabelText, getByTestId, getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Transporte')).toBeTruthy());
    fireEvent.press(getByLabelText('Presupuesto Transporte'));
    const input = getByTestId('budget-amount-TRANSPORTE');
    fireEvent.changeText(input, '350');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    await waitFor(() => expect(budgetRepository.upsert).toHaveBeenCalled());
    expect(budgetRepository.upsert.mock.calls[0][0]).toMatchObject({
      category: 'TRANSPORTE',
      amount: 350,
      currency: 'BOB',
    });
  });

  it('tap en fila con presupuesto edita el monto inline', async () => {
    const { budgetRepository } = jest.requireMock('@/expenses/repositories/BudgetRepository') as {
      budgetRepository: { upsert: jest.Mock };
    };
    budgetRepository.upsert.mockClear();
    const { getByLabelText, getByTestId, getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Comida')).toBeTruthy());
    fireEvent.press(getByLabelText('Presupuesto Comida'));
    expect(getByTestId('budget-amount-COMIDA').props.value).toBe('200');
    fireEvent.changeText(getByTestId('budget-amount-COMIDA'), '250');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    await waitFor(() => expect(budgetRepository.upsert).toHaveBeenCalled());
    expect(budgetRepository.upsert.mock.calls[0][0]).toMatchObject({
      category: 'COMIDA',
      amount: 250,
      currency: 'BOB',
    });
  });

  it('monto inválido no guarda y muestra error', async () => {
    const { budgetRepository } = jest.requireMock('@/expenses/repositories/BudgetRepository') as {
      budgetRepository: { upsert: jest.Mock };
    };
    budgetRepository.upsert.mockClear();
    const { getByLabelText, getByTestId, getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Comida')).toBeTruthy());
    fireEvent.press(getByLabelText('Presupuesto Comida'));
    fireEvent.changeText(getByTestId('budget-amount-COMIDA'), '0');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    await waitFor(() => expect(getByText(/mayor a 0/)).toBeTruthy());
    expect(budgetRepository.upsert).not.toHaveBeenCalled();
  });

  it('swipe en fila con presupuesto borra directo', async () => {
    const { budgetRepository } = jest.requireMock('@/expenses/repositories/BudgetRepository') as {
      budgetRepository: { delete: jest.Mock };
    };
    budgetRepository.delete.mockClear();
    const { getByLabelText, getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Comida')).toBeTruthy());
    fireEvent.press(getByLabelText('Eliminar presupuesto Comida'));
    await waitFor(() => expect(budgetRepository.delete).toHaveBeenCalledWith('COMIDA'));
  });

  it('tarjeta de alertas: toggle activa y muestra el umbral', async () => {
    const { getByText, getByTestId } = renderWithStore();
    await waitFor(() => expect(getByText('Alertas de presupuesto')).toBeTruthy());
    expect(getByText('Umbral de alerta')).toBeTruthy();
    expect(getByText('80%')).toBeTruthy();
    expect(getByTestId('budget-alerts-slider')).toBeTruthy();
    fireEvent(getByTestId('budget-alerts-toggle'), 'onValueChange', true);
    await waitFor(() => expect(getByTestId('budget-alerts-toggle').props.value).toBe(true));
  });
});
