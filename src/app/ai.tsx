import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Mic, Send, Sparkles } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { AnalyticsAnswerCard } from '@/components/AnalyticsAnswerCard';
import { Fonts, Spacing } from '@/constants/theme';
import { getAllCategories } from '@/expenses/categories/expenseCategories';
import { getCategoryLabel } from '@/expenses/categories/expenseCategories';
import { formatCurrency, formatMonthRange, getCurrencySymbol } from '@/expenses/utils/format';
import {
  detectHormiga,
  monthReview,
  routeAiQuery,
  savingAdvice,
  topSpending,
  type AdviceKind,
  type SavingSuggestion,
} from '@/expenses/analytics/insights';
import { aiChatRepository } from '@/expenses/repositories/AiChatRepository';
import { useSpeechTranscript } from '@/hooks/use-speech-transcript';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { answerAnalytics, type AnalyticsAnswer } from '@/store/expensesSlice';
import { AiError, AI_FREE_QUOTA, askAi, buildAiSnapshot, type AiResponse } from '@/services/ai-api';

/** Página de historial por carga (scroll al pasado). */
const HISTORY_PAGE = 10;

type UiSuggestion = {
  kind: 'hormiga' | 'subscription' | 'top' | 'cut' | 'reduce';
  title: string;
  detail: string;
  estimated?: number;
  expenseIds: string[];
};

type Msg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'ai-analytics'; answer: AnalyticsAnswer }
  | {
    id: string;
    role: 'ai-text';
    title: string;
    body: string;
    suggestions: UiSuggestion[];
    expenseIds: string[];
    offline: boolean;
  }
  | { id: string; role: 'system'; text: string };

let msgSeq = 0;
function nextId(): string {
  msgSeq += 1;
  return `m${Date.now().toString(36)}_${msgSeq}`;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Serializa para el historial (system no se persiste). */
function serializeMsg(m: Msg): { role: 'user' | 'ai'; content: string } | null {
  if (m.role === 'user') return { role: 'user', content: JSON.stringify({ text: m.text }) };
  if (m.role === 'ai-analytics') return { role: 'ai', content: JSON.stringify({ kind: 'analytics', answer: m.answer }) };
  if (m.role === 'ai-text') {
    return {
      role: 'ai',
      content: JSON.stringify({
        kind: 'text',
        title: m.title,
        body: m.body,
        suggestions: m.suggestions,
        expenseIds: m.expenseIds,
        offline: m.offline,
      }),
    };
  }
  return null;
}

/** Restaura una fila del historial. Null si está corrupta. */
function parseMsg(row: { id: number; role: string; content: string }): Msg | null {
  try {
    const data = JSON.parse(row.content) as Record<string, unknown>;
    if (row.role === 'user' && typeof data.text === 'string') {
      return { id: `h${row.id}`, role: 'user', text: data.text };
    }
    if (row.role === 'ai' && data.kind === 'analytics' && data.answer && typeof data.answer === 'object') {
      return { id: `h${row.id}`, role: 'ai-analytics', answer: data.answer as AnalyticsAnswer };
    }
    if (row.role === 'ai' && data.kind === 'text') {
      return {
        id: `h${row.id}`,
        role: 'ai-text',
        title: typeof data.title === 'string' ? data.title : '',
        body: typeof data.body === 'string' ? data.body : '',
        suggestions: Array.isArray(data.suggestions) ? (data.suggestions as UiSuggestion[]) : [],
        expenseIds: Array.isArray(data.expenseIds) ? (data.expenseIds as unknown[]).map(String) : [],
        offline: data.offline === true,
      };
    }
  } catch {
    // Fila corrupta: se salta.
  }
  return null;
}

type ChipLabelKey =
  | 'ai_chipHormiga'
  | 'ai_chipReview'
  | 'ai_chipTop'
  | 'ai_chipSave'
  | 'ai_chipSubs'
  | 'ai_chipFood'
  | 'ai_chipCompare'
  | 'ai_chipGoal'
  | 'ai_chipBalance'
  | 'ai_chipWeek'
  | 'ai_chipEmergency'
  | 'ai_chipChallenge';

type ChipQueryKey =
  | 'ai_querySubs'
  | 'ai_queryFood'
  | 'ai_queryCompare'
  | 'ai_queryGoal'
  | 'ai_queryBalance'
  | 'ai_queryWeek'
  | 'ai_queryEmergency'
  | 'ai_queryChallenge';

type ChipDef = {
  /** kind → endpoint con fallback de ese análisis; queryKey → pregunta libre (backend → analytics → heurística). */
  kind?: AdviceKind;
  queryKey?: ChipQueryKey;
  emoji: string;
  labelKey: ChipLabelKey;
  testID: string;
};

/**
 * Ordenadas por potencial de monetización: primero las que demuestran
 * valor de planificación/ahorro (convierten cuota gratis → pago),
 * luego diagnóstico y al final detalle por categoría/periodo.
 */
const CHIPS: ChipDef[] = [
  { queryKey: 'ai_queryGoal', emoji: '🎯', labelKey: 'ai_chipGoal', testID: 'ai-chip-goal' },
  { kind: 'save', emoji: '💰', labelKey: 'ai_chipSave', testID: 'ai-chip-save' },
  { queryKey: 'ai_querySubs', emoji: '🔁', labelKey: 'ai_chipSubs', testID: 'ai-chip-subs' },
  { queryKey: 'ai_queryEmergency', emoji: '🛟', labelKey: 'ai_chipEmergency', testID: 'ai-chip-emergency' },
  { queryKey: 'ai_queryChallenge', emoji: '🏆', labelKey: 'ai_chipChallenge', testID: 'ai-chip-challenge' },
  { kind: 'review', emoji: '🗓️', labelKey: 'ai_chipReview', testID: 'ai-chip-review' },
  { kind: 'top', emoji: '📊', labelKey: 'ai_chipTop', testID: 'ai-chip-top' },
  { queryKey: 'ai_queryCompare', emoji: '📈', labelKey: 'ai_chipCompare', testID: 'ai-chip-compare' },
  { queryKey: 'ai_queryBalance', emoji: '💵', labelKey: 'ai_chipBalance', testID: 'ai-chip-balance' },
  { kind: 'hormiga', emoji: '🐜', labelKey: 'ai_chipHormiga', testID: 'ai-chip-hormiga' },
  { queryKey: 'ai_queryWeek', emoji: '📅', labelKey: 'ai_chipWeek', testID: 'ai-chip-week' },
  { queryKey: 'ai_queryFood', emoji: '🍔', labelKey: 'ai_chipFood', testID: 'ai-chip-food' },
];

/**
 * IA Financiera (mockup): historial persistido con paginación, chips que
 * van al endpoint (con fallback local), texto libre (backend → analytics →
 * heurística → fallback) y mensaje de cuota agotada.
 */
export default function AiScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.expenses.items ?? []);
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const rules = useAppSelector((s) => s.recurring.rules ?? []);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const speech = useSpeechTranscript(lang);
  const listening = speech.status === 'listening' || speech.status === 'starting';

  /** newest-first (FlatList invertida). */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestIdRef = useRef<number | null>(null);

  const now = new Date();
  const period = useMemo(() => formatMonthRange(now), []);
  const prevPeriod = useMemo(
    () => formatMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const monthItems = useMemo(
    () => (items ?? []).filter((e) => e && e.date >= period.from && e.date <= period.to && e.currency === defaultCurrency),
    [items, period, defaultCurrency],
  );
  const prevItems = useMemo(
    () => (items ?? []).filter((e) => e && e.date >= prevPeriod.from && e.date <= prevPeriod.to && e.currency === defaultCurrency),
    [items, prevPeriod, defaultCurrency],
  );
  const byId = useMemo(() => new Map((items ?? []).filter(Boolean).map((e) => [e.id, e])), [items]);
  const symbol = getCurrencySymbol(defaultCurrency);

  // Historial: últimas 10 al abrir.
  useEffect(() => {
    let alive = true;
    void aiChatRepository
      .list({ limit: HISTORY_PAGE })
      .then((rows) => {
        if (!alive) return;
        if (rows.length > 0) oldestIdRef.current = rows[rows.length - 1].id;
        setHasMore(rows.length === HISTORY_PAGE);
        setMessages(rows.map(parseMsg).filter((m): m is Msg => m !== null));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** Scroll al pasado: carga la página anterior. */
  const loadMore = useCallback(async () => {
    const cursor = oldestIdRef.current;
    if (cursor == null || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await aiChatRepository.list({ limit: HISTORY_PAGE, beforeId: cursor });
      if (rows.length > 0) oldestIdRef.current = rows[rows.length - 1].id;
      setHasMore(rows.length === HISTORY_PAGE);
      const parsed = rows.map(parseMsg).filter((m): m is Msg => m !== null);
      if (parsed.length > 0) setMessages((prev) => [...prev, ...parsed]);
    } catch {
      // Reintenta en el próximo scroll.
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  // El dictado fluye al input en vivo.
  useEffect(() => {
    if (speech.transcript) setInput(speech.transcript);
  }, [speech.transcript]);

  const persist = useCallback((m: Msg) => {
    const s = serializeMsg(m);
    if (!s) return;
    void aiChatRepository.add(s.role, s.content).catch(() => {});
  }, []);

  const pushUser = useCallback((text: string) => {
    const m: Msg = { id: nextId(), role: 'user', text };
    setMessages((prev) => [m, ...prev]);
    persist(m);
  }, [persist]);

  const pushText = useCallback((title: string, body: string, extra?: Partial<Extract<Msg, { role: 'ai-text' }>>) => {
    const m: Msg = { id: nextId(), role: 'ai-text', title, body, suggestions: [], expenseIds: [], offline: false, ...extra };
    setMessages((prev) => [m, ...prev]);
    persist(m);
  }, [persist]);

  const pushAnalytics = useCallback((answer: AnalyticsAnswer) => {
    const m: Msg = { id: nextId(), role: 'ai-analytics', answer };
    setMessages((prev) => [m, ...prev]);
    persist(m);
  }, [persist]);

  const pushSystem = useCallback((text: string) => {
    setMessages((prev) => [{ id: nextId(), role: 'system', text }, ...prev]);
  }, []);

  const pushAiResponse = useCallback((resp: AiResponse) => {
    if (resp.quota_remaining !== undefined) setQuota(resp.quota_remaining);
    const m: Msg = {
      id: nextId(),
      role: 'ai-text',
      title: resp.title,
      body: resp.summary,
      suggestions: resp.suggestions.map((s) => ({
        kind: s.kind,
        title: s.title,
        detail: s.detail,
        estimated: s.estimated_savings,
        expenseIds: s.expense_ids,
      })),
      expenseIds: resp.expense_ids,
      offline: false,
    };
    setMessages((prev) => [m, ...prev]);
    persist(m);
  }, [persist]);

  const snapshotFor = useCallback((query: string) => buildAiSnapshot({
    query,
    lang,
    currency: defaultCurrency,
    period,
    categories: getAllCategories().map((c) => ({ id: String(c.id), label: c.label, kind: c.kind })),
    expenses: monthItems,
    rules,
    budgets,
  }), [lang, defaultCurrency, period, monthItems, rules, budgets]);

  /** Chips: van al endpoint; si falla, heurística local. */
  const askChip = useCallback(async (kind: AdviceKind, label: string) => {
    if (loading) return;
    pushUser(label);
    setLoading(true);
    try {
      const resp = await askAi(snapshotFor(label));
      pushAiResponse(resp);
    } catch (e) {
      if ((e as { status?: number })?.status === 429) {
        setQuota(0);
        pushSystem(t('ai_quotaOut'));
        return;
      }
      runAdviceLocal(kind, label);
    } finally {
      setLoading(false);
    }
  }, [loading, pushUser, pushAiResponse, snapshotFor, t]);

  /** Texto libre: backend → analytics → heurística → fallback. */
  const answer = useCallback(async (q: string) => {
    const clean = q.trim();
    if (clean.length < 2 || loading) return;
    pushUser(clean);
    setInput('');
    setLoading(true);
    try {
      try {
        const resp = await askAi(snapshotFor(clean));
        pushAiResponse(resp);
        return;
      } catch (e) {
        if ((e as { status?: number })?.status === 429) {
          setQuota(0);
          pushSystem(t('ai_quotaOut'));
          return;
        }
        // Cae al pipeline local.
      }
      try {
        const a = await dispatch(answerAnalytics({ query: clean, currency: defaultCurrency })).unwrap();
        pushAnalytics(a);
        return;
      } catch {
        // Sigue a heurística.
      }
      const kind = routeAiQuery(clean);
      if (kind) {
        const labels: Record<AdviceKind, string> = {
          hormiga: t('ai_chipHormiga'),
          review: t('ai_chipReview'),
          top: t('ai_chipTop'),
          save: t('ai_chipSave'),
        };
        setMessages((prev) => (prev[0]?.role === 'user' ? prev.slice(1) : prev));
        runAdviceLocal(kind, labels[kind]);
        return;
      }
      pushText(clean, t('ai_fallback'), { offline: true });
    } finally {
      setLoading(false);
    }
  }, [loading, pushUser, pushText, pushAnalytics, pushAiResponse, snapshotFor, dispatch, defaultCurrency, t]);

  /** Heurística local (offline / fallback del endpoint). */
  const runAdviceLocal = useCallback((kind: AdviceKind, label: string) => {
    if (kind === 'hormiga') {
      const r = detectHormiga(monthItems, defaultCurrency);
      if (r.groups.length === 0) {
        pushText(label, t('ai_fallback'));
        return;
      }
      pushText(
        `${fmtInt(r.total)} ${symbol}`,
        `${r.count} gastos hormiga este mes`,
        {
          suggestions: r.groups.map((g) => ({
            kind: 'hormiga' as const,
            title: g.label,
            detail: `${g.count} × · ${fmtInt(g.total)} ${symbol}`,
            estimated: Math.round(g.total / 2),
            expenseIds: g.ids,
          })),
          expenseIds: r.groups.flatMap((g) => g.ids).slice(0, 10),
          offline: true,
        },
      );
      return;
    }
    if (kind === 'review') {
      const r = monthReview(monthItems, prevItems, defaultCurrency);
      const topLine = r.top ? `${getCategoryLabel(r.top.category, lang)}: ${fmtInt(r.top.total)} ${symbol}` : '';
      const delta = r.deltaPct === null
        ? ''
        : ` (${r.deltaPct >= 0 ? '+' : ''}${Math.round(r.deltaPct)}% vs mes anterior)`;
      pushText(
        `${fmtInt(r.total)} ${symbol}`,
        `${r.count} gastos este mes. ${topLine}${delta}`,
        { offline: true },
      );
      return;
    }
    if (kind === 'top') {
      const top = topSpending(monthItems, defaultCurrency);
      if (!top) {
        pushText(label, t('ai_fallback'));
        return;
      }
      pushText(
        `${getCategoryLabel(top.category, lang)}: ${fmtInt(top.total)} ${symbol}`,
        `${Math.round(top.share)}% del mes en ${top.count} gastos`,
        { offline: true },
      );
      return;
    }
    const r = savingAdvice({ expenses: monthItems, rules, budgets, currency: defaultCurrency, lang });
    if (r.suggestions.length === 0) {
      pushText(label, t('ai_fallback'));
      return;
    }
    const first = r.suggestions[0];
    pushText(
      first.title,
      `${fmtInt(r.total)} ${symbol} potenciales en ${r.suggestions.length} ideas`,
      {
        suggestions: r.suggestions.map((s: SavingSuggestion) => ({
          kind: s.kind,
          title: s.title,
          detail: s.detail,
          estimated: s.estimated,
          expenseIds: s.expenseIds,
        })),
        expenseIds: r.suggestions.flatMap((s: SavingSuggestion) => s.expenseIds).slice(0, 10),
        offline: true,
      },
    );
  }, [pushText, monthItems, prevItems, defaultCurrency, symbol, rules, budgets, lang, t]);

  const toggleMic = useCallback(() => {
    if (listening) speech.stop();
    else {
      setInput('');
      void speech.start();
    }
  }, [listening, speech]);

  /** Chips: con kind van directo al endpoint; con queryKey usan el pipeline de texto libre. */
  const pressChip = useCallback((c: ChipDef) => {
    if (c.kind) void askChip(c.kind, t(c.labelKey));
    else if (c.queryKey) void answer(t(c.queryKey));
  }, [askChip, answer, t]);

  const suggestionEmoji = (kind: string): string => {
    switch (kind) {
      case 'hormiga':
        return '🐜';
      case 'subscription':
        return '🔁';
      case 'cut':
        return '✂️';
      default:
        return '📉';
    }
  };

  const renderMsg = ({ item: m }: { item: Msg }) => {
    if (m.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={[styles.userBubble, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text variant="smallBold">{m.text}</Text>
          </View>
        </View>
      );
    }
    if (m.role === 'system') {
      return (
        <View style={styles.systemRow}>
          <Text variant="small" color="textSecondary" align="center">{m.text}</Text>
        </View>
      );
    }
    if (m.role === 'ai-analytics') {
      return (
        <View style={styles.aiRow}>
          <AnalyticsAnswerCard answer={m.answer} />
        </View>
      );
    }
    return (
      <View style={styles.aiRow}>
        <View style={[styles.aiCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {m.title !== '' && <Text variant="smallBold">{m.title}</Text>}
          <Text variant="small" color="textSecondary">{m.body}</Text>
          {m.suggestions.map((s, i) => (
            <View key={`${m.id}-s${i}`} style={styles.suggRow}>
              <Text style={styles.suggEmoji}>{suggestionEmoji(s.kind)}</Text>
              <View style={styles.suggTexts}>
                <Text variant="smallBold">{s.title}</Text>
                <Text variant="small" color="textSecondary">{s.detail}</Text>
              </View>
            </View>
          ))}
          {m.expenseIds.map((id) => {
            const e = byId.get(id);
            if (!e) return null;
            return (
              <View key={`${m.id}-${id}`} style={styles.refRow}>
                <Text variant="small" style={styles.refDesc} numberOfLines={1}>{e.description}</Text>
                <Text variant="smallBold">{formatCurrency(e.amount ?? 0, e.currency)}</Text>
              </View>
            );
          })}
          {m.offline && (
            <Text variant="caption" color="textSecondary">{t('ai_offlineNote')}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('ai_a11yBack')} onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color={theme.text} />
          </Pressable>
          <View style={styles.quotaWrap}>
            <View style={[styles.quota, { borderColor: theme.border }]} testID="ai-quota">
              <Text variant="small">{t('ai_quota', { n: quota ?? AI_FREE_QUOTA })}</Text>
            </View>
          </View>
        </View>

        <View style={styles.suggestZone} testID="ai-suggest-bar">
          <Text variant="caption" color="textSecondary" style={styles.suggestTitle}>{t('ai_suggestions')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {CHIPS.map((c) => (
              <Pressable
                key={c.testID}
                accessibilityRole="button"
                accessibilityLabel={t(c.labelKey)}
                onPress={() => pressChip(c)}
                testID={c.testID}
                style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              >
                <Text style={styles.chipEmoji}>{c.emoji}</Text>
                <Text variant="smallBold">{t(c.labelKey)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMsg}
          inverted
          initialNumToRender={30}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.hero}>
              <Text variant="h2" align="center">{t('ai_subtitle')}</Text>
            </View>
          }
          ListHeaderComponent={loading ? (
            <View style={styles.aiRow}>
              <View style={[styles.aiCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ActivityIndicator color={theme.textSecondary} />
                <Text variant="small" color="textSecondary">{t('ai_thinking')}</Text>
              </View>
            </View>
          ) : undefined}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerZone}>
              <ActivityIndicator color={theme.textSecondary} />
            </View>
          ) : undefined}
          testID="ai-list"
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Sparkles size={20} color={theme.textSecondary} />
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => void answer(input)}
              placeholder={t('ai_inputPh')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              returnKeyType="send"
              testID="ai-input"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(listening ? 'ai_stopMic' : 'ai_mic')}
              onPress={toggleMic}
              testID="ai-mic"
            >
              <Mic size={22} color={listening ? theme.expense : theme.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('ai_send')}
              onPress={() => void answer(input)}
              disabled={loading || input.trim().length < 2}
              testID="ai-send"
              style={[styles.sendBtn, { backgroundColor: theme.expense }, (loading || input.trim().length < 2) && styles.sendDisabled]}
            >
              <Send size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  quotaWrap: { flex: 1, alignItems: 'center' },
  quota: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  scroll: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  footerZone: { gap: Spacing.three, paddingBottom: Spacing.two },
  suggestZone: { paddingVertical: Spacing.one, gap: 8 },
  suggestTitle: { paddingHorizontal: Spacing.three },
  chipsRow: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  chipEmoji: { fontSize: 20 },
  userRow: { alignItems: 'flex-end' },
  userBubble: { borderWidth: 1, borderRadius: 16, borderTopRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  aiRow: {},
  systemRow: { alignItems: 'center', paddingVertical: Spacing.one },
  aiCard: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  suggRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  suggEmoji: { fontSize: 18 },
  suggTexts: { flex: 1, gap: 2 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  refDesc: { flex: 1 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 999, margin: Spacing.three, marginTop: Spacing.one, paddingLeft: 16, paddingRight: 8, paddingVertical: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: Fonts.sans, paddingVertical: 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.5 },
});
