import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';
import { expenseRepository, InMemoryExpenseRepository } from '@/expenses/repositories/ExpenseRepository';
import { budgetRepository, InMemoryBudgetRepository } from '@/expenses/repositories/BudgetRepository';
import { embeddingRepository, InMemoryEmbeddingRepository } from '@/expenses/repositories/EmbeddingRepository';
import { setCustomCategories } from '@/expenses/categories/expenseCategories';

jest.mock('@/hooks/use-audio-recording', () => ({
  useAudioRecording: () => ({
    state: 'idle',
    errorMessage: null,
    result: null,
    durationMs: 0,
    isRecording: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-analyze-audio', () => ({
  useAnalyzeAudio: () => ({
    status: 'idle',
    expenses: null,
    error: null,
    isLoading: false,
    analyze: jest.fn(),
    reset: jest.fn(),
  }),
}));

const memExp = new InMemoryExpenseRepository();
const memBud = new InMemoryBudgetRepository();
const memEmb = new InMemoryEmbeddingRepository();
const expSingleton = expenseRepository as unknown as Record<string, unknown>;
const budSingleton = budgetRepository as unknown as Record<string, unknown>;
const embSingleton = embeddingRepository as unknown as Record<string, unknown>;
const expOrig = { ...expSingleton };
const budOrig = { ...budSingleton };
const embOrig = { ...embSingleton };

beforeEach(async () => {
  (expenseRepository as unknown as InMemoryExpenseRepository).create = memExp.create.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).getAll = memExp.getAll.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).getRecent = memExp.getRecent.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).getByMonthRange = memExp.getByMonthRange.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).getCategorySummary = memExp.getCategorySummary.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).delete = memExp.delete.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).update = memExp.update.bind(memExp);
  (expenseRepository as unknown as InMemoryExpenseRepository).clearAll = memExp.clearAll.bind(memExp);
  (budgetRepository as unknown as InMemoryBudgetRepository).getProgress = memBud.getProgress.bind(memBud);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getAll = memEmb.getAll.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getModelStats = memEmb.getModelStats.bind(memEmb);
  (embeddingRepository as unknown as InMemoryEmbeddingRepository).getMissingExpenseIds =
    memEmb.getMissingExpenseIds.bind(memEmb);
  await memExp.clearAll();
  await memBud.clearAll();
  await memEmb.clearAll();
  setCustomCategories([]);
  await memExp.create({
    id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', description: 'Almuerzo',
    date: '2026-09-07', paymentMethod: 'CASH',
    createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
  } as never);
});

afterEach(() => {
  setCustomCategories([]);
});

afterAll(() => {
  Object.assign(expSingleton, expOrig);
  Object.assign(budSingleton, budOrig);
  Object.assign(embSingleton, embOrig);
});

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  const utils = render(
    <Provider store={testStore}>
      <DashboardScreen />
    </Provider>,
  );
  return { ...utils, testStore };
}

describe('Dashboard Recent expenses: editar y borrar', () => {
  it('editar desde Recent actualiza (detalle editable con Guardar)', async () => {
    const { getByLabelText, getByText, getByDisplayValue } = renderWithStore();
    await waitFor(() => expect(getByLabelText('Ver Almuerzo')).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(getByLabelText('Ver Almuerzo'));
    await waitFor(() => expect(getByLabelText('Guardar')).toBeTruthy());
    fireEvent.changeText(getByDisplayValue('Almuerzo'), 'Cena');
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(getByText('Cena')).toBeTruthy(), { timeout: 5000 });
    expect((await memExp.getAll())[0].description).toBe('Cena');
  });

  it('swipe revela papelera y el bubble confirma la eliminación', async () => {
    const { getByLabelText, getByText, testStore } = renderWithStore();
    await waitFor(() => expect(getByLabelText('Ver Almuerzo')).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(getByLabelText('Eliminar Almuerzo'));
    await waitFor(() => expect(getByText('Confirmar eliminación')).toBeTruthy());
    fireEvent.press(getByText('Confirmar eliminación'));
    await waitFor(() => expect(testStore.getState().expenses.items).toHaveLength(0), { timeout: 5000 });
  });
});
