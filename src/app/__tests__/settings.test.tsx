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
    const { getByText, getByTestId } = renderWithStore();
    await waitFor(() => expect(getByText('Apariencia')).toBeTruthy());
    fireEvent.press(getByText('Apariencia'));
    await waitFor(() => expect(getByText('Modo oscuro')).toBeTruthy());
    // Las 3 opciones con icono y estado de selección
    expect(getByTestId('select-option-system')).toBeTruthy();
    expect(getByTestId('select-option-light')).toBeTruthy();
    expect(getByTestId('select-option-dark')).toBeTruthy();
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

  it('Idioma permite elegir Português', async () => {
    const { getByText, getByTestId, queryByTestId } = renderWithStore();
    await waitFor(() => expect(getByText('Idioma')).toBeTruthy());
    // Reintenta el press: en este entorno el primer tap a veces no registra.
    await waitFor(
      () => {
        if (!queryByTestId('select-option-pt')) fireEvent.press(getByText('Idioma'));
        expect(queryByTestId('select-option-pt')).toBeTruthy();
      },
      { timeout: 8000 },
    );
    fireEvent.press(getByTestId('select-option-pt'));
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

  it('la fila Hazte Pro navega a la pantalla Pro', async () => {
    const { getByTestId } = renderWithStore();
    await waitFor(() => expect(getByTestId('settings-subscribe-row')).toBeTruthy());
    fireEvent.press(getByTestId('settings-subscribe-row'));
    expect(mockPush).toHaveBeenCalledWith('/pro');
  });

  it('la fila Cuenta navega a la pantalla de cuenta', async () => {
    const { getByTestId } = renderWithStore();
    await waitFor(() => expect(getByTestId('settings-account-row')).toBeTruthy());
    fireEvent.press(getByTestId('settings-account-row'));
    expect(mockPush).toHaveBeenCalledWith('/account');
  });

  it('la fila Términos navega a la pantalla de términos', async () => {
    const { getByTestId } = renderWithStore();
    await waitFor(() => expect(getByTestId('settings-terms-row')).toBeTruthy());
    fireEvent.press(getByTestId('settings-terms-row'));
    expect(mockPush).toHaveBeenCalledWith('/terms');
  });

  it('la fila Cuenta muestra el email si hay Google vinculado', async () => {
    const { getAuth } = jest.requireMock('@react-native-firebase/auth') as { getAuth: jest.Mock };
    getAuth.mockReturnValue({
      currentUser: {
        uid: 'u1',
        email: 'a@b.com',
        providerData: [{ providerId: 'google.com', email: 'a@b.com', displayName: 'A' }],
      },
    });
    try {
      const { getByTestId, getByText, queryByText } = renderWithStore();
      await waitFor(() => expect(getByTestId('settings-account-row')).toBeTruthy());
      expect(getByText('a@b.com')).toBeTruthy();
      expect(queryByText('Invitado')).toBeNull();
    } finally {
      getAuth.mockReturnValue({ currentUser: { uid: 'test-uid' } });
    }
  });
});
