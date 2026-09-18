import {
  getAuth,
  getIdToken,
  signInAnonymously,
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
  // Mensajes literales en español, como AnalyzeError/EmbedError.
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

/** Solo tests: resetea el sign-in en vuelo. */
export function __resetAuthForTests(): void {
  signInFlight = null;
}
