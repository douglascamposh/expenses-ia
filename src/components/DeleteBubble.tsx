import { Pressable, StyleSheet, View } from 'react-native';
import { Fonts, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui';
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
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('deleteBubble_a11yCancel')}
        onPress={onCancel}
        style={styles.backdrop}
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
            <Text variant="smallBold" style={styles.confirmText}>{t('deleteBubble_confirm')}</Text>
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
    backgroundColor: 'rgba(245,245,244,0.75)',
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
  confirmText: { color: '#F0524D' },
  tail: {
    width: 22,
    height: 22,
    marginTop: -11,
    transform: [{ rotate: '45deg' }],
  },
});
