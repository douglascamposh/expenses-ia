import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { Text } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import {
  APP_NAME,
  LAST_UPDATED_EN,
  LAST_UPDATED_ES,
  TERMS_EN,
  TERMS_ES,
} from '@/legal/terms';

/** Términos y Condiciones (documento informativo, no asesoría legal). */
export default function TermsScreen() {
  const router = useRouter();
  const { lang } = useTranslation();
  const theme = useTheme();
  const sections = lang === 'en' ? TERMS_EN : TERMS_ES;
  const updated = lang === 'en' ? LAST_UPDATED_EN : LAST_UPDATED_ES;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ChevronLeft size={22} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>{APP_NAME}</Text>
          </View>
          <Text variant="caption" color="textSecondary">
            {lang === 'en' ? `Terms and Conditions · Updated ${updated}` : `Términos y Condiciones · Actualizado ${updated}`}
          </Text>
          {sections.map((s) => (
            <View key={s.title} style={styles.section} testID="terms-section">
              <Text variant="smallBold">{s.title}</Text>
              {s.body.map((p, i) => (
                <Text key={i} variant="small" color="textSecondary" style={styles.paragraph}>{p}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', fontFamily: Fonts.sans, flex: 1 },
  section: { gap: 6 },
  paragraph: { lineHeight: 22 },
});
