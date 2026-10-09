import { useCallback, useEffect, useState } from 'react';
import {
  billingLogin,
  getProDetails,
  getProPrice,
  isBillingAvailable,
  isBillingConfigured,
  purchasePro,
  refreshBackendPro,
  restorePro,
  type ProDetails,
} from '@/services/billing';
import type { Lang } from '@/i18n/translations';
import { currentUid, getAuthToken } from '@/services/auth';
import { useTranslation } from '@/i18n/useTranslation';

export interface ProState {
  isPro: boolean;
  proDetails: ProDetails;
  price: string | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  available: boolean;
  configured: boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Estado Pro vía RevenueCat: vincula al UID de Firebase y lee el entitlement.
 * Sin nativo o sin API keys todo es no-op seguro (modo prueba).
 */
export function usePro(): ProState {
  const { t } = useTranslation();
  const [isPro, setIsPro] = useState(false);
  const [proDetails, setProDetails] = useState<ProDetails>({ isPro: false, expirationDate: null, period: null });
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const uid = currentUid();
      if (uid) await billingLogin(uid);
      const [details, currentPrice] = await Promise.all([getProDetails(), getProPrice()]);
      setIsPro(details.isPro);
      setProDetails(details);
      setPrice(currentPrice);
    } catch {
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync inicial del entitlement al montar: legítimo (suscripción a estado externo).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const purchase = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!isBillingAvailable()) {
      setError(t('settings_googleUnavailable'));
      return false;
    }
    if (!isBillingConfigured()) {
      setError(t('pro_notConfigured'));
      return false;
    }
    setBusy(true);
    try {
      const outcome = await purchasePro();
      // Releer el estado real (el Test Store puede tardar en activar el
      // entitlement): evita mostrar "Ya eres Pro" sin entitlement activo.
      await refresh();
      // Avisar al backend para que revalide en RevenueCat y escriba
      // is_pro en Firestore al instante (sin esperar al webhook).
      if (outcome === 'purchased') {
        await refreshBackendPro(() => getAuthToken());
        return true;
      }
      return false; // Cancelado o sin entitlement: silencioso.
    } catch {
      setError(t('pro_purchaseError'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [t, refresh]);

  const restore = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!isBillingAvailable()) {
      setError(t('settings_googleUnavailable'));
      return false;
    }
    if (!isBillingConfigured()) {
      setError(t('pro_notConfigured'));
      return false;
    }
    setBusy(true);
    try {
      const active = await restorePro();
      setIsPro(active);
      return active;
    } catch {
      setError(t('pro_purchaseError'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [t]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isPro,
    proDetails,
    price,
    loading,
    busy,
    error,
    available: isBillingAvailable(),
    configured: isBillingConfigured(),
    purchase,
    restore,
    refresh,
    clearError,
  };
}

/** Fecha media localizada para el aviso de renovación (cae al ISO si falla). */
export function formatProDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-BO', { dateStyle: 'medium' }).format(d);
  } catch {
    return iso;
  }
}
