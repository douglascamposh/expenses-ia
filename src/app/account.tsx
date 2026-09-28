import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, CloudUpload, LogIn, LogOut, Trash2, UserRound } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { Text } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { useGoogleLink } from '@/hooks/use-google-link';
import { formatProDate, usePro } from '@/hooks/use-pro';
import { runSync } from '@/services/sync';

/**
 * Pantalla Cuenta: hero en gradiente con estado, login con Google para
 * invitados y acciones de sesión/respaldo para vinculados.
 * El respaldo es real contra /api/sync (requiere Google vinculado; el
 * backend exige Pro y responde 403 si no lo es).
 */
export default function AccountScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const google = useGoogleLink();
  const pro = usePro();
  const googleEnabled = !google.linking;
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (google.error) {
      Alert.alert(t('settings_account'), google.error);
      google.clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.error]);

  const confirmSignOut = () => {
    Alert.alert(t('settings_signOut'), t('account_signOutMsg'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('settings_signOut'), onPress: () => void google.signOut() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(t('settings_deleteAccount'), t('account_deleteMsg'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('common_delete'), style: 'destructive', onPress: () => void google.removeAccount() },
    ]);
  };

  // Respaldo real contra /api/sync (requiere Google vinculado; el backend
  // exige Pro y responde 403 si no lo es).
  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await runSync();
      Alert.alert(t('settings_sync'), t('account_syncDone', { up: r.pushed, down: r.pulled }));
    } catch (e) {
      // 403 por campo (no instanceof: robusto ante serialización).
      const status = typeof e === 'object' && e !== null && 'status' in e
        ? (e as { status: unknown }).status
        : undefined;
      if (status === 403) {
        Alert.alert(t('account_proRequiredTitle'), t('account_proRequiredMsg'), [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('pro_cta'), onPress: () => router.push('/pro' as never) },
        ]);
        return;
      }
      Alert.alert(t('settings_sync'), t('account_syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const heroName = google.account
    ? (google.account.email ?? google.account.displayName ?? t('settings_account'))
    : t('settings_guest');
  const heroSub = google.account
    ? (google.account.email ? (google.account.displayName ?? '') : '')
    : t('account_guestDesc');

  const proStatus: string | null = (() => {
    const d = pro.proDetails;
    if (!d.isPro) return null;
    if (d.period === 'lifetime' || !d.expirationDate) return t('pro_lifetime');
    const date = formatProDate(d.expirationDate, lang);
    return `${t('pro_subscribedUntil', { date })} · ${t('pro_renewsOn', { date })}`;
  })();

  const actions = [
    { key: 'sync', icon: <CloudUpload size={22} color="#7C3AED" />, label: t('settings_sync'), onPress: syncNow, testID: 'account-sync', danger: false },
    { key: 'signout', icon: <LogOut size={22} color={theme.text} />, label: t('settings_signOut'), onPress: confirmSignOut, testID: 'account-signout', danger: false },
    { key: 'delete', icon: <Trash2 size={22} color="#EF4444" />, label: t('settings_deleteAccount'), onPress: confirmDelete, testID: 'account-delete', danger: true },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('settings_a11yBack')} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ChevronLeft size={22} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>{t('settings_account')}</Text>
          </View>

          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <UserRound size={36} color="#FFFFFF" />
            </View>
            <Text variant="h2" align="center" style={styles.heroTitle} testID="account-status">{heroName}</Text>
            {heroSub !== '' && (
              <Text variant="small" align="center" style={styles.heroSub}>{heroSub}</Text>
            )}
            {proStatus !== null && (
              <Text variant="caption" align="center" style={styles.heroPro} testID="account-pro-status">{proStatus}</Text>
            )}
          </LinearGradient>

          {google.account ? (
            <View style={styles.actions}>
              {actions.map((a, i) => (
                <Animated.View key={a.key} entering={FadeInUp.delay(i * 90).duration(350)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                    onPress={a.onPress}
                    testID={a.testID}
                    style={[
                      styles.actionCard,
                      { backgroundColor: theme.backgroundElement, borderColor: a.danger ? '#EF4444' : theme.border },
                    ]}
                  >
                    <View style={styles.actionIcon}>{a.icon}</View>
                    <Text variant="smallBold" style={a.danger ? styles.dangerText : undefined}>{a.label}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings_linkGoogle')}
                accessibilityState={{ disabled: !googleEnabled }}
                onPress={() => void google.link()}
                disabled={!googleEnabled}
                testID="account-link-google"
                style={[styles.ctaWrap, !googleEnabled && styles.ctaDisabled]}
              >
                <LinearGradient
                  colors={['#7C3AED', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {google.linking
                    ? <ActivityIndicator color="#FFFFFF" />
                    : (
                      <View style={styles.ctaInner}>
                        <LogIn size={20} color="#FFFFFF" />
                        <Text variant="smallBold" style={styles.ctaLabel}>{t('settings_linkGoogle')}</Text>
                      </View>
                    )}
                </LinearGradient>
              </Pressable>
              <Text variant="caption" color="textSecondary" align="center">{t('account_backupNote')}</Text>
            </>
          )}
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
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, flex: 1 },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: '#FFFFFF' },
  heroSub: { color: 'rgba(255,255,255,0.85)' },
  heroPro: { color: '#FFFFFF', fontWeight: '700' },
  actions: { gap: Spacing.two },
  actionCard: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  actionIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  dangerText: { color: '#EF4444' },
  ctaWrap: { borderRadius: 999 },
  ctaDisabled: { opacity: 0.6 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ctaLabel: { color: '#FFFFFF' },
});
