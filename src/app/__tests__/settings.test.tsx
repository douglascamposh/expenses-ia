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
  it('la fila Presupuestos navega a la pantalla', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Presupuestos')).toBeTruthy());
    fireEvent.press(getByText('Presupuestos'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });

  it('la fila Categories navega a la pantalla', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Categorías')).toBeTruthy());
    fireEvent.press(getByText('Categorías'));
    expect(mockPush).toHaveBeenCalledWith('/categories');
  });

  it('tiene botón Volver en el header', async () => {
    const { getByLabelText, getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Configuración')).toBeTruthy());
    expect(getByLabelText('Volver')).toBeTruthy();
  });

  it('Apariencia permite elegir Dark mode', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Apariencia')).toBeTruthy());
    fireEvent.press(getByText('Apariencia'));
    await waitFor(() => expect(getByText('Modo oscuro')).toBeTruthy());
    fireEvent.press(getByText('Modo oscuro'));
    await waitFor(() => expect(getByText('Modo oscuro')).toBeTruthy());
  });

  it('Idioma permite elegir English', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Idioma')).toBeTruthy());
    fireEvent.press(getByText('Idioma'));
    await waitFor(() => expect(getByText('English')).toBeTruthy());
    fireEvent.press(getByText('English'));
    await waitFor(() => expect(getByText('English')).toBeTruthy());
  });

  it('Moneda abre el buscador y cambia a USD', async () => {
    const { getByText, getByTestId, getByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText('Moneda')).toBeTruthy());
    fireEvent.press(getByText('Moneda'));
    await waitFor(() => expect(getByTestId('currency-search-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('currency-search-input'), 'dolar');
    await waitFor(() => expect(getByText('dólar estadounidense')).toBeTruthy());
    fireEvent.press(getByLabelText('Usar USD'));
    await waitFor(() => expect(getByText('dólar estadounidense · USD')).toBeTruthy());
  });
});
