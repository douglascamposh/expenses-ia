import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

beforeEach(() => {
  mockPush.mockClear();
});

// Mock hooks
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
    countByCategory: jest.fn(() => Promise.resolve(0)),
    create: jest.fn((e) => Promise.resolve(e)),
  },
}));

jest.mock('@/expenses/repositories/BudgetRepository', () => ({
  budgetRepository: {
    upsert: jest.fn((b) => Promise.resolve({ ...b })),
    getAll: jest.fn(() => Promise.resolve([])),
    getProgress: jest.fn(() => Promise.resolve([])),
    delete: jest.fn(() => Promise.resolve()),
  },
}));

function renderWithStore() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return {
    ...render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    ),
    testStore,
  };
}

describe('Dashboard', () => {
  it('renders greeting and empty state', async () => {
    const { getByText } = renderWithStore();
    // fetchExpenses corre al montar; esperar a que SQLite mock devuelva []
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
  });

  it('shows CTA when empty', async () => {
    const { getByText } = renderWithStore();
    await waitFor(() => expect(getByText(/Empieza a registrar/)).toBeTruthy());
  });

  it('muestra la lista unificada sin duplicar (solo gasto, sin barra)', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getCategorySummary: jest.Mock };
    };
    expenseRepository.getCategorySummary.mockResolvedValueOnce([
      { category: 'FOOD', currency: 'BOB', total: 120 },
    ]);
    const { getAllByText, getByLabelText, getAllByLabelText, getByTestId, queryByText } = renderWithStore();
    await waitFor(() => expect(getByLabelText('Ver Food')).toBeTruthy());
    // Una sola vez y como solo-gasto con su % del total (100% al ser la única)
    expect(getAllByLabelText('Ver Food')).toHaveLength(1);
    expect(getAllByText('120').length).toBeGreaterThanOrEqual(1);
    // 100% de la barra de categoría + 100% del anillo gastado (sin ingreso → rojo completo)
    expect(getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('spent-ring-card')).toBeTruthy();
    expect(queryByText(/Falta/)).toBeNull();
  });

  it('lupa abre el dock y buscar filtra la lista sin salir del inicio', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getAll: jest.Mock };
    };
    expenseRepository.getAll.mockResolvedValueOnce([
      {
        id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', description: 'Almuerzo',
        date: '2026-09-07', paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
    ]);
    const { getByLabelText, getByTestId, getByText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    fireEvent.press(getByLabelText('Buscar gastos'));
    const input = getByTestId('home-search-input');
    fireEvent.changeText(input, 'almuerzo');
    // Filtra la lista del mes sin salir del inicio
    await waitFor(() => expect(getByText('Almuerzo')).toBeTruthy());
    // X limpia y cierra sin navegar
    fireEvent.press(getByTestId('home-search-close'));
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/explore'));
  });

  it('el dock muestra ✨ que abre la IA y buscar sigue siendo keyword', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getAll: jest.Mock };
    };
    expenseRepository.getAll.mockResolvedValueOnce([
      {
        id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', description: 'Almuerzo',
        date: '2026-09-07', paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
    ]);
    const { getByLabelText, getByTestId, getByText } = renderWithStore();
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    fireEvent.press(getByLabelText('Buscar gastos'));
    // ✨ abre /ai (la semántica ya no vive aquí)
    fireEvent.press(getByTestId('home-search-ai'));
    expect(mockPush).toHaveBeenCalledWith('/ai');
  });

  it('buscar filtra por texto y respeta el filtro de categoría activo', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getAll: jest.Mock; getByMonthRange: jest.Mock };
    };
    const rows = [
      {
        id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Almuerzo',
        date: '2026-09-07', paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
      {
        id: 'e2', amount: 10, currency: 'BOB', category: 'TRANSPORT', kind: 'EXPENSE', description: 'Bus nocturno',
        date: '2026-09-07', paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
    ];
    expenseRepository.getAll.mockResolvedValueOnce(rows);
    expenseRepository.getByMonthRange
      .mockResolvedValueOnce(rows.filter((e) => e.kind !== 'INCOME'))
      .mockResolvedValueOnce([]);
    const { getByLabelText, getByTestId, getByText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Bus nocturno')).toBeTruthy());
    fireEvent.press(getByLabelText('Buscar gastos'));
    fireEvent.changeText(getByTestId('home-search-input'), 'bus');
    await waitFor(() => expect(getByText('Bus nocturno')).toBeTruthy());
    expect(queryByText('Almuerzo')).toBeNull();
  });

  it('pregunta analítica muestra tarjeta compacta sobre la lista', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getAll: jest.Mock };
    };
    const ago = new Date();
    ago.setDate(ago.getDate() - 2);
    const iso = `${ago.getFullYear()}-${String(ago.getMonth() + 1).padStart(2, '0')}-${String(ago.getDate()).padStart(2, '0')}`;
    const fixture = [
      {
        id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', description: 'Almuerzo',
        date: iso, paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      },
    ];
    // Una para el fetch al montar, otra para el cálculo del thunk
    expenseRepository.getAll.mockResolvedValueOnce(fixture).mockResolvedValueOnce(fixture);
    const { getByLabelText, getByTestId, getByText } = renderWithStore();
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    fireEvent.press(getByLabelText('Buscar gastos'));
    const input = getByTestId('home-search-input');
    fireEvent.changeText(input, 'cuánto gasté en total los últimos 12 meses');
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(getByText('Total últimos 12 meses')).toBeTruthy(), { timeout: 5000 });
  });

  it('la búsqueda muestra todos los resultados inline sin salir del inicio', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getAll: jest.Mock };
    };
    expenseRepository.getAll.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, i) => ({
        id: `e${i}`, amount: 10 + i, currency: 'BOB', category: 'FOOD', description: `Almuerzo ${i}`,
        date: '2026-09-07', paymentMethod: 'CASH',
        createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:00:00.000Z',
      })),
    );
    const { getByLabelText, getByTestId, getByText } = renderWithStore();
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    fireEvent.press(getByLabelText('Buscar gastos'));
    fireEvent.changeText(getByTestId('home-search-input'), 'almuerzo');
    await waitFor(() => expect(getByText('Almuerzo 5')).toBeTruthy());
    expect(getByText('Almuerzo 0')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/explore'));
  });

  it('tap en la fecha alterna la tira de meses (primer filtro)', async () => {
    const { getByLabelText, getByText, queryByTestId } = renderWithStore();
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    const now = new Date();
    const pillId = `month-pill-${now.getMonth() + 1}`;
    // Cerrada por defecto
    expect(queryByTestId(pillId)).toBeNull();
    fireEvent.press(getByLabelText(/Ver .* de 20\d\d/));
    await waitFor(() => expect(queryByTestId(pillId)).toBeTruthy());
    fireEvent.press(getByLabelText(/Ver .* de 20\d\d/));
    await waitFor(() => expect(queryByTestId(pillId)).toBeNull());
  });

  it('tap en la barra filtra inline con chip y la X lo quita', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getCategorySummary: jest.Mock; getByMonthRange: jest.Mock };
    };
    expenseRepository.getCategorySummary.mockResolvedValueOnce([
      { category: 'FOOD', currency: 'BOB', total: 120 },
    ]);
    const today = new Date().toISOString().split('T')[0];
    const stamp = `${today}T12:00:00.000Z`;
    expenseRepository.getByMonthRange
      .mockResolvedValueOnce([
        { id: 'e1', amount: 120, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Almuerzo', date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp },
      ])
      .mockResolvedValueOnce([]);
    const { getByLabelText, getByTestId, getByText, queryByTestId, queryByText } = renderWithStore();
    await waitFor(() => expect(getByLabelText('Ver Food')).toBeTruthy());
    // Sin chip antes de filtrar
    expect(queryByTestId('category-filter-chip')).toBeNull();
    // Tap en barra → filtra (ya no navega) y aparece el chip
    fireEvent.press(getByLabelText('Ver Food'));
    await waitFor(() => expect(getByTestId('category-filter-chip')).toBeTruthy());
    expect(getByText('Almuerzo')).toBeTruthy();
    // X del chip quita el filtro
    fireEvent.press(getByTestId('category-filter-chip'));
    await waitFor(() => expect(queryByTestId('category-filter-chip')).toBeNull());
    expect(queryByText('Almuerzo')).toBeTruthy();
  });

  it('seleccionar expande la píldora y quitar el filtro la encoge', async () => {
    const { Animated: RNAnimated } = jest.requireActual('react-native');
    const starts: number[] = [];
    const timingSpy = jest.spyOn(RNAnimated, 'timing').mockImplementation(
      ((value: unknown, config: { toValue: number }) => ({
        start: (cb?: () => void) => {
          starts.push(config.toValue);
          cb?.();
        },
      })) as never,
    );
    try {
      const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
        expenseRepository: { getCategorySummary: jest.Mock; getByMonthRange: jest.Mock };
      };
      expenseRepository.getCategorySummary.mockResolvedValueOnce([
        { category: 'FOOD', currency: 'BOB', total: 120 },
      ]);
      const today = new Date().toISOString().split('T')[0];
      const stamp = `${today}T12:00:00.000Z`;
      expenseRepository.getByMonthRange
        .mockResolvedValueOnce([
          { id: 'e1', amount: 120, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Almuerzo', date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp },
        ])
        .mockResolvedValueOnce([]);
      const { getByLabelText, getByTestId, queryByTestId } = renderWithStore();
      await waitFor(() => expect(getByLabelText('Ver Food')).toBeTruthy());
      // Montaje sin filtro: todo a 0 (píldoras)
      expect(starts[starts.length - 1]).toBe(0);
      // Seleccionar → expande a 1
      fireEvent.press(getByLabelText('Ver Food'));
      await waitFor(() => expect(getByTestId('category-filter-chip')).toBeTruthy());
      expect(starts).toContain(1);
      // Quitar filtro → vuelve a 0
      fireEvent.press(getByTestId('category-filter-chip'));
      await waitFor(() => expect(queryByTestId('category-filter-chip')).toBeNull());
      expect(starts[starts.length - 1]).toBe(0);
    } finally {
      timingSpy.mockRestore();
    }
  });

  it('la sección de balance es estática y no navega fuera del inicio', async () => {
    const { getByText, getByTestId } = renderWithStore();
    await waitFor(() => expect(getByText('Tu balance: 0 Bs')).toBeTruthy());
    fireEvent.press(getByTestId('spent-expense-pill'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('las píldoras muestran ingreso/gasto y marcan el filtro al tocar', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getCategorySummary: jest.Mock };
    };
    expenseRepository.getCategorySummary
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ category: 'OTHER', currency: 'BOB', total: 1000 }]);
    const { getByLabelText, getByTestId, getByText, queryByText } = renderWithStore();
    // Píldoras con montos (sin título ni cifra gigante del hero viejo)
    await waitFor(() => expect(getByText('1.000 Bs')).toBeTruthy());
    expect(getByText('0 Bs')).toBeTruthy();
    expect(queryByText('Balance del mes')).toBeNull();
    expect(getByLabelText('Ver gastos del mes')).toBeTruthy();
    expect(getByLabelText('Ver ingresos del mes')).toBeTruthy();
    expect(getByTestId('spent-expense-pill').props.accessibilityState?.selected).toBe(false);
    fireEvent.press(getByLabelText('Ver gastos del mes'));
    await waitFor(() =>
      expect(getByTestId('spent-expense-pill').props.accessibilityState?.selected).toBe(true),
    );
    fireEvent.press(getByLabelText('Ver ingresos del mes'));
    await waitFor(() =>
      expect(getByTestId('spent-income-pill').props.accessibilityState?.selected).toBe(true),
    );
  });

  it('botón + abre el modal de alta manual', async () => {
    const { getByText, getByPlaceholderText, getByLabelText, queryAllByLabelText } = renderWithStore();
    await waitFor(() => expect(getByText(/Sin gastos todavía/)).toBeTruthy());
    // Solo el + de la píldora flotante (el header solo lleva Settings)
    expect(queryAllByLabelText('Agregar gasto manual')).toHaveLength(1);
    fireEvent.press(queryAllByLabelText('Agregar gasto manual')[0]);
    await waitFor(() => expect(getByPlaceholderText('Detalles del gasto')).toBeTruthy());
    expect(getByLabelText('Guardar')).toBeTruthy();
  });

  it('lupa deshabilitada sin gastos en DB y habilitada con gastos', async () => {
    // Sin gastos: fetch devuelve [] -> botón deshabilitado
    const { getByTestId, unmount } = renderWithStore();
    await waitFor(() => expect(getByTestId('dashboard-search-button')).toBeTruthy());
    await waitFor(() =>
      expect(getByTestId('dashboard-search-button').props.accessibilityState?.disabled).toBe(true),
    );
    unmount();

    // Con gastos: fetch devuelve 1 fila -> botón habilitado
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getAll: jest.Mock };
    };
    const today = new Date().toISOString().split('T')[0];
    const stamp = `${today}T12:00:00.000Z`;
    expenseRepository.getAll.mockResolvedValueOnce([
      {
        id: 'e1', amount: 35, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Almuerzo',
        date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp,
      },
    ]);
    const second = renderWithStore();
    await waitFor(() =>
      expect(second.getByTestId('dashboard-search-button').props.accessibilityState?.disabled).toBe(false),
    );
    // La lupa habilitada sigue abriendo el dock de búsqueda
    fireEvent.press(second.getByLabelText('Buscar gastos'));
    expect(second.getByTestId('home-search-input')).toBeTruthy();
  });

  it('las píldoras filtran recientes por ingresos/gastos', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getByMonthRange: jest.Mock; getCategorySummary: jest.Mock };
    };
    const today = new Date().toISOString().split('T')[0];
    const stamp = `${today}T12:00:00.000Z`;
    expenseRepository.getByMonthRange
      .mockResolvedValueOnce([
        { id: 'e1', amount: 50, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Almuerzo', date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp },
      ])
      .mockResolvedValueOnce([
        { id: 'i1', amount: 200, currency: 'BOB', category: 'OTHER', kind: 'INCOME', description: 'Sueldo', date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp },
      ]);
    // Resumen de ingresos para que se rendericen ambas píldoras (filtro).
    expenseRepository.getCategorySummary
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ category: 'OTHER', currency: 'BOB', total: 200 }]);
    const { getByLabelText, getByText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Almuerzo')).toBeTruthy());
    expect(getByText('Sueldo')).toBeTruthy();
    fireEvent.press(getByLabelText('Ver ingresos del mes'));
    await waitFor(() => expect(queryByText('Almuerzo')).toBeNull());
    expect(getByText('Sueldo')).toBeTruthy();
    fireEvent.press(getByLabelText('Ver gastos del mes'));
    await waitFor(() => expect(getByText('Almuerzo')).toBeTruthy());
    expect(queryByText('Sueldo')).toBeNull();
    // Tocar de nuevo vuelve al neto (todo visible)
    fireEvent.press(getByLabelText('Ver gastos del mes'));
    await waitFor(() => expect(getByText('Sueldo')).toBeTruthy());
  });

  it('chip del día muestra el neto con su signo (ingreso no se resta)', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getByMonthRange: jest.Mock };
    };
    const today = new Date().toISOString().split('T')[0];
    const stamp = `${today}T12:00:00.000Z`;
    expenseRepository.getByMonthRange
      .mockResolvedValueOnce([
        { id: 'e1', amount: 500, currency: 'BOB', category: 'FOOD', kind: 'EXPENSE', description: 'Almuerzo', date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp },
      ])
      .mockResolvedValueOnce([
        { id: 'i1', amount: 3000, currency: 'BOB', category: 'OTHER', kind: 'INCOME', description: 'Sueldo', date: today, paymentMethod: 'CASH', createdAt: stamp, updatedAt: stamp },
      ]);
    const { getByText, queryByText } = renderWithStore();
    await waitFor(() => expect(getByText('Almuerzo')).toBeTruthy());
    // Neto 3000 - 500 = +2500; nunca "- 3.500" (ingreso sumado como gasto)
    expect(getByText('+ Bs 2.500,00')).toBeTruthy();
    expect(queryByText(/- Bs 3\.500/)).toBeNull();
  });

  it('long-press en categoría abre el modal de presupuesto y guarda', async () => {
    const { expenseRepository } = jest.requireMock('@/expenses/repositories/ExpenseRepository') as {
      expenseRepository: { getCategorySummary: jest.Mock };
    };
    expenseRepository.getCategorySummary.mockResolvedValueOnce([
      { category: 'FOOD', currency: 'BOB', total: 120 },
    ]);
    const { getByLabelText, getByText, getByTestId } = renderWithStore();
    await waitFor(() => expect(getByLabelText('Ver Food')).toBeTruthy());
    fireEvent(getByLabelText('Ver Food'), 'longPress');
    await waitFor(() => expect(getByText(/Presupuesto/)).toBeTruthy());
    fireEvent.changeText(getByTestId('budget-quick-amount-FOOD'), '500');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    const { budgetRepository } = jest.requireMock('@/expenses/repositories/BudgetRepository') as {
      budgetRepository: { upsert: jest.Mock };
    };
    await waitFor(() => expect(budgetRepository.upsert).toHaveBeenCalled());
    expect(budgetRepository.upsert.mock.calls[0][0]).toMatchObject({ category: 'FOOD', amount: 500 });
  });
});
