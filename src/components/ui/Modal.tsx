import { Modal as RNModal, Pressable, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Text } from './Text';
import { Button } from './Button';

export type ModalVariant = 'center' | 'bottomSheet' | 'fullscreen' | 'alert';

type Props = {
  visible: boolean;
  variant?: ModalVariant;
  animation?: 'fade' | 'slide' | 'none';
  overlayOpacity?: number;
  showHandle?: boolean;
  dismissOnOverlayPress?: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
  testID?: string;
};

/**
 * Generic Modal - unifies 5 patterns:
 * - center (ExpenseConfirmation)
 * - bottomSheet (ExpenseBatch)
 * - fullscreen (Recording)
 * - alert (DeleteConfirm 1-2 botones)
 */
export function Modal({ visible, variant = 'center', animation = 'fade', overlayOpacity = 0.4, showHandle, dismissOnOverlayPress = true, onDismiss, children }: Props) {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const overlayBg = `rgba(15,23,42,${overlayOpacity})`;

  if (variant === 'fullscreen') {
    return (
      <RNModal visible={visible} animationType={animation === 'none' ? 'none' : animation} transparent statusBarTranslucent onRequestClose={onDismiss}>
        <View
          style={[
            styles.fullscreen,
            {
              backgroundColor: colors.background,
              // Header (flecha Volver) fuera del notch/status bar
              paddingTop: Math.max(insets.top, Spacing.two),
              // El footer no debe quedar bajo los botones virtuales de Android
              paddingBottom: Math.max(insets.bottom, Spacing.four),
            },
          ]}
        >
          {children}
        </View>
      </RNModal>
    );
  }

  const isBottom = variant === 'bottomSheet';

  // Backdrop y tarjeta como HERMANOS (no anidados): un toque dentro de la
  // tarjeta nunca puede llegar al backdrop y cerrar el modal por accidente.
  // El patrón anterior (Pressable dentro de Pressable + stopPropagation) fallaba
  // en dispositivo real: pulsar botones internos descartaba el modal.
  return (
    <RNModal visible={visible} animationType={animation === 'none' ? 'none' : animation} transparent statusBarTranslucent onRequestClose={onDismiss}>
      <View style={[
        styles.overlay,
        isBottom
          // Sheet a borde de pantalla como el mockup (sin margen lateral)
          ? { paddingHorizontal: 0, paddingBottom: 0, paddingTop: Spacing.four }
          : { padding: Spacing.four },
        { backgroundColor: overlayBg, justifyContent: isBottom ? 'flex-end' : 'center' },
      ]}>
        {dismissOnOverlayPress && (
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onDismiss}
          />
        )}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={isBottom ? styles.sheetWrapper : styles.centerWrapper}
          pointerEvents="box-none"
        >
          <View
            style={[
              isBottom ? styles.sheet : variant === 'alert' ? styles.alertCard : styles.centerCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              // El contenido no queda bajo los botones virtuales de Android
              isBottom ? { paddingBottom: Math.max(insets.bottom, Spacing.four) } : undefined,
            ]}
          >
            {showHandle && isBottom && <View style={styles.handle} />}
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </RNModal>
  );
}

type AlertProps = {
  visible: boolean;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  variant?: 'danger' | 'primary';
  onDismiss?: () => void;
};

export function AlertModal({ visible, icon, title, description, primaryLabel = 'Confirm', secondaryLabel = 'Cancel', onPrimary, onSecondary, variant = 'danger', onDismiss }: AlertProps) {
  return (
    <Modal visible={visible} variant="alert" animation="fade" overlayOpacity={0.45} onDismiss={onDismiss}>
      <View style={styles.alertContent}>
        {icon && <View style={styles.alertIcon}>{icon}</View>}
        <Text variant="smallBold" align="center">{title}</Text>
        {description && <Text variant="small" color="textSecondary" align="center">{description}</Text>}
        <View style={styles.alertActions}>
          {onSecondary && <Button variant="neutral" size="md" style={{ flex: 1 }} onPress={onSecondary ?? (() => {})}>{secondaryLabel}</Button>}
          {onPrimary && <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="md" style={{ flex: 1 }} onPress={onPrimary}>{primaryLabel}</Button>}
          {!onSecondary && !onPrimary && secondaryLabel && <Button variant="neutral" size="md" style={{ flex: 1 }} onPress={onDismiss ?? (() => {})}>{secondaryLabel}</Button>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: Spacing.four },
  centerWrapper: { width: '100%' },
  sheetWrapper: { maxHeight: '88%' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderBottomWidth: 0, maxHeight: '100%', overflow: 'hidden' },
  centerCard: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two, borderWidth: 1, alignItems: 'center', shadowColor: 'rgba(45,125,255,0.12)', shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  alertCard: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two, borderWidth: 1, alignItems: 'center', maxWidth: 340, alignSelf: 'center', width: '100%' },
  alertContent: { gap: Spacing.two, alignItems: 'center', width: '100%' },
  alertIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  alertActions: { flexDirection: 'row', gap: Spacing.three, width: '100%', marginTop: Spacing.two },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E4E2DE', alignSelf: 'center', marginBottom: Spacing.two },
  fullscreen: { flex: 1, padding: Spacing.four },
});
