export type AppLang = 'es' | 'en';

const norm = (tag: unknown): string =>
  String(tag ?? '').trim().replace(/_/g, '-').toLowerCase();

const langOf = (tag: string): string => tag.split('-')[0] ?? '';
const regionOf = (tag: string): string => (tag.split('-')[1] ?? '').toUpperCase();

/** ¿El locale está instalado para uso offline? */
export function isLocaleInstalled(
  locale: unknown,
  supported: { installedLocales?: string[] } | null | undefined,
): boolean {
  const want = norm(locale);
  if (!want) return false;
  return (supported?.installedLocales ?? []).map(norm).includes(want);
}

/** Emoji de bandera desde código de región ISO (AR → 🇦🇷). */
export function flagForRegion(region: string): string {
  const r = String(region ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(r)) return '🌐';
  return String.fromCodePoint(...[...r].map((c) => 127397 + c.charCodeAt(0)));
}

/**
 * Elige el locale de reconocimiento sin forzar descargas:
 * 1. tag exacto del dispositivo ya instalado (offline, cero descargas),
 * 2. tag exacto soportado,
 * 3. misma lengua instalada,
 * 4. misma lengua soportada,
 * 5. regional por defecto (es: ES→es-ES, US→es-US, resto→es-MX; en→en-US),
 * 6. default por idioma de la app.
 */
export function resolveSpeechLocale(
  deviceTag: unknown,
  supported: { locales?: string[]; installedLocales?: string[] } | null | undefined,
  appLang: AppLang = 'es',
): string {
  const appDefault = appLang === 'en' ? 'en-US' : 'es-MX';
  const want = norm(deviceTag);
  if (!want) return appDefault;
  const rawLocales = (supported?.locales ?? []).filter(Boolean);
  const rawInstalled = (supported?.installedLocales ?? []).filter(Boolean);
  // Se compara normalizado pero se devuelve el tag original del sistema.
  const byNorm = new Map<string, string>();
  for (const raw of [...rawInstalled, ...rawLocales]) {
    const n = norm(raw);
    if (n && !byNorm.has(n)) byNorm.set(n, String(raw));
  }
  const locales = [...byNorm.keys()];
  const installed = new Set([...byNorm.keys()].filter((n) => rawInstalled.map(norm).includes(n)));
  const supportedSet = new Set(locales);

  if (installed.has(want)) return byNorm.get(want) as string;
  if (supportedSet.has(want)) return byNorm.get(want) as string;
  const sameInstalled = locales.find((l) => installed.has(l) && langOf(l) === langOf(want));
  if (sameInstalled) return byNorm.get(sameInstalled) as string;
  const sameSupported = locales.find((l) => langOf(l) === langOf(want));
  if (sameSupported) return byNorm.get(sameSupported) as string;

  if (langOf(want) === 'es') {
    const region = regionOf(want);
    const candidate = region === 'ES' ? 'es-ES' : region === 'US' ? 'es-US' : 'es-MX';
    if (supportedSet.size === 0 || supportedSet.has(candidate)) return candidate;
    return sameSupported ?? appDefault;
  }
  if (langOf(want) === 'en') {
    if (supportedSet.size === 0 || supportedSet.has('en-US')) return 'en-US';
    return sameSupported ?? appDefault;
  }
  return appDefault;
}
