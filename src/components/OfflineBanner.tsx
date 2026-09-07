import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export function OfflineBanner({ onClose }: { onClose?: () => void }) {
  return (
    <View style={styles.banner}>
      <View style={styles.icon}>
        <Text>📡</Text>
      </View>
      <View style={styles.texts}>
        <Text variant="smallBold" style={styles.title}>No internet connection.</Text>
        <Text variant="small" style={styles.subtitle}>Your saved expenses are still available.</Text>
      </View>
      {onClose && (
        <Pressable onPress={onClose} style={styles.close}>
          <Text color="textSecondary">✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  title: { color: '#92400E', fontSize: 13 },
  subtitle: { color: '#92400E', fontSize: 12 },
  close: { padding: 6 },
});
