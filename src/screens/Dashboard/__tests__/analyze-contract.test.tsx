import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardScreen } from '../index';
import expensesReducer from '@/store/expensesSlice';
import settingsReducer from '@/store/settingsSlice';
import categoriesReducer from '@/store/categoriesSlice';

// Payload con la forma exacta del backend (/api/analyze)
const analyzeResult = {
  expenses: [
    {
      amount: 250, category: 'FOOD', currency: 'BOB', date: '2026-09-08',
      description: 'Comida', paymentMethod: 'CASH',
    },
  ],
  raw: { success: true, actions: [], latency: 4833, model: 'gemini' },
  latency: 4833,
};

jest.mock('@/hooks/use-audio-recording', () => {
  const state = {
    state: 'recording',
    errorMessage: null,
    result: null,
    durationMs: 0,
    isRecording: true,
    startRecording: jest.fn(),
    stopRecording: jest.fn(() => {
      state.isRecording = false;
      state.state = 'idle';
      return Promise.resolve({ filePath: 'file:///rec.m4a' });
    }),
    clearError: jest.fn(),
  };
  return { useAudioRecording: () => state };
});

jest.mock('@/hooks/use-analyze-audio', () => ({
  useAnalyzeAudio: () => ({
    status: 'idle',
    expenses: null,
    error: null,
    isLoading: false,
    analyze: jest.fn(() => Promise.resolve(analyzeResult)),
    reset: jest.fn(),
  }),
}));

const realFetch = globalThis.fetch;
beforeEach(() => {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('contrato /api/analyze → cola de voz', () => {
  it('paymentMethod del backend llega al draft normalizado', async () => {
    const testStore = configureStore({
      reducer: { expenses: expensesReducer, settings: settingsReducer, categories: categoriesReducer },
      middleware: (g) => g({ serializableCheck: false }),
    });
    const { getByLabelText, getByText } = render(
      <Provider store={testStore}>
        <DashboardScreen />
      </Provider>,
    );
    // Mic flotante → stopRecording → analyze (mock con payload real) → cola
    fireEvent.press(getByLabelText('Detener grabación'));
    await waitFor(() => expect(getByText('Comida')).toBeTruthy(), { timeout: 5000 });
    const queue = testStore.getState().expenses.pendingQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ amount: 250, paymentMethod: 'CASH', date: '2026-09-08' });
  });
});
