import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CategoriesScreen from '../categories';
import categoriesReducer from '@/store/categoriesSlice';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';

type Custom = { id: string; label: string; emoji: string; color: string; kind?: string };
let mockCustomStore: Record<string, Custom> = {};

const mockCountByCategory: { current: (id: string) => Promise<number> } = {
  current: async () => 0,
};
jest.mock('@/expenses/repositories/ExpenseRepository', () => ({
  expenseRepository: {
    getAll: jest.fn(() => Promise.resolve([])),
    countByCategory: jest.fn((id: string) => mockCountByCategory.current(id)),
  },
}));
jest.mock('@/expenses/repositories/CategoryRepository', () => ({
  categoryRepository: {
    getCustom: jest.fn(() => Promise.resolve(Object.values(mockCustomStore))),
    create: jest.fn((input: { label: string; emoji: string; color: string; kind?: string }) => {
      const id = input.label.toUpperCase().replace(/\s+/g, '_');
      const c = { id, ...input };
      mockCustomStore[id] = c;
      return Promise.resolve(c);
    }),
    delete: jest.fn((id: string) => {
      delete mockCustomStore[id];
      return Promise.resolve();
    }),
    update: jest.fn((id: string, input: { label: string; emoji: string; color: string; kind?: string }) => {
      const name = input.label.trim().toLowerCase();
      const clash = Object.values(mockCustomStore).some((c) => c.id !== id && c.label.trim().toLowerCase() === name);
      if (clash || name === 'otros') return Promise.reject(new Error('Ya existe una categoría con ese nombre'));
      const c = { id, ...input };
      mockCustomStore[id] = c;
      return Promise.resolve(c);
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

describe('CategoriesScreen (categorías del usuario)', () => {
  it('sin customs muestra empty, sugerencias y nada por defecto', async () => {
    const { getByText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
    expect(getByText('+ Nueva categoría')).toBeTruthy();
    expect(getByText('Sugerencias')).toBeTruthy();
    // Nada por defecto: ni sistema ni legado
    expect(queryByText('Food')).toBeNull();
    expect(queryByText('Transport')).toBeNull();
  });

  it('crear con nombre+icono+color aparece en Mis categorías como gasto', async () => {
    const { getByText, getAllByText, getByLabelText, getByPlaceholderText } = renderWithStore();
    await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
    fireEvent.press(getByText('+ Nueva categoría'));
    await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Mascotas')).toBeTruthy());
    expect(getByText('Mascotas')).toBeTruthy();
    expect(getAllByText('Gasto').length).toBeGreaterThanOrEqual(1);
  });

  it('una sugerencia se añade con Añadir', async () => {
    const { getByText, getByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText('Sugerencias')).toBeTruthy());
    fireEvent.press(getByLabelText('Añadir Comer fuera'));
    await waitFor(() => expect(getByText('Comer fuera')).toBeTruthy());
  });

  it('editar una categoría al seleccionarla actualiza el nombre', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = renderWithStore();
    await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
    fireEvent.press(getByText('+ Nueva categoría'));
    await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Mascotas')).toBeTruthy());
    fireEvent.press(getByLabelText('Editar Mascotas'));
    await waitFor(() => expect(getByText('Editar categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Peludos');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Peludos')).toBeTruthy());
  });

  it('editar con nombre duplicado muestra error y no guarda', async () => {
    const { getByText, getByLabelText, getByPlaceholderText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
    fireEvent.press(getByText('+ Nueva categoría'));
    await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Mascotas')).toBeTruthy());
    // Segunda categoría distinta (botón + del header)
    fireEvent.press(getByLabelText('Nueva categoría'));
    await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Jardín');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Jardín')).toBeTruthy());
    // Renombrar Jardín → Mascotas debe fallar
    fireEvent.press(getByLabelText('Editar Jardín'));
    await waitFor(() => expect(getByText('Editar categoría')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'mascotas');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Ya existe una categoría con ese nombre')).toBeTruthy());
    expect(queryByText('Jardín')).toBeTruthy();
  });

  it('el formulario muestra iconos en carrusel de tres filas sin Ver más', async () => {
    const { getByText, getByLabelText, queryByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
    fireEvent.press(getByText('+ Nueva categoría'));
    await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
    // Tira horizontal: iconos del inicio y del final visibles sin expandir
    expect(getByLabelText('Icono 🍔')).toBeTruthy();
    expect(getByLabelText('Icono 🧺')).toBeTruthy();
    expect(queryByLabelText('Ver más iconos')).toBeNull();
  });

  it('borrar categoría en uso se bloquea con toast', async () => {
    mockCountByCategory.current = async () => 2;
    try {
      const { getByText, getByLabelText, getByPlaceholderText, queryByText } = renderWithStore();
      await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
      fireEvent.press(getByText('+ Nueva categoría'));
      await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
      fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
      fireEvent.press(getByLabelText('Guardar'));
      await waitFor(() => expect(getByText('Mascotas')).toBeTruthy());
      fireEvent.press(getByLabelText('Eliminar Mascotas'));
      await new Promise((r) => setTimeout(r, 500));
      await waitFor(() => expect(getByText('Hay 2 items usando esta categoría')).toBeTruthy());
      // Sin confirmación de borrado
      expect(queryByText('¿Eliminar?')).toBeNull();
    } finally {
      mockCountByCategory.current = async () => 0;
    }
  });

  it('borrar categoría sin uso pide confirmación y elimina', async () => {
    mockCountByCategory.current = async () => 0;
    try {
      const { getByText, getByLabelText, getByPlaceholderText, queryByText } = renderWithStore();
      await waitFor(() => expect(getByText('Añadir categoría nueva')).toBeTruthy());
      fireEvent.press(getByText('+ Nueva categoría'));
      await waitFor(() => expect(getByText('Nueva categoría')).toBeTruthy());
      fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Mascotas');
      fireEvent.press(getByLabelText('Guardar'));
      await waitFor(() => expect(getByText('Mascotas')).toBeTruthy());
      fireEvent.press(getByLabelText('Eliminar Mascotas'));
      await waitFor(() => expect(getByText('Delete expense?')).toBeTruthy());
      fireEvent.press(getByText('Delete'));
      const { categoryRepository } = jest.requireMock('@/expenses/repositories/CategoryRepository') as {
        categoryRepository: { delete: jest.Mock };
      };
      await waitFor(() => expect(categoryRepository.delete).toHaveBeenCalledWith('MASCOTAS'));
      await waitFor(() => expect(queryByText('Mascotas')).toBeNull());
    } finally {
      mockCountByCategory.current = async () => 0;
    }
  });
});
