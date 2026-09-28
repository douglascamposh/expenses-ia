import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AccountScreen from '../account';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(() => {}),
}));

const mockLink = jest.fn();
const mockSignOut = jest.fn();
const mockRemoveAccount = jest.fn();
const mockHookState = {
  account: null as { email: string | null; displayName: string | null } | null,
  linking: false,
  error: null as string | null,
  configured: true,
  link: mockLink,
  signOut: mockSignOut,
  removeAccount: mockRemoveAccount,
  clearError: jest.fn(),
};
jest.mock('@/hooks/use-google-link', () => ({
  useGoogleLink: () => mockHookState,
}));

jest.mock('@/services/sync', () => ({
  runSync: jest.fn(),
}));

jest.mock('@/hooks/use-pro', () => ({
  usePro: () => ({
    isPro: false,
    proDetails: { isPro: false, expirationDate: null, period: null },
    price: null,
    loading: false,
    busy: false,
    error: null,
    available: false,
    configured: false,
    purchase: jest.fn(),
    restore: jest.fn(),
    refresh: jest.fn(),
    clearError: jest.fn(),
  }),
  formatProDate: (iso: string) => iso,
}));

beforeEach(() => {
  mockLink.mockClear();
  mockSignOut.mockClear();
  mockRemoveAccount.mockClear();
  (jest.requireMock('@/services/sync') as { runSync: jest.Mock }).runSync.mockReset();
  mockHookState.account = null;
  mockHookState.linking = false;
  mockHookState.error = null;
});

describe('AccountScreen', () => {
  it('invitado: Google habilitado sin suscripción y llama a link', async () => {
    const { getByText, getByTestId, queryByTestId } = render(<AccountScreen />);
    await waitFor(() => expect(getByTestId('account-status')).toBeTruthy());
    expect(getByText('Invitado')).toBeTruthy();
    expect(queryByTestId('account-pro-note')).toBeNull();
    const btn = getByTestId('account-link-google');
    expect(btn.props.accessibilityState).toEqual({ disabled: false });
    fireEvent.press(btn);
    expect(mockLink).toHaveBeenCalledTimes(1);
  });

  it('vinculado: muestra el email en vez del botón', async () => {
    mockHookState.account = { email: 'a@b.com', displayName: 'A' };
    const { getByText, getByTestId, queryByTestId } = render(<AccountScreen />);
    await waitFor(() => expect(getByTestId('account-status')).toBeTruthy());
    expect(getByText('a@b.com')).toBeTruthy();
    expect(queryByTestId('account-link-google')).toBeNull();
  });

  it('vinculado: sincronizar éxito muestra resumen', async () => {
    mockHookState.account = { email: 'a@b.com', displayName: 'A' };
    const { runSync } = jest.requireMock('@/services/sync') as { runSync: jest.Mock };
    runSync.mockResolvedValue({ pushed: 2, pulled: 1, conflicts: 0 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const { getByTestId } = render(<AccountScreen />);
      await waitFor(() => expect(getByTestId('account-sync')).toBeTruthy());
      fireEvent.press(getByTestId('account-sync'));
      await waitFor(() => expect(runSync).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Sincronizar ahora', expect.stringContaining('2')),
      );
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('vinculado: sincronizar 403 ofrece ver Pro', async () => {
    mockHookState.account = { email: 'a@b.com', displayName: 'A' };
    const { runSync } = jest.requireMock('@/services/sync') as { runSync: jest.Mock };
    runSync.mockRejectedValue({ status: 403, message: 'Se requiere Pro' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const { getByTestId } = render(<AccountScreen />);
      await waitFor(() => expect(getByTestId('account-sync')).toBeTruthy());
      fireEvent.press(getByTestId('account-sync'));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy.mock.calls[0][0]).toBe('Función Pro');
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('vinculado: cerrar sesión confirma y llama a signOut', async () => {
    mockHookState.account = { email: 'a@b.com', displayName: 'A' };
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const { getByTestId } = render(<AccountScreen />);
      await waitFor(() => expect(getByTestId('account-signout')).toBeTruthy());
      fireEvent.press(getByTestId('account-signout'));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      buttons.find((b) => b.text === 'Cerrar sesión')?.onPress?.();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('vinculado: eliminar cuenta confirma y llama a removeAccount', async () => {
    mockHookState.account = { email: 'a@b.com', displayName: 'A' };
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const { getByTestId } = render(<AccountScreen />);
      await waitFor(() => expect(getByTestId('account-delete')).toBeTruthy());
      fireEvent.press(getByTestId('account-delete'));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      buttons.find((b) => b.text === 'Eliminar')?.onPress?.();
      expect(mockRemoveAccount).toHaveBeenCalledTimes(1);
    } finally {
      alertSpy.mockRestore();
    }
  });
});
