import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProScreen from '../pro';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

const mockPurchase = jest.fn(() => Promise.resolve(true));
const mockRestore = jest.fn(() => Promise.resolve(true));
const mockProDetails: { isPro: boolean; expirationDate: string | null; period: 'monthly' | 'yearly' | 'lifetime' | null } = {
  isPro: false, expirationDate: null, period: null,
};
jest.mock('@/hooks/use-pro', () => ({
  usePro: () => ({
    isPro: false,
    proDetails: mockProDetails,
    price: '$2.99',
    loading: false,
    busy: false,
    error: null,
    available: true,
    configured: true,
    purchase: mockPurchase,
    restore: mockRestore,
    refresh: jest.fn(),
    clearError: jest.fn(),
  }),
  formatProDate: (iso: string) => iso,
}));

beforeEach(() => {
  mockPurchase.mockClear();
  mockRestore.mockClear();
  mockPurchase.mockResolvedValue(true);
  mockRestore.mockResolvedValue(true);
  mockProDetails.isPro = false;
  mockProDetails.expirationDate = null;
  mockProDetails.period = null;
});

describe('ProScreen', () => {
  it('muestra los 3 beneficios, comprar confirma y restaurar avisa', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const { getByText, getByTestId } = render(<ProScreen />);
      await waitFor(() => expect(getByTestId('pro-benefit-backup')).toBeTruthy());
      expect(getByTestId('pro-benefit-ai')).toBeTruthy();
      expect(getByTestId('pro-benefit-voice')).toBeTruthy();
      expect(getByText('Respaldo automático en la nube')).toBeTruthy();
      expect(getByText('Suscribirme · $2.99/mes')).toBeTruthy();
      fireEvent.press(getByTestId('pro-subscribe-btn'));
      await waitFor(() => expect(mockPurchase).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('¡Bienvenido a Pro!', expect.any(String)));
      fireEvent.press(getByTestId('pro-restore-btn'));
      await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1));
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('suscrito muestra banner con vencimiento y renovación', async () => {
    mockProDetails.isPro = true;
    mockProDetails.expirationDate = '2026-10-23T12:00:00.000Z';
    mockProDetails.period = 'monthly';
    const { getByTestId } = render(<ProScreen />);
    await waitFor(() => expect(getByTestId('pro-status-banner')).toBeTruthy());
  });
});
