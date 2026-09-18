import { getAuth, getIdToken, signInAnonymously } from '@react-native-firebase/auth';

import {
  __resetAuthForTests,
  AuthError,
  currentUid,
  ensureSignedIn,
  getAuthToken,
} from '../auth';

// El logger de debug escribe en consola: silenciarlo aquí para no ensuciar la salida.
jest.mock('@/utils/debug-log', () => ({ logApiError: jest.fn(), logApiWarn: jest.fn() }));

const mockGetAuth = getAuth as jest.Mock;
const mockSignIn = signInAnonymously as jest.Mock;
const mockGetIdToken = getIdToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  __resetAuthForTests();
  mockGetAuth.mockReturnValue({ currentUser: { uid: 'u1' } });
  mockGetIdToken.mockResolvedValue('tok-1');
});

describe('auth Firebase', () => {
  it('reutiliza la sesión existente sin sign-in', async () => {
    const user = await ensureSignedIn();
    expect(user).toEqual({ uid: 'u1' });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('hace sign-in anónimo si no hay usuario', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });
    mockSignIn.mockResolvedValue({ user: { uid: 'anon-1' } });
    const user = await ensureSignedIn();
    expect(user).toEqual({ uid: 'anon-1' });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('llamadas concurrentes comparten un solo sign-in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });
    let resolveSignIn!: (v: { user: { uid: string } }) => void;
    mockSignIn.mockReturnValue(
      new Promise((res) => {
        resolveSignIn = res;
      }),
    );
    const p1 = ensureSignedIn();
    const p2 = ensureSignedIn();
    resolveSignIn({ user: { uid: 'anon-2' } });
    await expect(p1).resolves.toEqual({ uid: 'anon-2' });
    await expect(p2).resolves.toEqual({ uid: 'anon-2' });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('getAuthToken pide token sin refresh forzado por defecto', async () => {
    await expect(getAuthToken()).resolves.toBe('tok-1');
    expect(mockGetIdToken).toHaveBeenCalledWith({ uid: 'u1' }, false);
  });

  it('getAuthToken propaga forceRefresh=true (reintento ante 401)', async () => {
    await expect(getAuthToken(true)).resolves.toBe('tok-1');
    expect(mockGetIdToken).toHaveBeenCalledWith({ uid: 'u1' }, true);
  });

  it('fallo de sign-in lanza AuthError en español', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });
    mockSignIn.mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(ensureSignedIn()).rejects.toThrow(AuthError);
    await expect(ensureSignedIn()).rejects.toThrow(/conexión/i);
  });

  it('fallo de token lanza AuthError', async () => {
    mockGetIdToken.mockRejectedValue(new Error('boom'));
    await expect(getAuthToken()).rejects.toThrow(AuthError);
  });

  it('currentUid nunca lanza y devuelve null sin sesión', () => {
    expect(currentUid()).toBe('u1');
    mockGetAuth.mockImplementation(() => {
      throw new Error('no native');
    });
    expect(currentUid()).toBeNull();
  });
});
