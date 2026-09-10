import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ExpensesScreen from '../explore';
import expensesReducer, { fetchExpenses } from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import type { AppDispatch } from '@/store';
import { embeddingRepository, InMemoryEmbeddingRepository } from '@/expenses/repositories/EmbeddingRepository';

jest.mock('@/expenses/repositories/ExpenseRepository', () => ({
  expenseRepository: {
    delete: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve(null)),
    getAll: jest.fn(() => Promise.resolve([
      {
        id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', description: 'Almuerzo',
        date: '2026-09-07', paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
      {
        id: 'e2', amount: 10, currency: 'BOB', category: 'TRANSPORT', description: 'Bus',
        date: '2026-09-07', paymentMethod: 'CARD',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
    ])),
    getRecent: jest.fn(() => Promise.resolve([])),
    getCategorySummary: jest.fn(() => Promise.resolve([])),
    create: jest.fn((e) => Promise.resolve(e)),
  },
}));

const memEmb = new InMemoryEmbeddingRepository();
const embSingleton = embeddingRepository as unknown as Record<string, unknown>;
const embOrig = { ...embSingleton };
const realFetch = globalThis.fetch;
const routerMock = jest.requireMock('expo-router') as { useFocusEffect: jest.Mock };
const focusImpl = routerMock.useFocusEffect.getMockImplementation();

beforeEach(async () => {
  // El mock global de useFocusEffect corre el callback en cada render (loop
  // infinito de refresh en tests). Aquí lo desactivamos y cargamos explícito.
  routerMock.useFocusEffect.mockImplementation(() => {});
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).upsert = memEmb.upsert.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getAll = memEmb.getAll.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getModelStats = memEmb.getModelStats.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getMissingExpenseIds =
    memEmb.getMissingExpenseIds.bind(memEmb);
  await memEmb.clearAll();
  await memEmb.upsert('e1', Float32Array.from([1, 0, 0]), 'm1');
  await memEmb.upsert('e2', Float32Array.from([0, 1, 0]), 'm1');
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ embedding: [1, 0, 0], model: 'm1', dims: 3 }),
    }),
  );
});

afterEach(() => {
  globalThis.fetch = realFetch;
  routerMock.useFocusEffect.mockImplementation(focusImpl as never);
});

afterAll(() => {
  Object.assign(embSingleton, embOrig);
});

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  const utils = render(
    <Provider store={testStore}>
      <ExpensesScreen />
    </Provider>,
  );
  return { ...utils, testStore };
}

async function loadExpenses(testStore: { dispatch: AppDispatch }) {
  await testStore.dispatch(fetchExpenses(10)).unwrap();
}

describe('Explore búsqueda semántica', () => {
  it('lupa activa modo IA y rankea por vector', async () => {
    const { getByPlaceholderText, getByLabelText, getByText, queryByText, testStore } = renderWithStore();
    await loadExpenses(testStore);
    await waitFor(() => expect(getByText(/2 registros/)).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Search...'), 'comida');
    fireEvent.press(getByLabelText('Buscar'));
    await waitFor(() => expect(getByText(/Búsqueda IA/)).toBeTruthy(), { timeout: 5000 });
    // Solo e1 rankeó (e2 score 0 < umbral)
    await waitFor(() => expect(getByText('Almuerzo')).toBeTruthy(), { timeout: 5000 });
    expect(queryByText('Bus')).toBeNull();
  });

  it('escribir no busca solo; solo la lupa dispara (T6)', async () => {
    const { getByPlaceholderText, getByLabelText, getByText, queryByText, testStore } = renderWithStore();
    await loadExpenses(testStore);
    await waitFor(() => expect(getByText(/2 registros/)).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Search...'), 'almuerzo');
    // Sin debounce: escribir no debe activar la IA por sí solo
    await new Promise((r) => setTimeout(r, 800));
    expect(queryByText(/Búsqueda IA/)).toBeNull();
    // Keyword en vivo sigue mostrando coincidencias de texto
    expect(getByText('Almuerzo')).toBeTruthy();
    fireEvent.press(getByLabelText('Buscar'));
    await waitFor(() => expect(getByText(/Búsqueda IA/)).toBeTruthy(), { timeout: 5000 });
  });

  it('eliminar usa el mockup DeleteConfirm y borra', async () => {
    const { getAllByText, getByText, testStore } = renderWithStore();
    await loadExpenses(testStore);
    await waitFor(() => expect(getByText(/2 registros/)).toBeTruthy());
    fireEvent.press(getAllByText('Eliminar')[0]);
    // Mockup: icono + título + descripción + Cancel/Delete
    await waitFor(() => expect(getByText('Delete expense?')).toBeTruthy());
    expect(getByText('This expense will be removed.')).toBeTruthy();
    fireEvent.press(getByText('Delete'));
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { delete: jest.Mock };
    };
    await waitFor(() => expect(expenseRepository.delete).toHaveBeenCalledWith('e1'));
  });

  it('sin red degrada a keyword', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
    const { getByPlaceholderText, getByLabelText, getByText, testStore } = renderWithStore();
    await loadExpenses(testStore);
    await waitFor(() => expect(getByText(/2 registros/)).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Search...'), 'bus');
    fireEvent.press(getByLabelText('Buscar'));
    await waitFor(() => expect(getByText(/Búsqueda por texto/)).toBeTruthy(), { timeout: 5000 });
    await waitFor(() => expect(getByText('Bus')).toBeTruthy(), { timeout: 5000 });
  });
});
