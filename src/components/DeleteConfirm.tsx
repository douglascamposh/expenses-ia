import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { AlertModal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onDelete: () => void;
  /** Texto contextual: si no se pasa, usa el genérico de i18n. */
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function DeleteConfirm({
  visible,
  onCancel,
  onDelete,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <AlertModal
      visible={visible}
      icon={<View style={[styles.iconWrap, { backgroundColor: theme.dangerBg }]}><Text style={styles.icon}>🗑</Text></View>}
      title={title ?? t('deleteConfirm_title')}
      description={description ?? t('deleteConfirm_desc')}
      primaryLabel={confirmLabel ?? t('deleteConfirm_delete')}
      secondaryLabel={cancelLabel ?? t('deleteConfirm_cancel')}
      onPrimary={onDelete}
      onSecondary={onCancel}
      variant="danger"
      onDismiss={onCancel}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
});
