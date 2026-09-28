import {
  deleteUser,
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  linkWithCredential,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from '@react-native-firebase/auth';
import { logApiError } from '@/utils/debug-log';

/**
 * Auth Firebase — sesión anónima silenciosa + ID tokens para el backend.
 * El backend valida el token con Admin SDK (verifyIdToken) y ata la cuota al UID.
 * Sin sesión no hay llamadas a /api/analyze, /api/analyze-text ni /api/embed.
 */

/** Error de autenticación (sign-in o token). `code` = código Firebase si existe. */
export class AuthError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

function toAuthError(e: unknown, fallback: string): AuthError {
  const code =
    typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string'
      ? (e as { code: string }).code
      : undefined;
  // Mensajes literales en español, como AnalyzeError.
  const message =
    code === 'auth/network-request-failed'
      ? 'Sin conexión: no se pudo iniciar sesión. Revisa tu internet.'
      : code === 'auth/operation-not-allowed'
        ? 'Login anónimo no habilitado en Firebase Console.'
        : fallback;
  const authError = new AuthError(message, code);
  logApiError('auth', authError, { code, cause: (e as Error)?.message ?? String(e) });
  return authError;
}

/** Sesión anónima en vuelo (evita sign-ins duplicados concurrentes). */
let signInFlight: Promise<User> | null = null;

/**
 * Asegura que exista un usuario Firebase (anónimo si no hay sesión).
 * Idempotente: llamadas concurrentes comparten la misma promesa.
 */
export function ensureSignedIn(): Promise<User> {
  let current: User | null = null;
  try {
    current = getAuth().currentUser;
  } catch (e) {
    // Sin módulo nativo (tests / Expo Go): se propaga como AuthError.
    throw toAuthError(e, 'Autenticación no disponible en este dispositivo.');
  }
  if (current) return Promise.resolve(current);
  if (!signInFlight) {
    signInFlight = signInAnonymously(getAuth())
      .then((cred) => cred.user)
      .catch((e: unknown) => {
        throw toAuthError(e, 'No se pudo iniciar sesión. Intenta de nuevo.');
      })
      .finally(() => {
        signInFlight = null;
      });
  }
  return signInFlight;
}

/**
 * Devuelve un ID token JWT para el header `Authorization: Bearer`.
 * Sin refresh forzado por defecto (el SDK auto-refresca al expirar);
 * `forceRefresh=true` solo ante un 401 del backend.
 */
export async function getAuthToken(forceRefresh = false): Promise<string> {
  const user = await ensureSignedIn();
  try {
    return await getIdToken(user, forceRefresh);
  } catch (e) {
    throw toAuthError(e, 'No se pudo obtener el token de sesión.');
  }
}

/** UID actual o null (cuota, debug). Nunca lanza. */
export function currentUid(): string | null {
  try {
    return getAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Cierra la sesión (vuelve a invitado; el próximo token crea un anónimo nuevo).
 * Los datos locales del dispositivo se conservan.
 */
export async function signOutAccount(): Promise<void> {
  try {
    await signOut(getAuth());
  } catch (e) {
    throw toAuthError(e, 'No se pudo cerrar sesión. Intenta de nuevo.');
  }
}

/**
 * Elimina la cuenta de Firebase (permanente, no se puede deshacer).
 * Los datos locales del dispositivo se conservan; el respaldo en la nube
 * queda huérfano. Puede exigir login reciente (requires-recent-login).
 */
export async function deleteAccount(): Promise<void> {
  let user;
  try {
    user = getAuth().currentUser;
  } catch (e) {
    throw toAuthError(e, 'Autenticación no disponible en este dispositivo.');
  }
  if (!user) return;
  try {
    await deleteUser(user);
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e
      ? String((e as { code: unknown }).code)
      : undefined;
    if (code === 'auth/requires-recent-login') {
      throw new AuthError('Por seguridad, inicia sesión de nuevo para eliminar tu cuenta.', code);
    }
    throw toAuthError(e, 'No se pudo eliminar la cuenta. Intenta de nuevo.');
  }
}

/** Cuenta Google vinculada a la sesión (null = invitado). Nunca lanza. */
export interface GoogleAccount {
  email: string | null;
  displayName: string | null;
}

export function getGoogleAccount(): GoogleAccount | null {
  try {
    const u = getAuth().currentUser;
    const g = u?.providerData?.find((p) => p?.providerId === 'google.com');
    if (!g) return null;
    return { email: g.email ?? u?.email ?? null, displayName: g.displayName ?? u?.displayName ?? null };
  } catch {
    return null;
  }
}

export interface GoogleLinkResult {
  /** Usuario Firebase resultante (mismo UID tras link, u otro UID si se adoptó). */
  user: { uid: string } | null;
  /** true si el Google ya pertenecía a otra cuenta y se adoptó esa sesión. */
  adopted: boolean;
}

/**
 * Vincula Google a la sesión actual: conserva el UID anónimo (y con él
 * el historial local y la cuota del backend). Si ese Google ya pertenece
 * a otra cuenta, adopta esa sesión en vez de fallar.
 */
export async function linkGoogleAccount(idToken: string): Promise<GoogleLinkResult> {
  if (!idToken) throw new AuthError('Falta el token de Google.');
  const user = await ensureSignedIn();
  let credential;
  try {
    credential = GoogleAuthProvider.credential(idToken);
  } catch (e) {
    throw toAuthError(e, 'No se pudo preparar la credencial de Google.');
  }
  try {
    const linked = await linkWithCredential(user, credential);
    return { user: linked.user, adopted: false };
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e
      ? String((e as { code: unknown }).code)
      : undefined;
    if (code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential') {
      try {
        const signed = await signInWithCredential(getAuth(), credential);
        return { user: signed.user, adopted: true };
      } catch (e2) {
        throw toAuthError(e2, 'Esa cuenta de Google ya está en uso en otro perfil.');
      }
    }
    throw toAuthError(e, 'No se pudo vincular Google. Intenta de nuevo.');
  }
}

/** Solo tests: resetea el sign-in en vuelo. */
export function __resetAuthForTests(): void {
  signInFlight = null;
}
