import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RecurringScreen from '../recurring';
import recurringReducer from '@/store/recurringSlice';
import settingsReducer from '@/store/settingsSlice';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

const RULES = [
  {
    id: 'r1', description: 'Sueldo', amount: 1000, currency: 'BOB', category: 'SALARIO',
    kind: 'INCOME', frequency: 'MONTHLY', day1: 5, day2: null, weekday: null, month: null,
    paymentMethod: 'CASH', startDate: '2026-09-05', endDate: null, active: true,
    lastGenerated: '2026-09-05', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'r2', description: 'Alquiler', amount: 500, currency: 'BOB', category: 'OTHER',
    kind: 'EXPENSE', frequency: 'MONTHLY', day1: 1, day2: null, weekday: null, month: null,
    paymentMethod: 'CASH', startDate: '2026-09-01', endDate: null, active: true,
    lastGenerated: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

jest.mock('@/expenses/repositories/RecurringRepository', () => ({
  recurringRepository: {
    getAll: jest.fn(() => Promise.resolve(RULES.map((r) => ({ ...r })))),
    getActive: jest.fn(() => Promise.resolve(RULES.map((r) => ({ ...r })).filter((r) => r.active))),
    create: jest.fn((c) => Promise.resolve(c)),
    update: jest.fn((id, patch) => Promise.resolve({ ...RULES[0], id, ...patch })),
    remove: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
  },
}));

function renderWithStore() {
  const testStore = configureStore({
    reducer: { recurring: recurringReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <RecurringScreen />
    </Provider>,
  );
}

describe('RecurringScreen', () => {
  it('lista reglas con frecuencia y próxima fecha, filtra por kind', async () => {
    const { getByText, getAllByText, getByLabelText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Sueldo')).toBeTruthy());
    expect(getByText('Alquiler')).toBeTruthy();
    expect(getAllByText(/Mensual/)).toHaveLength(2);
    fireEvent.press(getByLabelText('Filtrar Gastos'));
    await waitFor(() => expect(queryByText('Sueldo')).toBeNull());
    expect(getByText('Alquiler')).toBeTruthy();
    fireEvent.press(getByLabelText('Filtrar Ingresos'));
    await waitFor(() => expect(getByText('Sueldo')).toBeTruthy());
    expect(queryByText('Alquiler')).toBeNull();
  });

  it('editar monto, pausar y borrar con confirmación', async () => {
    const { recurringRepository } = jest.requireMock('@/expenses/repositories/RecurringRepository') as {
      recurringRepository: { update: jest.Mock; remove: jest.Mock };
    };
    const { getByText, getByLabelText, getByTestId } = renderWithStore();
    await waitFor(() => expect(getByText('Alquiler')).toBeTruthy());
    fireEvent.press(getByLabelText('Regla Alquiler'));
    fireEvent.changeText(getByTestId('recurring-amount-r2'), '600');
    fireEvent.press(getByLabelText('Guardar monto'));
    await waitFor(() => expect(recurringRepository.update).toHaveBeenCalledWith('r2', { amount: 600 }));
    fireEvent.press(getByLabelText('Regla Alquiler'));
    fireEvent.press(getByLabelText('Pausar regla'));
    await waitFor(() =>
      expect(recurringRepository.update).toHaveBeenCalledWith('r2', { active: false }),
    );
    fireEvent.press(getByLabelText('Eliminar regla Alquiler'));
    await waitFor(() => expect(getByText('Delete expense?')).toBeTruthy());
    fireEvent.press(getByText('Delete'));
    await waitFor(() => expect(recurringRepository.remove).toHaveBeenCalledWith('r2'));
  });

  it('vacía muestra hint', async () => {
    const { recurringRepository } = jest.requireMock('@/expenses/repositories/RecurringRepository') as {
      recurringRepository: { getAll: jest.Mock };
    };
    recurringRepository.getAll.mockResolvedValueOnce([]);
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Sin recurrentes: créalos desde un gasto o ingreso con el chip de repetición')).toBeTruthy());
  });
});
