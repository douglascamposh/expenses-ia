import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useColorScheme } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import type { ThemeColor } from '@/constants/theme';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'small' | 'smallBold' | 'caption' | 'code' | 'title' | 'subtitle' | 'default' | 'link' | 'linkPrimary';
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
  h1: { fontSize: 28, lineHeight: 32, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800' },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  subtitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  h3: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  default: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  bodyBold: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  code: { fontSize: 12, fontWeight: PlatformOSWeight(), fontFamily: Fonts.mono },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  linkPrimary: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
};

function PlatformOSWeight(): TextStyle['fontWeight'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native');
  return Platform.OS === 'android' ? '700' : '500';
}

const colorMap: Record<string, string> = {
  white: '#FFFFFF',
  primary: '#2F80FF',
  danger: '#EF4444',
  success: '#0EB07B',
  warning: '#F59E0B',
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
