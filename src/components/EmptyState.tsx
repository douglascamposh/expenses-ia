import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.illustration}>
        <Text style={styles.doc}>📄</Text>
        <View style={styles.leafLeft} />
        <View style={styles.leafRight} />
      </View>
      <Text variant="smallBold" style={{ color: theme.text }}>{t('empty_title')}</Text>
      <Text variant="small" color="textSecondary" style={styles.subtitle}>{t('empty_subtitle')}</Text>
      <ThemedView style={[styles.quote, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        <Text variant="small" color="textSecondary" style={styles.quoteText}>{t('empty_voiceExample')}</Text>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1 },
  illustration: { width: 100, height: 80, alignItems: 'center', justifyContent: 'center' },
  doc: { fontSize: 48, opacity: 0.9 },
  leafLeft: { position: 'absolute', left: 10, bottom: 10, width: 20, height: 30, borderRadius: 10, backgroundColor: '#C7D6FF', opacity: 0.5 },
  leafRight: { position: 'absolute', right: 10, bottom: 15, width: 16, height: 24, borderRadius: 8, backgroundColor: '#A8C0FF', opacity: 0.5 },
  subtitle: { textAlign: 'center' },
  quote: { marginTop: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, borderWidth: 1 },
  quoteText: { fontStyle: 'italic', textAlign: 'center' },
});
