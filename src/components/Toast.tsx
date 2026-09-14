import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { XCircle } from 'lucide-react-native';
import { Fonts, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui';

type Props = {
  visible: boolean;
  message: string;
  /** error = icono rojo (mockup), info = icono oscuro */
  tone?: 'error' | 'info';
  durationMs?: number;
  onDismiss: () => void;
};

/** Toast inferior estilo mockup: tarjeta blanca + icono + mensaje, auto-cierre. */
export function Toast({ visible, message, tone = 'error', durationMs = 2800, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={message}
        onPress={onDismiss}
        style={styles.card}
      >
        <XCircle size={28} color={tone === 'error' ? '#F0524D' : '#2B2B2B'} />
        <Text variant="smallBold" style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      </Pressable>
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
    padding: Spacing.three,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  message: { flex: 1, fontSize: 16, fontFamily: Fonts.sans, color: '#111111' },
});
