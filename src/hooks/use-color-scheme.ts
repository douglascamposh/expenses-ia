/**
 * Scheme efectivo: respeta la preferencia del usuario (light/dark/system).
 * Lee el store directamente (sin Provider) para no romper renders sin store
 * como los tests de componentes sueltos.
 */
import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { store } from '@/store';
import type { ThemeModeSetting } from '@/store/settingsSlice';

function useThemeModeSetting(): ThemeModeSetting {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().settings.themeMode ?? 'system',
    () => 'system' as ThemeModeSetting,
  );
}

export function useColorScheme() {
  const mode = useThemeModeSetting();
  const system = useRNColorScheme();
  if (mode === 'light' || mode === 'dark') return mode;
  return system ?? 'light';
}
