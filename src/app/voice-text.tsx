import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useSpeechTranscript } from '@/hooks/use-speech-transcript';
import { useAnalyzeAudio } from '@/hooks/use-analyze-audio';
import { useTranslation } from '@/i18n/useTranslation';
import { setVoiceTranscript } from '@/services/voice-draft';
import { flagForRegion } from '@/services/voice-locale';
import { getAllCategories, resolveCategoryId } from '@/expenses/categories/expenseCategories';
import { isValidCurrency, isValidKind, isValidPaymentMethod, type NewExpense } from '@/expenses/models/Expense';
import { validateExpenseCommand } from '@/expenses/services/ExpenseService';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setPendingQueue } from '@/store/expensesSlice';

/**
 * PoC transcripción por micrófono (mockup texto): gradiente cálido,
 * bandera de idioma, texto gigante en vivo, X cancela, ✓ guarda en memoria.
 * El flujo viejo de grabación queda intacto.
 */
export default function VoiceTextScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const dispatch = useAppDispatch();
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const { status, transcript, offline, locale, error, start, stop, abort } = useSpeechTranscript(lang);
  const analyzer = useAnalyzeAudio();
  const [sendError, setSendError] = useState<string | null>(null);
  const region = (locale.split('-')[1] ?? '').toUpperCase();

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
            date: String(rawObj.date || new Date().toISOString().split('T')[0]),
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
            date: String(rawObj.date || new Date().toISOString().split('T')[0]),
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
      setSendError((e as Error).message ?? t('voicetext_error'));
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
            disabled={analyzer.isLoading}
            style={[styles.confirmBtn, analyzer.isLoading && { opacity: 0.6 }]}
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
  placeholder: { opacity: 0.75 },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  word: {
    fontSize: 34, lineHeight: 44, fontWeight: '800', fontFamily: Fonts.sans,
    color: '#FFFFFF',
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
