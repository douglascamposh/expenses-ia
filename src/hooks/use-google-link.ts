import { useCallback, useState } from 'react';
import {
  currentUid,
  deleteAccount,
  getGoogleAccount,
  linkGoogleAccount,
  signOutAccount,
  type GoogleAccount,
} from '@/services/auth';
import { billingLogin, billingLogout } from '@/services/billing';
import { useTranslation } from '@/i18n/useTranslation';

// `require` no está tipado (tsconfig solo incluye "jest"): declaración local
// para la carga perezosa del módulo nativo opcional.
declare const require: {
  (id: 'react-native-nitro-google-signin'): typeof import('react-native-nitro-google-signin');
};

type NitroModule = Pick<
  typeof import('react-native-nitro-google-signin'),
  | 'GoogleOneTapSignIn'
  | 'isCancelledResponse'
  | 'isErrorWithCode'
  | 'isNoSavedCredentialFoundResponse'
  | 'isSuccessResponse'
  | 'statusCodes'
>;

/**
 * Carga perezosa: si la compilación no trae el módulo nativo
 * (dev build anterior a instalarlo), devuelve null en vez de romper
 * el import y con él la pantalla que usa el hook.
 */
function loadNitro(): NitroModule | null {
  try {
    const m = require('react-native-nitro-google-signin');
    if (!m?.GoogleOneTapSignIn) return null;
    return m;
  } catch {
    return null;
  }
}

const nitro = loadNitro();

/** Web OAuth client ID (Google Cloud Console). Sin él el botón explica cómo configurarlo. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

let nitroConfigured = false;
function ensureNitroConfigured(): void {
  if (nitroConfigured || !nitro) return;
  nitro.GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  nitroConfigured = true;
}

export interface GoogleLinkState {
  account: GoogleAccount | null;
  linking: boolean;
  error: string | null;
  configured: boolean;
  link: () => Promise<void>;
  signOut: () => Promise<void>;
  removeAccount: () => Promise<void>;
  clearError: () => void;
}

/**
 * Vinculación con Google (SDK nativo → Firebase).
 * Requiere dev build con el plugin `react-native-nitro-google-signin`.
 */
export function useGoogleLink(): GoogleLinkState {
  const { t } = useTranslation();
  const [account, setAccount] = useState<GoogleAccount | null>(() => getGoogleAccount());
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = nitro !== null && GOOGLE_WEB_CLIENT_ID !== '';

  const link = useCallback(async () => {
    setError(null);
    if (getGoogleAccount()) {
      setAccount(getGoogleAccount());
      return;
    }
    if (!nitro) {
      setError(t('settings_googleUnavailable'));
      return;
    }
    if (GOOGLE_WEB_CLIENT_ID === '') {
      setError(t('settings_googleNotConfigured'));
      return;
    }
    setLinking(true);
    try {
      ensureNitroConfigured();
      let res = await nitro.GoogleOneTapSignIn.signIn();
      if (nitro.isNoSavedCredentialFoundResponse(res)) {
        res = await nitro.GoogleOneTapSignIn.presentExplicitSignIn();
      }
      if (nitro.isCancelledResponse(res)) return; // Silencioso.
      if (!nitro.isSuccessResponse(res)) {
        setError(t('settings_accountError'));
        return;
      }
      const idToken = res.data?.idToken;
      if (!idToken) {
        setError(t('settings_accountError'));
        return;
      }
      const { user } = await linkGoogleAccount(idToken);
      // Traspaso de Pro: RevenueCat sigue al UID resultante (cubre el caso
      // credential-already-in-use donde la sesión cambia de UID). Best effort.
      await billingLogin(user?.uid ?? currentUid() ?? '');
      setAccount(getGoogleAccount());
    } catch (e: unknown) {
      // Cancelado por el usuario: silencioso.
      if (nitro.isErrorWithCode(e) && e.code === nitro.statusCodes.SIGN_IN_CANCELLED) return;
      setError(e instanceof Error ? e.message : t('settings_accountError'));
    } finally {
      setLinking(false);
    }
  }, [t]);

  const clearError = useCallback(() => setError(null), []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await signOutAccount();
      await billingLogout();
      setAccount(getGoogleAccount());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('settings_accountError'));
    }
  }, [t]);

  const removeAccount = useCallback(async () => {
    setError(null);
    try {
      await deleteAccount();
      await billingLogout();
      setAccount(getGoogleAccount());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('settings_accountError'));
    }
  }, [t]);

  return { account, linking, error, configured, link, signOut, removeAccount, clearError };
}
