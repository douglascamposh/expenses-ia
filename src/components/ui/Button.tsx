import { ActivityIndicator, Pressable, type PressableProps, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, Radius } from '@/constants/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'ghost' | 'neutral' | 'danger' | 'dangerOutline';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  style?: PressableProps['style'];
  textStyle?: object;
};

const sizeMap: Record<ButtonSize, { py: number; px: number; fontSize: number }> = {
  sm: { py: 10, px: 16, fontSize: 14 },
  md: { py: 14, px: 24, fontSize: 14 },
  lg: { py: 16, px: 28, fontSize: 16 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  icon: Icon,
  iconPosition = 'left',
  children,
  style,
  textStyle,
  ...rest
}: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const s = sizeMap[size];

  const variantStyle = (() => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primary, border: colors.primary, text: '#FFFFFF' };
      case 'ghost':
        return { bg: 'transparent', border: colors.primary, text: colors.primary };
      case 'neutral':
        return { bg: colors.backgroundSelected, border: colors.border, text: colors.textSecondary };
      case 'danger':
        return { bg: colors.danger, border: colors.danger, text: '#FFFFFF' };
      case 'dangerOutline':
        return { bg: 'transparent', border: '#FECACA', text: colors.danger };
      default:
        return { bg: colors.primary, border: colors.primary, text: '#FFFFFF' };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={!!isDisabled}
      style={(state) => {
        const base = {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: 8,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: variantStyle.border,
          backgroundColor: variantStyle.bg,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
          // No emitir la clave `transform` cuando no hay presión: en __DEV__
          // RN valida transforms con `transform.forEach` y un valor null
          // revienta el render con "Cannot read property 'forEach' of null".
          ...(state.pressed && !isDisabled ? { transform: [{ scale: 0.98 }] } : null),
          alignSelf: (fullWidth ? 'stretch' : 'auto') as 'stretch' | 'auto',
        };
        const extra = typeof style === 'function' ? (style as (s: { pressed: boolean }) => unknown)(state) : (style as unknown);
        if (!extra) return base;
        // RN handles array styles; return array to allow flex override via style prop
        return [base, extra] as never;
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={16} color={variantStyle.text} />}
          <Text variant="smallBold" style={{ color: variantStyle.text, ...(textStyle as object) }}>{children}</Text>
          {Icon && iconPosition === 'right' && <Icon size={16} color={variantStyle.text} />}
        </>
      )}
    </Pressable>
  );
}

export const buttonStyles = StyleSheet.create({});
