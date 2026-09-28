import { useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, ChevronLeft, Crown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { formatProDate, usePro } from '@/hooks/use-pro';

const PROS: { emoji: string; titleKey: 'pro_backupTitle' | 'pro_aiTitle' | 'pro_voiceTitle'; descKey: 'pro_backupDesc' | 'pro_aiDesc' | 'pro_voiceDesc'; testID: string }[] = [
  { emoji: '☁️', titleKey: 'pro_backupTitle', descKey: 'pro_backupDesc', testID: 'pro-benefit-backup' },
  { emoji: '✨', titleKey: 'pro_aiTitle', descKey: 'pro_aiDesc', testID: 'pro-benefit-ai' },
  { emoji: '🎙️', titleKey: 'pro_voiceTitle', descKey: 'pro_voiceDesc', testID: 'pro-benefit-voice' },
];

/**
 * Pantalla Pro: hero en gradiente, beneficios con entrada animada y compra
 * vía RevenueCat (modo prueba: usa productos sandbox hasta configurar las tiendas).
 */
export default function ProScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const pro = usePro();

  useEffect(() => {
    if (pro.error) {
      Alert.alert(t('pro_title'), pro.error);
      pro.clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pro.error]);

  const onSubscribe = async () => {
    const ok = await pro.purchase();
    if (ok) Alert.alert(t('pro_purchasedTitle'), t('pro_purchasedMsg'));
  };

  const onRestore = async () => {
    const active = await pro.restore();
    Alert.alert(t('pro_title'), active ? t('pro_restoredMsg') : t('pro_nothingToRestore'));
  };

  const ctaLabel = pro.isPro
    ? t('pro_active')
    : pro.price
      ? `${t('pro_cta')} · ${pro.price}${t('pro_perMonth')}`
      : t('pro_cta');

  const statusLines: string[] = [];
  if (pro.proDetails.isPro) {
    if (pro.proDetails.period === 'lifetime' || !pro.proDetails.expirationDate) {
      statusLines.push(t('pro_lifetime'));
    } else {
      const date = formatProDate(pro.proDetails.expirationDate, lang);
      statusLines.push(t('pro_subscribedUntil', { date }));
      if (pro.proDetails.period) statusLines.push(t('pro_renewsOn', { date }));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('settings_a11yBack')} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ChevronLeft size={22} color={theme.text} />
            </Pressable>
          </View>

          {statusLines.length > 0 && (
            <View
              testID="pro-status-banner"
              style={[styles.statusBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
            >
              <BadgeCheck size={22} color="#7C3AED" />
              <View style={styles.statusTexts}>
                {statusLines.map((line) => (
                  <Text key={line} variant="smallBold">{line}</Text>
                ))}
              </View>
            </View>
          )}

          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <Crown size={40} color="#FFFFFF" />
            </View>
            <Text variant="h1" align="center" style={styles.heroTitle}>{t('pro_title')}</Text>
            <Text variant="small" align="center" style={styles.heroSub}>{t('pro_subtitle')}</Text>
          </LinearGradient>

          <View style={styles.pros}>
            {PROS.map((p, i) => (
              <Animated.View
                key={p.testID}
                testID={p.testID}
                entering={FadeInUp.delay(i * 90).duration(350)}
                style={[styles.proCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              >
                <View style={styles.proEmojiWrap}>
                  <Text style={styles.proEmoji}>{p.emoji}</Text>
                </View>
                <View style={styles.proTexts}>
                  <Text variant="smallBold">{t(p.titleKey)}</Text>
                  <Text variant="small" color="textSecondary">{t(p.descKey)}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pro_cta')}
            onPress={() => void onSubscribe()}
            disabled={pro.busy}
            testID="pro-subscribe-btn"
            style={[styles.ctaWrap, pro.busy && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {pro.busy
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text variant="smallBold" style={styles.ctaLabel}>{ctaLabel}</Text>}
            </LinearGradient>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pro_restore')}
            onPress={() => void onRestore()}
            disabled={pro.busy}
            testID="pro-restore-btn"
          >
            <Text variant="small" color="textSecondary" align="center">{t('pro_restore')}</Text>
          </Pressable>
          <Text variant="caption" color="textSecondary" align="center">{t('pro_testNote')}</Text>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: '#FFFFFF' },
  heroSub: { color: 'rgba(255,255,255,0.85)' },
  statusBanner: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  statusTexts: { flex: 1, gap: 2 },
  pros: { gap: Spacing.two },
  proCard: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  proEmojiWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  proEmoji: { fontSize: 30, lineHeight: 38 },
  proTexts: { flex: 1, gap: 2 },
  ctaWrap: { borderRadius: 999 },
  ctaDisabled: { opacity: 0.6 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaLabel: { color: '#FFFFFF' },
});
