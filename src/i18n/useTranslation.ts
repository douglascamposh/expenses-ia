import { useCallback, useSyncExternalStore } from 'react';
import { getLocales } from 'expo-localization';
import { store } from '@/store';
import { STRINGS, type Lang, type StringKey } from './translations';

function deviceLang(): Lang {
  try {
    const code = getLocales()?.[0]?.languageCode;
    if (!code) return 'es';
    return code.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
}

export function resolveLang(setting: string | undefined): Lang {
  if (setting === 'es' || setting === 'en') return setting;
  return deviceLang();
}

type Vars = Record<string, string | number>;

/**
 * t('dashboard_recentExpenses') · t('dashboard_results', { n: 5 }).
 * Lee el store real (funciona con y sin Provider).
 */
export function useTranslation() {
  const setting = useSyncExternalStore(
    store.subscribe,
    () => store.getState().settings.language ?? 'system',
    () => 'system',
  );
  const lang = resolveLang(setting === 'system' ? undefined : setting);
  const t = useCallback(
    (key: StringKey, vars?: Vars): string => {
      const dict = STRINGS[lang] ?? STRINGS.es;
      let s = (dict[key] ?? STRINGS.es[key]) as unknown;
      if (typeof s !== 'string') return String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = (s as string).replace(`{${k}}`, String(v));
      }
      return s as string;
    },
    [lang],
  );
  const ta = useCallback(
    (key: StringKey): string[] => {
      const dict = STRINGS[lang] ?? STRINGS.es;
      const v = (dict[key] ?? STRINGS.es[key]) as unknown;
      return Array.isArray(v) ? [...v] : [];
    },
    [lang],
  );
  return { t, ta, lang };
}
