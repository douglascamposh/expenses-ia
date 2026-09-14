import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { AlertModal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/useTranslation';

export function DeleteConfirm({ visible, onCancel, onDelete }: { visible: boolean; onCancel: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <AlertModal
      visible={visible}
      icon={<View style={styles.iconWrap}><Text style={styles.icon}>🗑</Text></View>}
      title={t('deleteConfirm_title')}
      description={t('deleteConfirm_desc')}
      primaryLabel={t('deleteConfirm_delete')}
      secondaryLabel={t('deleteConfirm_cancel')}
      onPrimary={onDelete}
      onSecondary={onCancel}
      variant="danger"
      onDismiss={onCancel}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
});
