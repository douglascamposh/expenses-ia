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

beforeEach(() => {
  mockPush.mockClear();
});

describe('mic PoC → transcripción', () => {
  it('el mic flotante abre la pantalla de transcripción (flujo viejo intacto)', async () => {
    const testStore = configureStore({
      reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const { getByLabelText, getByText } = render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    );
    await waitFor(() => expect(getByText(/No expenses yet/)).toBeTruthy());
    fireEvent.press(getByLabelText('Grabar gasto por voz'));
    expect(mockPush).toHaveBeenCalledWith('/voice-text');
  });
});
