import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VoiceTextScreen from '../voice-text';
import { getVoiceTranscript, clearVoiceTranscript } from '@/services/voice-draft';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

function speechMocks() {
  return jest.requireMock('expo-speech-recognition') as {
    ExpoSpeechRecognitionModule: Record<string, jest.Mock>;
    __listeners: Record<string, (e: never) => void>;
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  clearVoiceTranscript();
  const { ExpoSpeechRecognitionModule } = speechMocks();
  for (const k of ['start', 'stop', 'abort']) (ExpoSpeechRecognitionModule[k] as jest.Mock).mockClear();
});

describe('VoiceTextScreen (PoC transcripción)', () => {
  it('al montar pide permiso e inicia offline en es-MX', async () => {
    const { ExpoSpeechRecognitionModule } = speechMocks();
    render(<VoiceTextScreen />);
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    expect(ExpoSpeechRecognitionModule.start.mock.calls[0][0]).toMatchObject({
      lang: 'es-MX',
      interimResults: true,
      requiresOnDeviceRecognition: true,
    });
  });

  it('muestra parciales y acumula el final', async () => {
    const { __listeners } = speechMocks();
    const { getByText, queryByText } = render(<VoiceTextScreen />);
    await waitFor(() => expect(__listeners.start).toBeDefined());
    act(() => { __listeners.start(undefined as never); });
    act(() => { __listeners.result({ results: [{ transcript: 'gasté 10' }], isFinal: false } as never); });
    expect(getByText('gasté 10')).toBeTruthy();
    act(() => { __listeners.result({ results: [{ transcript: 'gasté 10 en pan' }], isFinal: true } as never); });
    expect(getByText('gasté 10 en pan')).toBeTruthy();
    expect(queryByText('gasté 10')).toBeNull();
  });

  it('error sin modelo offline reintenta vía servidor antes de fallar', async () => {
    const { ExpoSpeechRecognitionModule, __listeners } = speechMocks();
    render(<VoiceTextScreen />);
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1));
    act(() => { __listeners.error({ error: 'network', message: 'x' } as never); });
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(2));
    expect(ExpoSpeechRecognitionModule.start.mock.calls[1][0]).toMatchObject({
      requiresOnDeviceRecognition: false,
    });
  });

  it('✓ guarda el transcript en memoria y vuelve', async () => {
    const { __listeners } = speechMocks();
    const { getByLabelText, getByText } = render(<VoiceTextScreen />);
    await waitFor(() => expect(__listeners.start).toBeDefined());
    act(() => { __listeners.start(undefined as never); });
    act(() => { __listeners.result({ results: [{ transcript: 'pan 100' }], isFinal: true } as never); });
    expect(getByText('pan 100')).toBeTruthy();
    fireEvent.press(getByLabelText('Guardar transcripción'));
    expect(getVoiceTranscript()).toBe('pan 100');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('con celular en es-AR usa su modelo sin descargar y muestra su bandera', async () => {
    const localization = jest.requireMock('expo-localization') as { getLocales: jest.Mock };
    localization.getLocales.mockReturnValueOnce([{ languageCode: 'es', languageTag: 'es-AR' }]);
    const { ExpoSpeechRecognitionModule } = speechMocks();
    (ExpoSpeechRecognitionModule.getSupportedLocales as jest.Mock).mockResolvedValueOnce({
      locales: ['es-AR', 'es-MX', 'en-US'],
      installedLocales: ['es-AR'],
    });
    const { getByText } = render(<VoiceTextScreen />);
    await waitFor(() =>
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'es-AR', requiresOnDeviceRecognition: true }),
      ),
    );
    expect(getByText('🇦🇷')).toBeTruthy();
  });

  it('X aborta sin guardar y vuelve', async () => {
    const { ExpoSpeechRecognitionModule } = speechMocks();
    const { getByLabelText } = render(<VoiceTextScreen />);
    fireEvent.press(getByLabelText('Cancelar transcripción'));
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    expect(getVoiceTranscript()).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
