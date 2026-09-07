import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function EmptyState() {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.illustration}>
        <Text style={styles.doc}>📄</Text>
        <View style={styles.leafLeft} />
        <View style={styles.leafRight} />
      </View>
      <Text variant="smallBold" style={styles.title}>No expenses yet</Text>
      <Text variant="small" color="textSecondary" style={styles.subtitle}>Start tracking your spending easily.</Text>
      <ThemedView style={styles.quote}>
        <Text variant="small" color="textSecondary" style={styles.quoteText}>&quot;I spent 35 bolivianos on lunch&quot;</Text>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2' },
  illustration: { width: 100, height: 80, alignItems: 'center', justifyContent: 'center' },
  doc: { fontSize: 48, opacity: 0.9 },
  leafLeft: { position: 'absolute', left: 10, bottom: 10, width: 20, height: 30, borderRadius: 10, backgroundColor: '#C7D6FF', opacity: 0.5 },
  leafRight: { position: 'absolute', right: 10, bottom: 15, width: 16, height: 24, borderRadius: 8, backgroundColor: '#A8C0FF', opacity: 0.5 },
  title: { color: '#0F172A' },
  subtitle: { textAlign: 'center' },
  quote: { marginTop: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E6E9F2' },
  quoteText: { fontStyle: 'italic', textAlign: 'center' },
});
