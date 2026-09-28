import { deleteUser, getAuth, getIdToken, GoogleAuthProvider, linkWithCredential, signInAnonymously, signInWithCredential, signOut } from '@react-native-firebase/auth';

import {
  __resetAuthForTests,
  AuthError,
  currentUid,
  deleteAccount,
  ensureSignedIn,
  getAuthToken,
  getGoogleAccount,
  linkGoogleAccount,
  signOutAccount,
} from '../auth';

// El logger de debug escribe en consola: silenciarlo aquí para no ensuciar la salida.
jest.mock('@/utils/debug-log', () => ({ logApiError: jest.fn(), logApiWarn: jest.fn() }));

const mockGetAuth = getAuth as jest.Mock;
const mockSignIn = signInAnonymously as jest.Mock;
const mockGetIdToken = getIdToken as jest.Mock;
const mockLink = linkWithCredential as jest.Mock;
const mockSignInCred = signInWithCredential as jest.Mock;

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

  it('linkGoogleAccount vincula y conserva el UID anónimo', async () => {
    const anon = { uid: 'anon-9', providerData: [] };
    mockGetAuth.mockReturnValue({ currentUser: anon });
    mockLink.mockResolvedValue({ user: { ...anon, providerData: [{ providerId: 'google.com' }] } });
    const user = await linkGoogleAccount('idtok');
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('idtok');
    expect(mockLink).toHaveBeenCalledTimes(1);
    expect(user.user?.uid).toBe('anon-9');
    expect(user.adopted).toBe(false);
  });

  it('linkGoogleAccount adopta la sesión si Google ya está en uso', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'anon-9', providerData: [] } });
    mockLink.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    mockSignInCred.mockResolvedValue({ user: { uid: 'google-uid' } });
    const user = await linkGoogleAccount('idtok');
    expect(mockSignInCred).toHaveBeenCalledTimes(1);
    expect(user.user?.uid).toBe('google-uid');
    expect(user.adopted).toBe(true);
  });

  it('linkGoogleAccount sin token lanza AuthError', async () => {
    await expect(linkGoogleAccount('')).rejects.toThrow(AuthError);
    expect(mockLink).not.toHaveBeenCalled();
  });

  it('getGoogleAccount refleja el provider google.com', () => {
    mockGetAuth.mockReturnValue({
      currentUser: { uid: 'u1', providerData: [{ providerId: 'google.com', email: 'a@b.com', displayName: 'A' }] },
    });
    expect(getGoogleAccount()).toEqual({ email: 'a@b.com', displayName: 'A' });
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'u1', providerData: [] } });
    expect(getGoogleAccount()).toBeNull();
  });

  it('signOutAccount cierra la sesión de Firebase', async () => {
    await signOutAccount();
    expect(signOut as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('deleteAccount elimina el usuario actual', async () => {
    const user = { uid: 'u1' };
    mockGetAuth.mockReturnValue({ currentUser: user });
    await deleteAccount();
    expect(deleteUser as jest.Mock).toHaveBeenCalledWith(user);
  });

  it('deleteAccount sin sesión no hace nada', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });
    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(deleteUser as jest.Mock).not.toHaveBeenCalled();
  });

  it('deleteAccount con login viejo pide re-autenticar', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'u1' } });
    (deleteUser as jest.Mock).mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
    await expect(deleteAccount()).rejects.toThrow(/inicia sesión de nuevo/);
  });
});
