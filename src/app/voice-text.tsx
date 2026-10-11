import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import { Check, Mic, X } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useSpeechTranscript } from '@/hooks/use-speech-transcript';
import { useAnalyzeAudio } from '@/hooks/use-analyze-audio';
import { useTranslation } from '@/i18n/useTranslation';
import { isServiceUnavailable } from '@/services/expense-api';
import { setVoiceTranscript } from '@/services/voice-draft';
import { flagForSpeech } from '@/services/voice-locale';
import { getAllCategories, resolveCategoryId } from '@/expenses/categories/expenseCategories';
import { isValidCurrency, isValidKind, isValidPaymentMethod, type NewExpense } from '@/expenses/models/Expense';
import { validateExpenseCommand } from '@/expenses/services/ExpenseService';
import { todayLocalISO } from '@/expenses/utils/format';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setPendingQueue } from '@/store/expensesSlice';
import { useTheme } from '@/hooks/use-theme';

/**
 * Dictado por micrófono: fondo nocturno violeta, micrófono con respiración
 * suave mientras escucha, bandera de idioma, texto gigante en vivo con
 * auto-scroll, X cancela, ✓ guarda en memoria.
 */
export default function VoiceTextScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const { status, transcript, locale, error, start, stop, abort } = useSpeechTranscript(lang);
  const analyzer = useAnalyzeAudio();
  const [sendError, setSendError] = useState<string | null>(null);
  const flag = flagForSpeech(locale, lang);

  useEffect(() => {
    // PoC: auto-inicio al abrir (el gesto fue el mic del inicio).
    void start();
  }, [start]);

  const close = () => {
    abort();
    router.back();
  };

  const normalizeCurrency = (c: unknown): NewExpense['currency'] =>
    typeof c === 'string' && isValidCurrency(c) ? c : defaultCurrency;

  /** ✓ envía el texto a /api/analyze-text y deja los gastos en revisión. */
  const confirm = async () => {
    const text = transcript.trim();
    if (text.length === 0 || analyzer.isLoading) return;
    stop();
    setVoiceTranscript(text);
    setSendError(null);
    try {
      const userCats = getAllCategories().map((c) => ({ id: String(c.id), label: c.label, kind: c.kind }));
      const result = await analyzer.analyzeText(text, userCats);
      const queue: NewExpense[] = [];
      for (const rawObj of result.expenses ?? []) {
        const resolved = resolveCategoryId(rawObj.category);
        const rawKind = rawObj.kind;
        const rawMethod = rawObj.paymentMethod;
        const cmd = {
          action: 'CREATE_EXPENSE',
          expense: {
            amount: Number(rawObj.amount),
            currency: normalizeCurrency(rawObj.currency),
            category: resolved,
            kind: isValidKind(rawKind) ? rawKind : 'EXPENSE',
            description: String(rawObj.description || 'Gasto'),
            date: String(rawObj.date || todayLocalISO()),
            paymentMethod: isValidPaymentMethod(String(rawMethod || 'CASH')) ? String(rawMethod) : 'CASH',
            confidence: rawObj.confidence as number | undefined,
          },
        };
        const v = validateExpenseCommand(cmd);
        if (v.valid && v.normalized) queue.push(v.normalized);
        else
          queue.push({
            amount: Number(rawObj.amount) || 0,
            currency: normalizeCurrency(rawObj.currency),
            category: resolveCategoryId(rawObj.category) as NewExpense['category'],
            kind: 'EXPENSE',
            description: String(rawObj.description || ''),
            date: String(rawObj.date || todayLocalISO()),
            paymentMethod: 'CASH',
          });
      }
      if (queue.length === 0) {
        setSendError(t('voicetext_noMatch'));
        return;
      }
      dispatch(setPendingQueue(queue));
      router.back();
    } catch (e) {
      // Servicio saturado (503/alta demanda): mensaje amable en vez del error crudo.
      setSendError(isServiceUnavailable(e) ? t('common_serviceUnavailable') : ((e as Error).message ?? t('voicetext_error')));
    }
  };

  const hint =
    sendError ??
    (status === 'error'
      ? error === 'permission'
        ? t('voicetext_needPermission')
        : error === 'no-speech'
          ? t('voicetext_noSpeech')
          : t('voicetext_error')
      : null);

  const words = transcript.split(/\s+/).filter(Boolean);
  const listening = status === 'listening' || status === 'starting';
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll al final mientras se dicta (textos largos).
  useEffect(() => {
    if (words.length > 0) scrollRef.current?.scrollToEnd?.({ animated: true });
  }, [words.length]);

  return (
    <LinearGradient colors={['#101A3A', '#4C1D95', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bg}>
      {listening && <KeepAwakeWhileListening />}
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <View style={styles.spacer} />
          <View style={styles.flagCircle}>
            <Text style={styles.flag}>{flag}</Text>
          </View>
        </View>
        <View style={styles.visual} testID="voice-visual">
          <View style={styles.orbWrap}>
            {listening && <PulseRing delay={0} />}
            {listening && <PulseRing delay={700} />}
            <MicOrb listening={listening} />
          </View>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.textWrap}
          showsVerticalScrollIndicator={false}
        >
          {words.length > 0 ? (
            <View style={styles.wordsRow}>
              {words.map((word, i) => (
                <Animated.Text key={i} entering={FadeInUp.duration(220)} style={styles.word}>
                  {word}{i < words.length - 1 ? ' ' : ''}
                </Animated.Text>
              ))}
            </View>
          ) : (
            <Text style={[styles.transcript, styles.placeholder]}>{t('voicetext_hint')}</Text>
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
            disabled={analyzer.isLoading}
            style={[styles.confirmBtn, { backgroundColor: theme.expense }, analyzer.isLoading && { opacity: 0.6 }]}
          >
            {analyzer.isLoading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <Check size={30} color="#FFFFFF" strokeWidth={3} />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * Mantiene la pantalla encendida solo mientras se dicta (Android apaga
 * la pantalla por timeout aunque el reconocimiento siga activo).
 * Al desmontarse (stop/confirmar/salir) se libera automáticamente.
 */
function KeepAwakeWhileListening() {
  useKeepAwake('voice-dictation');
  return <View testID="keep-awake-active" style={styles.keepAwake} />;
}

/** Micrófono compacto con respiración suave mientras escucha. */
function MicOrb({ listening }: { listening: boolean }) {
  const breath = useSharedValue(1);
  useEffect(() => {
    if (!listening) {
      breath.value = 1;
      return;
    }
    breath.value = withRepeat(
      withTiming(1.12, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [listening, breath]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));
  return (
    <Animated.View style={[styles.orb, style]}>
      <Mic size={26} color="#FFFFFF" />
    </Animated.View>
  );
}

/** Anillo expansivo alrededor del mic (solo montado mientras escucha). */
function PulseRing({ delay }: { delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 1.1 }],
    opacity: 0.45 * (1 - progress.value),
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  keepAwake: { width: 0, height: 0 },
  safe: { flex: 1, padding: Spacing.four },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  flagCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  flag: { fontSize: 22 },
  visual: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.two },
  orbWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E9D5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 18, elevation: 8,
  },
  ring: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  textWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.six },
  transcript: {
    fontSize: 34, lineHeight: 44, fontWeight: '800', fontFamily: Fonts.sans,
    color: '#FFFFFF', textAlign: 'center',
  },
  placeholder: { opacity: 0.75 },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  word: {
    fontSize: 34, lineHeight: 44, fontWeight: '800', fontFamily: Fonts.sans,
    color: '#FFFFFF',
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
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
});
