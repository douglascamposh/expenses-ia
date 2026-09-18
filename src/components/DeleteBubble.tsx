import { Pressable, StyleSheet, View } from 'react-native';
import { Fonts, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Bubble confirmar eliminación (mockup delete 2): backdrop + tarjeta con cola. */
export function DeleteBubble({ visible, description, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scheme = useColorScheme();
  // Velo temático: claro en light, oscuro en dark (antes fijo claro).
  const backdropColor = scheme === 'dark' ? 'rgba(15,23,42,0.6)' : 'rgba(245,245,244,0.75)';
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('deleteBubble_a11yCancel')}
        onPress={onCancel}
        style={[styles.backdrop, { backgroundColor: backdropColor }]}
      />
      <View style={styles.bubble} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Text variant="smallBold" style={[styles.message, { color: theme.text }]} numberOfLines={3}>
            {description ? t('deleteBubble_message', { desc: description }) : t('deleteBubble_messageFallback')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('deleteBubble_a11yConfirm')}
            onPress={onConfirm}
            style={({ pressed }) => [[styles.confirm, { backgroundColor: theme.backgroundSelected }], pressed && { opacity: 0.8 }]}
          >
            <Text variant="smallBold" style={[styles.confirmText, { color: theme.danger }]}>{t('deleteBubble_confirm')}</Text>
          </Pressable>
        </View>
        <View style={[styles.tail, { backgroundColor: theme.backgroundElement }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  bubble: {
    width: '82%',
    maxWidth: 340,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  message: { fontSize: 17, fontFamily: Fonts.sans },
  confirm: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: { fontSize: 17 },
  tail: {
    width: 22,
    height: 22,
    marginTop: -11,
    transform: [{ rotate: '45deg' }],
  },
});
