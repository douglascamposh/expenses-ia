import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import VoiceTextScreen from '../voice-text';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import { getVoiceTranscript, clearVoiceTranscript } from '@/services/voice-draft';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

function renderScreen() {
  const testStore = configureStore({
    reducer: { expenses: expensesReducer, settings: settingsReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
  return render(
    <Provider store={testStore}>
      <VoiceTextScreen />
    </Provider>,
  );
}

function speechMocks() {
  return jest.requireMock('expo-speech-recognition') as {
    ExpoSpeechRecognitionModule: Record<string, jest.Mock>;
    __listeners: Record<string, (e: never) => void>;
  };
}

const realFetch = globalThis.fetch;
beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  clearVoiceTranscript();
  const { ExpoSpeechRecognitionModule } = speechMocks();
  for (const k of ['start', 'stop', 'abort']) (ExpoSpeechRecognitionModule[k] as jest.Mock).mockClear();
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          expenses: [
            {
              amount: 25, currency: 'BOB', category: 'TRANSPORTE',
              description: 'Uber', date: '2024-03-20', paymentMethod: 'CASH',
            },
          ],
        }),
    }),
  );
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('VoiceTextScreen (PoC transcripción)', () => {
  it('al montar pide permiso e inicia offline en es-MX', async () => {
    const { ExpoSpeechRecognitionModule } = speechMocks();
    renderScreen();
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    expect(ExpoSpeechRecognitionModule.start.mock.calls[0][0]).toMatchObject({
      lang: 'es-MX',
      interimResults: true,
      requiresOnDeviceRecognition: true,
    });
  });

  it('muestra el placeholder y luego palabras separadas que se consolidan', async () => {
    const { __listeners } = speechMocks();
    const { getByText, queryByText } = renderScreen();
    expect(getByText('Dime los detalles de tu transacción')).toBeTruthy();
    await waitFor(() => expect(__listeners.start).toBeDefined());
    act(() => { __listeners.start(undefined as never); });
    act(() => { __listeners.result({ results: [{ transcript: 'gasté 10' }], isFinal: false } as never); });
    expect(getByText('gasté')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
    expect(queryByText('Dime los detalles de tu transacción')).toBeNull();
    act(() => { __listeners.result({ results: [{ transcript: 'gasté 10 en pan' }], isFinal: true } as never); });
    for (const w of ['gasté', '10', 'en', 'pan']) expect(getByText(w)).toBeTruthy();
  });

  it('error sin modelo offline reintenta vía servidor antes de fallar', async () => {
    const { ExpoSpeechRecognitionModule, __listeners } = speechMocks();
    renderScreen();
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1));
    act(() => { __listeners.error({ error: 'network', message: 'x' } as never); });
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(2));
    expect(ExpoSpeechRecognitionModule.start.mock.calls[1][0]).toMatchObject({
      requiresOnDeviceRecognition: false,
    });
  });

  it('✓ envía el texto al endpoint, guarda draft y vuelve con cola', async () => {
    const { __listeners } = speechMocks();
    const { getByLabelText } = renderScreen();
    await waitFor(() => expect(__listeners.start).toBeDefined());
    act(() => { __listeners.start(undefined as never); });
    act(() => { __listeners.result({ results: [{ transcript: 'Uber 25' }], isFinal: true } as never); });
    fireEvent.press(getByLabelText('Guardar transcripción'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(getVoiceTranscript()).toBe('Uber 25');
    const fetchMock = globalThis.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/analyze-text'),
      expect.objectContaining({ method: 'POST' }),
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ text: 'Uber 25', model: 'gemini' });
    expect(typeof sent.currentDate).toBe('string');
    expect(Array.isArray(sent.categories)).toBe(true);
  });

  it('✓ muestra el contrato exacto del backend', async () => {
    const { __listeners } = speechMocks();
    const { getByLabelText } = renderScreen();
    await waitFor(() => expect(__listeners.start).toBeDefined());
    act(() => { __listeners.start(undefined as never); });
    act(() => { __listeners.result({ results: [{ transcript: 'Ayer gasté 25 dólares en un Uber' }], isFinal: true } as never); });
    fireEvent.press(getByLabelText('Guardar transcripción'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    const fetchMock = globalThis.fetch as jest.Mock;
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['categories', 'currentDate', 'model', 'text']);
  });

  it('✓ con backend caído muestra error y no vuelve', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
    const { __listeners } = speechMocks();
    const { getByLabelText, getByText } = renderScreen();
    await waitFor(() => expect(__listeners.start).toBeDefined());
    act(() => { __listeners.start(undefined as never); });
    act(() => { __listeners.result({ results: [{ transcript: 'pan 100' }], isFinal: true } as never); });
    fireEvent.press(getByLabelText('Guardar transcripción'));
    await waitFor(() => expect(getByText('offline')).toBeTruthy());
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('con celular en es-AR usa su modelo sin descargar y muestra su bandera', async () => {
    const localization = jest.requireMock('expo-localization') as { getLocales: jest.Mock };
    localization.getLocales.mockReturnValueOnce([{ languageCode: 'es', languageTag: 'es-AR' }]);
    const { ExpoSpeechRecognitionModule } = speechMocks();
    (ExpoSpeechRecognitionModule.getSupportedLocales as jest.Mock).mockResolvedValueOnce({
      locales: ['es-AR', 'es-MX', 'en-US'],
      installedLocales: ['es-AR'],
    });
    const { getByText } = renderScreen();
    await waitFor(() =>
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'es-AR', requiresOnDeviceRecognition: true }),
      ),
    );
    expect(getByText('🇦🇷')).toBeTruthy();
  });

  it('X aborta sin guardar y vuelve', async () => {
    const { ExpoSpeechRecognitionModule } = speechMocks();
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('Cancelar transcripción'));
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    expect(getVoiceTranscript()).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
