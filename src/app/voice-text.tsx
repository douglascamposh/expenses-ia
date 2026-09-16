import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useSpeechTranscript } from '@/hooks/use-speech-transcript';
import { useTranslation } from '@/i18n/useTranslation';
import { setVoiceTranscript } from '@/services/voice-draft';
import { flagForRegion } from '@/services/voice-locale';

/**
 * PoC transcripción por micrófono (mockup texto): gradiente cálido,
 * bandera de idioma, texto gigante en vivo, X cancela, ✓ guarda en memoria.
 * El flujo viejo de grabación queda intacto.
 */
export default function VoiceTextScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { status, transcript, offline, locale, error, start, stop, abort } = useSpeechTranscript(lang);
  const region = (locale.split('-')[1] ?? '').toUpperCase();

  useEffect(() => {
    // PoC: auto-inicio al abrir (el gesto fue el mic del inicio).
    void start();
  }, [start]);

  const close = () => {
    abort();
    router.back();
  };

  const confirm = () => {
    stop();
    setVoiceTranscript(transcript.length > 0 ? transcript : null);
    router.back();
  };

  const hint =
    status === 'error'
      ? error === 'permission'
        ? t('voicetext_needPermission')
        : error === 'no-speech'
          ? t('voicetext_noSpeech')
          : t('voicetext_error')
      : null;

  return (
    <LinearGradient colors={['#E8825C', '#8E5B8E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <View style={styles.spacer} />
          <View style={styles.flagCircle}>
            <Text style={styles.flag}>{flagForRegion(region)}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.textWrap} showsVerticalScrollIndicator={false}>
          <Text style={styles.transcript}>
            {transcript.length > 0 ? transcript : t('voicetext_hint')}
          </Text>
          {offline && transcript.length > 0 && (
            <Text style={styles.offlineBadge}>{t('voicetext_offline')} · {locale}</Text>
          )}
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('voicetext_a11yCancel')}
            onPress={close}
            style={styles.cancelBtn}
          >
            <X size={26} color="#0F172A" />
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('voicetext_a11yConfirm')}
            onPress={confirm}
            style={styles.confirmBtn}
          >
            <Check size={30} color="#FFFFFF" strokeWidth={3} />
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1, padding: Spacing.four },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  flagCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  flag: { fontSize: 26 },
  textWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.six },
  transcript: {
    fontSize: 34, lineHeight: 44, fontWeight: '800', fontFamily: Fonts.sans,
    color: '#FFFFFF', textAlign: 'center',
  },
  offlineBadge: {
    marginTop: Spacing.three, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF',
    fontSize: 13, fontWeight: '700', fontFamily: Fonts.sans, overflow: 'hidden',
  },
  hint: {
    marginTop: Spacing.two, fontSize: 15, fontFamily: Fonts.sans,
    color: '#FFFFFF', textAlign: 'center', opacity: 0.9,
  },
  footer: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.two },
  cancelBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#F0524D',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
});
