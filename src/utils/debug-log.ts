/**
 * Debug log — logging liviano para API/auth, solo en desarrollo.
 * En producción es no-op para no filtrar detalles internos.
 */

type LogExtra = Record<string, unknown>;

function formatExtra(extra?: LogExtra): string {
  if (!extra || Object.keys(extra).length === 0) return '';
  try {
    return ` ${JSON.stringify(extra).slice(0, 500)}`;
  } catch {
    return '';
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Error de API/auth: console.error solo en __DEV__. Nunca lanza. */
export function logApiError(scope: string, error: unknown, extra?: LogExtra): void {
  try {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error(`[${scope}] ${toMessage(error)}${formatExtra(extra)}`);
    }
  } catch {
    // Nunca romper la app por un log.
  }
}

/** Aviso recuperable (reintentos, fallbacks): console.warn solo en __DEV__. Nunca lanza. */
export function logApiWarn(scope: string, message: string, extra?: LogExtra): void {
  try {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[${scope}] ${message}${formatExtra(extra)}`);
    }
  } catch {
    // Nunca romper la app por un log.
  }
}
