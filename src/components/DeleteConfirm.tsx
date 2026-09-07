import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { AlertModal } from '@/components/ui/Modal';

export function DeleteConfirm({ visible, onCancel, onDelete }: { visible: boolean; onCancel: () => void; onDelete: () => void }) {
  return (
    <AlertModal
      visible={visible}
      icon={<View style={styles.iconWrap}><Text style={styles.icon}>🗑</Text></View>}
      title="Delete expense?"
      description="This expense will be removed."
      primaryLabel="Delete"
      secondaryLabel="Cancel"
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
