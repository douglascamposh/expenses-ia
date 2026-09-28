import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AiScreen from '../ai';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';
import recurringReducer from '@/store/recurringSlice';
import { aiChatRepository, InMemoryAiChatRepository } from '@/expenses/repositories/AiChatRepository';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));
jest.mock('@/services/auth', () => ({
  getAuthToken: jest.fn(() => Promise.resolve('tok')),
}));

const memChat = new InMemoryAiChatRepository();
const chatSingleton = aiChatRepository as unknown as Record<string, unknown>;
const chatOrig = { ...chatSingleton };

function renderScreen() {
  const testStore = configureStore({
    reducer: {
      expenses: expensesReducer,
      settings: settingsReducer,
      categories: categoriesReducer,
      recurring: recurringReducer,
    },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <AiScreen />
    </Provider>,
  );
}

beforeEach(async () => {
  (aiChatRepository as unknown as InMemoryAiChatRepository).add = memChat.add.bind(memChat);
  (aiChatRepository as unknown as InMemoryAiChatRepository).list = memChat.list.bind(memChat);
  (aiChatRepository as unknown as InMemoryAiChatRepository).clearAll = memChat.clearAll.bind(memChat);
  await memChat.clearAll();
});

afterAll(() => {
  Object.assign(chatSingleton, chatOrig);
});

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) }),
  );
}

describe('AiScreen', () => {
  it('muestra contador, chips e input (sin título ni hero)', async () => {
    const { getByText, getByTestId, queryByText } = renderScreen();
    await waitFor(() => expect(getByText('Pregúntale a tus finanzas')).toBeTruthy());
    expect(queryByText('IA Financiera')).toBeNull();
    expect(getByTestId('ai-chip-hormiga')).toBeTruthy();
    expect(getByTestId('ai-chip-review')).toBeTruthy();
    expect(getByTestId('ai-chip-top')).toBeTruthy();
    expect(getByTestId('ai-chip-save')).toBeTruthy();
    expect(getByTestId('ai-chip-subs')).toBeTruthy();
    expect(getByTestId('ai-chip-food')).toBeTruthy();
    expect(getByTestId('ai-chip-compare')).toBeTruthy();
    expect(getByTestId('ai-chip-goal')).toBeTruthy();
    expect(getByTestId('ai-chip-balance')).toBeTruthy();
    expect(getByTestId('ai-chip-week')).toBeTruthy();
    expect(getByTestId('ai-chip-emergency')).toBeTruthy();
    expect(getByTestId('ai-chip-challenge')).toBeTruthy();
    expect(getByText('Sugerencias')).toBeTruthy();
    // Contador visible desde el inicio (cuota gratis por defecto)
    expect(getByTestId('ai-quota')).toBeTruthy();
    expect(getByTestId('ai-suggest-bar')).toBeTruthy();
    expect(getByText('Te quedan 30 preguntas a la IA')).toBeTruthy();
    expect(getByTestId('ai-input')).toBeTruthy();
    expect(getByTestId('ai-send')).toBeTruthy();
    expect(getByTestId('ai-mic')).toBeTruthy();
  });

  it('carga el historial (últimas 10) y pagina al pasado', async () => {
    for (let i = 1; i <= 12; i++) {
      await memChat.add('user', JSON.stringify({ text: `pregunta ${i}` }));
    }
    const { getByText, getByTestId, queryByText, UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(getByText('pregunta 12')).toBeTruthy());
    expect(getByText('pregunta 3')).toBeTruthy();
    // Las 2 más viejas aún no cargan
    expect(queryByText('pregunta 1')).toBeNull();
    // onEndReached vive en el FlatList compuesto (el testID cae en el host)
    const flatList = UNSAFE_getByType(FlatList) as unknown as { props: { onEndReached?: () => void } };
    await act(async () => {
      flatList.props.onEndReached?.();
    });
    await waitFor(() => expect(getByText('pregunta 1')).toBeTruthy());
    expect(getByText('pregunta 2')).toBeTruthy();
  });

  it('chip va al endpoint y persiste la conversación', async () => {
    mockFetchOnce({
      type: 'hormiga',
      title: 'Hormiga detectada',
      summary: 'Cafés diarios',
      currency: 'BOB',
      suggestions: [],
      expense_ids: [],
      quota_remaining: 31,
    });
    try {
      const { getByText, getByTestId } = renderScreen();
      await waitFor(() => expect(getByTestId('ai-chip-hormiga')).toBeTruthy());
      fireEvent.press(getByTestId('ai-chip-hormiga'));
      await waitFor(() => expect(getByText('Hormiga detectada')).toBeTruthy());
      expect(getByText('Te quedan 31 preguntas a la IA')).toBeTruthy();
      // Persistido: usuario + IA
      const rows = await memChat.list({ limit: 10 });
      expect(rows).toHaveLength(2);
      expect(rows[0].role).toBe('ai');
      expect(rows[1].role).toBe('user');
    } finally {
      (globalThis as { fetch?: unknown }).fetch = undefined;
    }
  });

  it('cuota agotada (429) muestra mensaje y no usa fallback', async () => {
    mockFetchOnce({ error: 'sin cuota' }, false, 429);
    try {
      const { getByText, getByTestId, queryByText } = renderScreen();
      await waitFor(() => expect(getByTestId('ai-input')).toBeTruthy());
      fireEvent.changeText(getByTestId('ai-input'), 'cómo ahorro más');
      fireEvent.press(getByTestId('ai-send'));
      await waitFor(() => expect(getByText('Se acabó el uso de IA de este mes')).toBeTruthy());
      expect(getByText('Te quedan 0 preguntas a la IA')).toBeTruthy();
      // Sin fallback local tras 429
      expect(queryByText('No entendí, prueba con una sugerencia')).toBeNull();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = undefined;
    }
  });

  it('sin backend cae al pipeline local (fallback)', async () => {
    const { getByText, getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('ai-chip-hormiga')).toBeTruthy());
    fireEvent.press(getByTestId('ai-chip-hormiga'));
    await waitFor(() => expect(getByText('No entendí, prueba con una sugerencia')).toBeTruthy());

    fireEvent.changeText(getByTestId('ai-input'), 'hola mundo raro');
    fireEvent.press(getByTestId('ai-send'));
    await waitFor(() => expect(getByText('hola mundo raro')).toBeTruthy());
  });

  it('chip de pregunta libre va al endpoint y actualiza el contador', async () => {
    mockFetchOnce({
      type: 'lookup',
      title: 'Tus suscripciones',
      summary: 'Netflix y Spotify este mes',
      currency: 'BOB',
      suggestions: [],
      expense_ids: [],
      quota_remaining: 29,
    });
    try {
      const { getByText, getByTestId } = renderScreen();
      await waitFor(() => expect(getByTestId('ai-chip-subs')).toBeTruthy());
      fireEvent.press(getByTestId('ai-chip-subs'));
      await waitFor(() => expect(getByText('Tus suscripciones')).toBeTruthy());
      expect(getByText('Te quedan 29 preguntas a la IA')).toBeTruthy();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = undefined;
    }
  });

  it('volver llama back', async () => {
    const { getByLabelText } = renderScreen();
    await waitFor(() => expect(getByLabelText('Volver')).toBeTruthy());
    fireEvent.press(getByLabelText('Volver'));
    expect(mockBack).toHaveBeenCalled();
  });
});
