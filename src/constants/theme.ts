/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F4F3F1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EAE8E4',
    textSecondary: '#64748B',
    primary: '#2F80FF',
    primaryDark: '#1A5ECC',
    border: '#E4E2DE',
    success: '#0EB07B',
    warning: '#F59E0B',
    danger: '#EF4444',
    cardShadow: 'rgba(45,125,255,0.08)',
    /** Blanco intencional (texto/iconos sobre color). */
    white: '#FFFFFF',
    /** Plomo oscuro del mockup (checks de guardado, botones dark). */
    dark: '#2B2B2B',
    /** Verde de ingresos. */
    income: '#5A9E4B',
    /** Rojo de gastos. */
    expense: '#F0524D',
    /** Rojo suave (bordes danger). */
    dangerSoft: '#FECACA',
    /** Fondo suave danger (iconos). */
    dangerBg: '#FEE2E2',
    /** Acentos informativos (tarjeta analítica). */
    info: '#2F80FF',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
    infoDeep: '#DBEAFE',
    gold: '#B45309',
    goldBg: '#FEF3C7',
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#334155',
    textSecondary: '#94A3B8',
    primary: '#3B8DFF',
    primaryDark: '#2563EB',
    border: '#334155',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    cardShadow: 'rgba(0,0,0,0.3)',
    white: '#FFFFFF',
    dark: '#2B2B2B',
    income: '#5A9E4B',
    expense: '#F0524D',
    dangerSoft: '#FECACA',
    dangerBg: '#FEE2E2',
    info: '#3B8DFF',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
    infoDeep: '#DBEAFE',
    gold: '#B45309',
    goldBg: '#FEF3C7',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** San Francisco (system default) */
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    /** Roboto (system default) */
    sans: 'system-ui',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  default: {
    sans: 'system-ui, -apple-system, Roboto, "Segoe UI", sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  web: {
    /** System fonts for consistency with native */
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    rounded: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
