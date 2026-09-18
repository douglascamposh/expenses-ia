import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, Fonts } from '@/constants/theme';
import type { ThemeColor } from '@/constants/theme';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'small' | 'smallBold' | 'caption' | 'code' | 'title' | 'subtitle' | 'display' | 'hero' | 'default' | 'link' | 'linkPrimary';
export type TextColor = ThemeColor | 'white' | 'primary' | 'danger' | 'success' | 'warning';

type Props = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  /** legacy alias for variant */
  type?: TextVariant;
  themeColor?: ThemeColor;
};

const variantMap: Record<TextVariant, TextStyle> = {
  h1:      { fontSize: 34, lineHeight: 40, fontWeight: '800', fontFamily: Fonts.sans, letterSpacing: -0.5 },
  title:   { fontSize: 28, lineHeight: 34, fontWeight: '700', fontFamily: Fonts.sans, letterSpacing: -0.3 },
  h2:      { fontSize: 22, lineHeight: 28, fontWeight: '700', fontFamily: Fonts.sans, letterSpacing: -0.2 },
  subtitle:{ fontSize: 20, lineHeight: 26, fontWeight: '600', fontFamily: Fonts.sans, letterSpacing: -0.2 },
  h3:      { fontSize: 17, lineHeight: 24, fontWeight: '600', fontFamily: Fonts.sans },
  display: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, letterSpacing: -0.5 },
  hero:    { fontSize: 56, lineHeight: 64, fontWeight: '800', fontFamily: Fonts.sans, letterSpacing: -1 },
  body:    { fontSize: 17, lineHeight: 24, fontWeight: '400', fontFamily: Fonts.sans },
  default: { fontSize: 17, lineHeight: 24, fontWeight: '400', fontFamily: Fonts.sans },
  bodyBold:{ fontSize: 17, lineHeight: 24, fontWeight: '700', fontFamily: Fonts.sans },
  small:   { fontSize: 15, lineHeight: 20, fontWeight: '400', fontFamily: Fonts.sans },
  smallBold:{ fontSize: 15, lineHeight: 20, fontWeight: '700', fontFamily: Fonts.sans },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: Fonts.sans },
  code:    { fontSize: 13, fontWeight: '500', fontFamily: Fonts.mono },
  link:    { fontSize: 17, lineHeight: 24, fontWeight: '400', fontFamily: Fonts.sans },
  linkPrimary: { fontSize: 17, lineHeight: 24, fontWeight: '400', fontFamily: Fonts.sans },
};

const colorMap: Record<string, string> = {
  // Los colores del tema (primary, danger…) se resuelven contra el esquema
  // activo arriba; aquí solo quedan los intencionalmente fijos.
  white: '#FFFFFF',
};

export function Text({ variant, type, color, themeColor, weight, align, style, children, ...rest }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const v = variant ?? type ?? 'body';
  const base = variantMap[v] ?? variantMap.body;

  let resolvedColor: string | undefined;
  const colorKey = (color ?? themeColor) as string | undefined;
  if (colorKey) {
    if (colorKey in colors) resolvedColor = (colors as Record<string, string>)[colorKey];
    else if (colorKey in colorMap) resolvedColor = colorMap[colorKey];
    else resolvedColor = colorKey;
  } else {
    // default text color; linkPrimary uses primary
    resolvedColor = v === 'linkPrimary' ? colors.primary : colors.text;
  }

  // linkPrimary overrides if not explicitly colored
  if (v === 'linkPrimary' && !color && !themeColor) resolvedColor = colors.primary;

  return (
    <RNText
      {...rest}
      style={[
        base as TextStyle,
        resolvedColor ? { color: resolvedColor } : undefined,
        weight ? { fontWeight: weight } : undefined,
        align ? { textAlign: align } : undefined,
        v === 'code' ? { fontFamily: Fonts.mono } : undefined,
        style as unknown as TextStyle,
      ].filter(Boolean) as TextStyle[]}
    >
      {children}
    </RNText>
  );
}
