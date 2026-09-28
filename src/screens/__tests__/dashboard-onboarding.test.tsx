import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Dashboard from '../Dashboard';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';
import recurringReducer from '@/store/recurringSlice';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

function renderOnboarding() {
  const testStore = configureStore({
    reducer: {
      expenses: expensesReducer,
      settings: settingsReducer,
      categories: categoriesReducer,
      recurring: recurringReducer,
    },
    // Onboarding visible: categorías cargadas, sin customs, sin recientes ni presupuestos.
    preloadedState: {
      categories: { custom: [], loaded: true, error: null },
    },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <Dashboard />
    </Provider>,
  );
}

describe('Dashboard onboarding', () => {
  it('al crear una sugerencia muestra el toast de confirmación', async () => {
    const { getByLabelText, getByText } = renderOnboarding();
    await waitFor(() => expect(getByLabelText('Añadir Comer fuera')).toBeTruthy());
    fireEvent.press(getByLabelText('Añadir Comer fuera'));
    await waitFor(() =>
      expect(
        getByText('La categoría Comer fuera fue creada, puedes crear más en Configuración'),
      ).toBeTruthy(),
    );
    expect(getByText('🍕')).toBeTruthy();
  });
});
