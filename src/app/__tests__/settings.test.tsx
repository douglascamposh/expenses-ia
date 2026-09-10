import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SettingsScreen from '../settings';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

beforeEach(() => {
  mockPush.mockClear();
});

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <SettingsScreen />
    </Provider>,
  );
}

describe('Settings budgets', () => {
  it('la fila Budgets abre el modal de presupuestos', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Budgets')).toBeTruthy());
    fireEvent.press(getByText('Budgets'));
    await waitFor(() => expect(getByText('Nuevo presupuesto')).toBeTruthy());
  });

  it('la fila Categories navega a la pantalla', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Categories')).toBeTruthy());
    fireEvent.press(getByText('Categories'));
    expect(mockPush).toHaveBeenCalledWith('/categories');
  });
});
