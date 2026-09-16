/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { Check, ChevronDown, Mic, Square, X } from 'lucide-react-native';
import { Text, Button, Chip, Input } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { DatePickerModal, formatDateDisplay } from '@/components/DatePickerModal';
import { Spacing } from '@/constants/theme';
import { getAllCategories, getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { type NewExpense, type PaymentMethod } from '@/expenses/models/Expense';
import { getPaymentEmoji, getPaymentLabel } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

const PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CARD'];

type Phase = 'recording' | 'analyzing' | 'results';

type Props = {
  visible: boolean;
  phase: Phase | null;
  expenses: NewExpense[];
  onStop: () => void;
  onClose: () => void;
  onCancelAnalyzing: () => void;
  onSaveOne: (index: number, expense: NewExpense) => void;
  onSaveAll: (expenses: NewExpense[]) => void;
  onDismissResults: () => void;
  saving: boolean;
};

export function UnifiedVoiceModal({ visible, phase, expenses, onStop, onClose, onCancelAnalyzing, onSaveOne, onSaveAll, onDismissResults, saving }: Props) {
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [phase]);

  const [drafts, setDrafts] = useState<NewExpense[]>(() => (Array.isArray(expenses) ? expenses.filter(Boolean) : []));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [datePickerFor, setDatePickerFor] = useState<number | null>(null);

  useEffect(() => {
    setDrafts(Array.isArray(expenses) ? expenses.filter(Boolean) : []);
    setEditingIndex(null);
  }, [expenses]);

  const updateDraft = (index: number, patch: Partial<NewExpense>) => {
    setDrafts((prev) => (Array.isArray(prev) ? prev : []).map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  if (!visible || !phase) return null;

  // Recording / Analyzing -> fullscreen
  if (phase === 'recording' || phase === 'analyzing') {
    const isAnalyzing = phase === 'analyzing';
    return (
      <Modal visible={visible} variant="fullscreen" animation="fade" onDismiss={isAnalyzing ? onCancelAnalyzing : onClose}>
        <View style={styles.fullscreenContent}>
          <Pressable onPress={isAnalyzing ? onCancelAnalyzing : onClose} style={[styles.closeBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <X size={22} color={theme.text} strokeWidth={2} />
          </Pressable>

          <View style={styles.pulseWrap}>
            <View style={[styles.pulseOuter, isAnalyzing && { opacity: 0.12 }]} />
            <View style={[styles.pulseMid, isAnalyzing && { opacity: 0.18 }]} />
            <View style={[styles.micCircle, { backgroundColor: theme.primary, shadowColor: theme.primary, borderColor: theme.backgroundElement }]}>
              {isAnalyzing ? <ActivityIndicator color="#fff" size="large" /> : <Mic size={42} color="#fff" strokeWidth={2} />}
            </View>
          </View>

          <Text variant="smallBold" style={styles.listening}>{isAnalyzing ? t('voice_analyzing') : t('voice_listening')}</Text>
          <Text variant="small" color="textSecondary">{isAnalyzing ? t('voice_understanding') : t('voice_tellMe')}</Text>

          <View style={[styles.waveform, isAnalyzing && { opacity: 0.35 }]}>
            {Array.from({ length: 32 }).map((_, i) => {
              const phaseTick = tick * 0.45 + i * 0.7;
              const base = Math.abs(Math.sin(phaseTick)) * 26 + Math.abs(Math.cos(phaseTick * 0.6)) * 10;
              const h = 10 + base + (i % 4 === 0 ? 6 : 0);
              const clamped = Math.max(10, Math.min(42, h));
              return <View key={i} style={[styles.bar, { backgroundColor: theme.primary, height: isAnalyzing ? 14 : clamped, opacity: isAnalyzing ? 0.4 : 0.45 + (clamped / 42) * 0.55 }]} />;
            })}
          </View>

          {isAnalyzing ? (
            <View style={styles.analyzingFooter}>
              <Text variant="small" color="textSecondary">{t('voice_takesSeconds')}</Text>
              <Button variant="neutral" size="sm" style={{ alignSelf: 'center' }} onPress={onCancelAnalyzing}>{t('voice_cancel')}</Button>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recording_stop')}
              testID="voice-stop-button"
              onPress={onStop}
              style={({ pressed }) => [[styles.stopBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }], pressed && { opacity: 0.85 }]}
            >
              <Square size={12} color={theme.primary} fill={theme.primary} />
              <Text variant="smallBold" style={[styles.stopText, { color: theme.primary }]}>{t('voice_stop')}</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    );
  }

  // Results -> pantalla completa con scroll (varios gastos)
  // Garantía dura: drafts siempre es array (viene de Redux que nunca deja null).
  const safeDrafts = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  const subtitle = safeDrafts.length === 1 ? t('voice_detectedOne') : t('voice_detectedMany', { n: safeDrafts.length });

  return (
    <Modal visible={visible} variant="fullscreen" animation="slide" onDismiss={onDismissResults}>
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('voice_a11yClose')} onPress={onDismissResults} style={[styles.closeResultsBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <X size={22} color={theme.text} strokeWidth={2} />
          </Pressable>
          <View style={styles.resultsTitle}>
            <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
              <Check size={18} color="#fff" strokeWidth={3} />
            </View>
            <View style={styles.resultsTitleText}>
              <Text variant="smallBold">{subtitle}</Text>
              <Text variant="small" color="textSecondary">{t('voice_reviewHint')}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent} showsVerticalScrollIndicator={true}>
          {safeDrafts.map((draft, index) => {
            if (!draft) return null;
            const cat = getCategoryConfig(draft.category ?? 'OTHER');
            const confidencePct = draft.confidence !== undefined ? Math.round(draft.confidence * 100) : 96;
            const isEditing = editingIndex === index;
            return (
              <View key={`${draft.category ?? 'OTHER'}-${index}`} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
                    <Text style={styles.emoji}>{cat.emoji}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text variant="smallBold" numberOfLines={1}>{draft.description || cat.label}</Text>
                    <Text variant="small" color="textSecondary">{cat.label} · {draft.date}</Text>
                  </View>
                  <Text variant="smallBold">{formatCurrency(draft.amount ?? 0, draft.currency ?? 'BOB')}</Text>
                </View>

                <View style={styles.confidenceRow}>
                  <Text variant="small" color="textSecondary">{t('voice_confidence', { n: confidencePct })}</Text>
                  <View style={[styles.track, { backgroundColor: theme.border }]}>
                    <View style={[styles.fill, { width: `${confidencePct}%` as unknown as number, backgroundColor: confidencePct >= 80 ? theme.success : confidencePct >= 60 ? theme.warning : theme.danger }]} />
                  </View>
                </View>

                {isEditing && (
                  <View style={styles.editBox}>
                    <Input value={String(draft.amount)} onChangeText={(txt) => updateDraft(index, { amount: parseFloat(txt) || 0 })} keyboardType="numeric" placeholder={t('voice_amountPh')} />
                    <Input value={draft.description} onChangeText={(txt) => updateDraft(index, { description: txt })} placeholder={t('voice_descPh')} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catCarousel}>
                      {getAllCategories().map((c) => {
                        const active = String(c.id) === String(draft.category);
                        return (
                          <Pressable
                            key={String(c.id)}
                            accessibilityRole="button"
                            accessibilityLabel={c.label}
                            accessibilityState={{ selected: active }}
                            onPress={() => updateDraft(index, { category: c.id as NewExpense['category'] })}
                            style={[
                              styles.catPill,
                              { borderColor: active ? theme.text : theme.border, backgroundColor: theme.backgroundElement },
                            ]}
                          >
                            <Text style={styles.catEmoji}>{c.emoji}</Text>
                            <Text variant="smallBold" numberOfLines={1}>{c.label}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.row}>
                      {PAYMENT_METHODS.map((m) => (
                        <Chip key={m} label={getPaymentLabel(m, lang)} icon={getPaymentEmoji(m)} selected={(draft.paymentMethod ?? 'CASH') === m} onPress={() => updateDraft(index, { paymentMethod: m })} size="sm" />
                      ))}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('voice_a11yPickDate')}
                      onPress={() => setDatePickerFor(index)}
                      style={[styles.dateChip, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                    >
                      <Text variant="smallBold">{formatDateDisplay(draft.date)}</Text>
                      <ChevronDown size={14} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                )}

                <View style={styles.cardActions}>
                  <Button variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setEditingIndex(isEditing ? null : index)}>{isEditing ? t('voice_done') : t('voice_edit')}</Button>
                  <Button variant="primary" size="sm" style={{ flex: 1 }} loading={saving} onPress={() => onSaveOne(index, draft)}>{t('voice_save')}</Button>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.resultsFooter, { borderColor: theme.border }]}>
          <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onDismissResults}>{t('voice_cancelBtn')}</Button>
          {safeDrafts.length > 1 && <Button variant="primary" size="md" style={{ flex: 2 }} loading={saving} onPress={() => onSaveAll(safeDrafts)}>{t('voice_saveAll', { n: safeDrafts.length })}</Button>}
        </View>
        <DatePickerModal
          visible={datePickerFor !== null}
          value={datePickerFor !== null ? safeDrafts[datePickerFor]?.date : undefined}
          onClose={() => setDatePickerFor(null)}
          onSelect={(date) => {
            if (datePickerFor !== null) updateDraft(datePickerFor, { date });
            setDatePickerFor(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreenContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  closeBtn: { position: 'absolute', top: 50, left: Spacing.four, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, zIndex: 10 },
  pulseWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.four },
  pulseOuter: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#D9E1FF', opacity: 0.25 },
  pulseMid: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#C7D6FF', opacity: 0.35 },
  micCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, borderWidth: 4 },
  listening: { marginTop: Spacing.three },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 48, marginTop: Spacing.four },
  bar: { width: 3, borderRadius: 2 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.four, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, alignSelf: 'center' },
  stopText: { },
  analyzingFooter: { marginTop: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  // results fullscreen con scroll
  resultsContainer: { flex: 1, width: '100%', gap: Spacing.three },
  resultsHeader: { gap: Spacing.two },
  closeResultsBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  resultsTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  resultsTitleText: { flex: 1, gap: 2 },
  checkCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  resultsList: { flex: 1 },
  resultsListContent: { gap: Spacing.three, paddingBottom: Spacing.two },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 20 },
  cardMeta: { flex: 1, gap: 2 },
  confidenceRow: { gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  editBox: { gap: Spacing.two, marginTop: Spacing.one },
  row: { flexDirection: 'row', gap: 8 },
  catCarousel: { gap: 10, paddingVertical: 4, alignItems: 'center' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, maxWidth: 220 },
  catEmoji: { fontSize: 20 },
  dateChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  cardActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  resultsFooter: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1 },
});
