import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CategoriesScreen from '../categories';
import categoriesReducer from '@/store/categoriesSlice';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';

type Custom = { id: string; label: string; emoji: string; color: string };
let mockCustomStore: Record<string, Custom> = {};

jest.mock('@/expenses/repositories/CategoryRepository', () => ({
  categoryRepository: {
    getCustom: jest.fn(() => Promise.resolve(Object.values(mockCustomStore))),
    create: jest.fn((input: { label: string; emoji: string; color: string }) => {
      const id = input.label.toUpperCase().replace(/\s+/g, '_');
      const c = { id, ...input };
      mockCustomStore[id] = c;
      return Promise.resolve(c);
    }),
    delete: jest.fn((id: string) => {
      delete mockCustomStore[id];
      return Promise.resolve();
    }),
    clearAll: jest.fn(() => {
      mockCustomStore = {};
      return Promise.resolve();
    }),
  },
}));

function renderWithStore() {
  const testStore = configureStore({
    reducer: { categories: categoriesReducer, expenses: expensesReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <CategoriesScreen />
    </Provider>,
  );
}

beforeEach(() => {
  mockCustomStore = {};
});

describe('CategoriesScreen', () => {
  it('lista las del sistema y el empty de personalizadas', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText('Del sistema')).toBeTruthy());
    expect(getByText('Food')).toBeTruthy();
    expect(getByText('Mis categorías')).toBeTruthy();
    expect(getByText('+ Nueva categoría')).toBeTruthy();
  });

  it('crear con nombre+icono+color aparece en Mis categorías', async () => {
    const { getByText, getByPlaceholderText } = renderWithStore();
    await waitFor(() => expect(getByText('Mis categorías')).toBeTruthy());
    fireEvent.press(getByText('+ Nueva categoría'));
    await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
    fireEvent.press(getByText('Guardar'));
    await waitFor(() => expect(getByText('Mis categorías (1)')).toBeTruthy());
    expect(getByText('Mascotas')).toBeTruthy();
  });
});
