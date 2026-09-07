import type { TextProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { Text as UIText, type TextVariant, type TextColor } from '@/components/ui/Text';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// deprecated alias — forwards to generic Text for design-system consistency
export function ThemedText({ type = 'default', themeColor, style, ...rest }: ThemedTextProps) {
  const variantMap: Record<string, TextVariant> = {
    default: 'body',
    title: 'h1',
    subtitle: 'h2',
    small: 'small',
    smallBold: 'smallBold',
    link: 'small',
    linkPrimary: 'small',
    code: 'code',
  };
  const color: TextColor | undefined = themeColor ?? (type === 'linkPrimary' ? 'primary' : undefined);
  return <UIText variant={variantMap[type] ?? 'body'} color={color} style={style} {...rest} />;
}
