import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { XCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Fonts, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  visible: boolean;
  message: string;
  /** error = icono rojo (mockup), info = icono oscuro */
  tone?: 'error' | 'info';
  /** Emoji en círculo en vez del icono (p. ej. categoría recién creada). */
  emoji?: string;
  durationMs?: number;
  onDismiss: () => void;
};

/** Toast inferior estilo mockup: tarjeta + icono/emoji + mensaje, entra animado, auto-cierre. */
export function Toast({ visible, message, tone = 'error', emoji, durationMs = 2800, onDismiss }: Props) {
  const theme = useTheme();
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={message}
        onPress={onDismiss}
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(150)}
        style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      >
        {emoji ? (
          <View style={[styles.emojiCircle, { backgroundColor: theme.backgroundSelected }]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
        ) : (
          <XCircle size={28} color={tone === 'error' ? theme.expense : theme.dark} />
        )}
        <Text variant="smallBold" style={[styles.message, { color: theme.text }]} numberOfLines={3}>
          {message}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    zIndex: 50,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  message: { flex: 1, fontSize: 16, fontFamily: Fonts.sans },
  emojiCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26, lineHeight: 32 },
});
