import { Platform } from 'react-native';
import { logApiWarn } from '@/utils/debug-log';
import type PurchasesType from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';

// `require` no está tipado (tsconfig solo incluye "jest"): declaración local
// para la carga perezosa del módulo nativo opcional.
declare const require: {
  (id: 'react-native-purchases'): typeof import('react-native-purchases');
};

/** Entitlement Pro en RevenueCat (mismo en iOS y Android). */
export const PRO_ENTITLEMENT_ID = 'kybo_pro';
/** Product ID de la suscripción mensual (mismo en App Store y Play). */
export const PRO_PRODUCT_ID = 'ia_pro_monthly';

/** API keys públicas de RevenueCat (seguras en cliente). Vacías = sin configurar. */
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

/**
 * Carga perezosa: si la compilación no trae el módulo nativo
 * (dev build anterior a instalarlo), devuelve null en vez de romper el import.
 */
function loadPurchases(): typeof PurchasesType | null {
  try {
    const m = require('react-native-purchases');
    const P = (m?.default ?? m) as typeof PurchasesType | undefined;
    if (!P || typeof P.configure !== 'function') return null;
    return P;
  } catch {
    return null;
  }
}

const Purchases = loadPurchases();

/** Nativo disponible (compilación con el módulo). */
export function isBillingAvailable(): boolean {
  return Purchases !== null;
}

/** Nativo + API key de la plataforma. */
export function isBillingConfigured(): boolean {
  if (!Purchases) return false;
  return (Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY) !== '';
}

let configured = false;
function ensureConfigured(): boolean {
  if (!Purchases) return false;
  const key = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
  if (!key) return false;
  if (!configured) {
    Purchases.configure({ apiKey: key });
    configured = true;
  }
  return true;
}

function hasProEntitlement(info: { entitlements?: { active?: Record<string, unknown> } } | null | undefined): boolean {
  return info?.entitlements?.active?.[PRO_ENTITLEMENT_ID] != null;
}

type ProPackage = { product?: { identifier?: string } | null } | null | undefined;

async function findProPackage(): Promise<PurchasesPackage | null> {
  if (!Purchases) throw new Error('billing-unavailable');
  if (!ensureConfigured()) throw new Error('billing-not-configured');
  const offerings = await Purchases.getOfferings();
  const pkgs = (offerings?.current?.availablePackages ?? []) as ProPackage[];
  if (__DEV__) {
    logApiWarn('billing', 'paquetes disponibles', {
      ids: pkgs.map((p) => p?.product?.identifier ?? null),
    });
  }
  // 1) ID exacto configurado.
  const exact = pkgs.find((p) => p?.product?.identifier === PRO_PRODUCT_ID) ?? null;
  if (exact) return exact as PurchasesPackage | null;
  // 2) Paquete mensual (el producto de la tienda puede llamarse "monthly"
  // en vez de "ia_pro_monthly"). Evita comprar el primero a ciegas.
  const monthly = pkgs.find((p) => {
    const typed = p as { packageType?: unknown; product?: { identifier?: unknown } };
    if (typeof typed.packageType === 'string' && typed.packageType === 'MONTHLY') return true;
    const id = typeof typed.product?.identifier === 'string' ? typed.product.identifier.toLowerCase() : '';
    return id.includes('month');
  }) ?? null;
  if (monthly) return monthly as PurchasesPackage | null;
  // 3) Último recurso: primero disponible.
  return (pkgs[0] as PurchasesPackage | null) ?? null;
}

/** Precio localizado del paquete Pro (ej. "$2.99/mes") o null si no hay oferta. */
export async function getProPrice(): Promise<string | null> {
  try {
    const pkg = await findProPackage();
    const price = (pkg as { product?: { priceString?: unknown } } | null)?.product?.priceString;
    return typeof price === 'string' && price !== '' ? price : null;
  } catch {
    return null;
  }
}

/** Vincula RevenueCat al UID de Firebase (best effort). */
export async function billingLogin(uid: string): Promise<void> {
  if (!ensureConfigured() || !Purchases || !uid) return;
  try {
    await Purchases.logIn(uid);
  } catch {
    // No bloquea la app: reintenta en el próximo refresh.
  }
}

/** Cierra la sesión de RevenueCat (tras signOut de Firebase). */
export async function billingLogout(): Promise<void> {
  if (!ensureConfigured() || !Purchases) return;
  try {
    await Purchases.logOut();
  } catch {
    // Best effort.
  }
}

/** ¿El entitlement `pro` está activo? Sin configurar → false. */
export async function getProStatus(): Promise<boolean> {
  if (!ensureConfigured() || !Purchases) return false;
  const info = await Purchases.getCustomerInfo();
  return hasProEntitlement(info);
}

export type ProPeriod = 'monthly' | 'yearly' | 'lifetime';

export interface ProDetails {
  isPro: boolean;
  /** ISO de vencimiento/renovación. Null en lifetime o desconocido. */
  expirationDate: string | null;
  period: ProPeriod | null;
}

/** Detalle Pro: estado + vencimiento + período (para el aviso de renovación). */
export async function getProDetails(): Promise<ProDetails> {
  const none: ProDetails = { isPro: false, expirationDate: null, period: null };
  if (!ensureConfigured() || !Purchases) return none;
  const info = await Purchases.getCustomerInfo();
  if (__DEV__) {
    const active = info?.entitlements?.active as Record<string, unknown> | undefined;
    logApiWarn('billing', 'entitlements activos', {
      keys: active ? Object.keys(active) : [],
      busca: PRO_ENTITLEMENT_ID,
    });
  }
  const ent = info?.entitlements?.active?.[PRO_ENTITLEMENT_ID] as { expirationDate?: unknown } | undefined;
  if (!ent) return none;
  const expirationDate = typeof ent.expirationDate === 'string' ? ent.expirationDate : null;
  let period: ProPeriod | null = null;
  try {
    const pkg = (await findProPackage()) as {
      packageType?: unknown;
      product?: { identifier?: unknown };
    } | null;
    const pt = typeof pkg?.packageType === 'string' ? pkg.packageType : '';
    if (pt === 'ANNUAL') period = 'yearly';
    else if (pt === 'MONTHLY') period = 'monthly';
    else if (pt === 'LIFETIME') period = 'lifetime';
    else {
      const id = typeof pkg?.product?.identifier === 'string' ? pkg.product.identifier.toLowerCase() : '';
      if (/annual|year/.test(id)) period = 'yearly';
      else if (/month/.test(id)) period = 'monthly';
      else if (/life/.test(id)) period = 'lifetime';
    }
  } catch {
    // Sin paquete: fecha sin período.
  }
  return { isPro: true, expirationDate, period };
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

/**
 * Compra la suscripción Pro (paquete `ia_pro_monthly` del offering actual).
 * Lanza Error si no hay oferta o falla el pago. Cancelación → 'cancelled'.
 */
export async function purchasePro(): Promise<PurchaseOutcome> {
  if (!Purchases) throw new Error('billing-unavailable');
  if (!ensureConfigured()) throw new Error('billing-not-configured');
  const pkg = await findProPackage();
  if (!pkg) throw new Error('billing-no-offering');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (hasProEntitlement(customerInfo)) return 'purchased';
    // El Test Store valida el recibo en background: el customerInfo del
    // momento puede aún no traer el entitlement. Invalidar caché y releer.
    try {
      await Purchases.invalidateCustomerInfoCache();
      const fresh = await Purchases.getCustomerInfo();
      return hasProEntitlement(fresh) ? 'purchased' : 'cancelled';
    } catch {
      return 'cancelled';
    }
  } catch (e: unknown) {
    if (isUserCancelled(e)) return 'cancelled';
    throw e instanceof Error ? e : new Error('billing-failed');
  }
}

/** Restaura compras (retorna true si hay Pro activo). Lanza si falla. */
export async function restorePro(): Promise<boolean> {
  if (!Purchases) throw new Error('billing-unavailable');
  if (!ensureConfigured()) throw new Error('billing-not-configured');
  const info = await Purchases.restorePurchases();
  return hasProEntitlement(info);
}

/**
 * Avisa al backend que revalide el Pro en RevenueCat (`POST /api/billing/refresh`).
 * El backend consulta RevenueCat server-side y escribe `is_pro: true` en
 * Firestore al instante (sin esperar al webhook). Best effort: nunca lanza.
 *
 * Backend único (análisis, billing y sync viven en el mismo host):
 * prioridad EXPO_PUBLIC_BILLING_URL > EXPO_PUBLIC_API_URL > default.
 */
export function getBillingBaseUrl(): string {
  const direct = process.env.EXPO_PUBLIC_BILLING_URL;
  if (direct && direct.length > 0) return direct;
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (api && api.length > 0) return api;
  return 'https://expense-audio-analyzer.ai.studio';
}

export async function refreshBackendPro(getToken: () => Promise<string>): Promise<boolean> {
  try {
    const token = await getToken();
    const res = await fetch(`${getBillingBaseUrl()}/api/billing/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (__DEV__) {
      logApiWarn('billing', 'refresh backend pro', { status: res.status });
    }
    return res.ok;
  } catch {
    return false;
  }
}

function isUserCancelled(e: unknown): boolean {
  const code = typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : '';
  return /CANCEL/i.test(code);
}

/** Solo tests: resetea el flag de configure. */
export function __resetBillingForTests(): void {
  configured = false;
}
