import { ScrollView, StyleSheet } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LocalAITestScreen } from '@/screens/LocalAITestScreen';
import { getApiBaseUrl } from '@/services/expense-api';
import { getBillingBaseUrl } from '@/services/billing';

/** Proyecto Firebase embebido en este build (dev vs QA se ven iguales si no). */
function firebaseProjectId(): string {
  try {
    return getApp().options.projectId ?? '?';
  } catch {
    return 'n/a';
  }
}

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
          <ThemedText type="smallBold">Ambiente</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            • Firebase: {firebaseProjectId()}
            • API: {getApiBaseUrl()}
            • Billing/Sync: {getBillingBaseUrl()}
          </ThemedText>
        </ThemedView>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Notas</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            • Audio: m4a 44.1kHz mono 128kbps (HIGH_QUALITY optimizado para API)
            • API: https://expense-audio-analyzer.ai.studio/api/analyze
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
