import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LocalAITestScreen } from '@/screens/LocalAITestScreen';

export default function DiagnosticsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Diagnostics</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Métricas técnicas del POC (no visibles en Dashboard)
        </ThemedText>
        <LocalAITestScreen />
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Notas</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            • Audio: m4a 44.1kHz mono 128kbps (HIGH_QUALITY optimizado para API)
            • API: https://expense-audio-analyzer-571414320359.us-east1.run.app/api/analyze
            • DB: SQLite v1, tabla expenses, WAL
            • Offline: Dashboard y SQLite funcionan sin Internet; API requiere red
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60 },
  card: { padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, borderColor: '#E0E1E6', gap: Spacing.two },
});
