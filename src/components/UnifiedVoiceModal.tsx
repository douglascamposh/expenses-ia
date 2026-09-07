/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { Check, Mic, Square, X } from 'lucide-react-native';
import { Text, Button, Chip, Input } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { EXPENSE_CATEGORIES, getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';

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
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [phase]);

  const [drafts, setDrafts] = useState<NewExpense[]>(() => (Array.isArray(expenses) ? expenses.filter(Boolean) : []));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
          <Pressable onPress={isAnalyzing ? onCancelAnalyzing : onClose} style={styles.closeBtn}>
            <X size={22} color="#0F172A" strokeWidth={2} />
          </Pressable>

          <View style={styles.pulseWrap}>
            <View style={[styles.pulseOuter, isAnalyzing && { opacity: 0.12 }]} />
            <View style={[styles.pulseMid, isAnalyzing && { opacity: 0.18 }]} />
            <View style={styles.micCircle}>
              {isAnalyzing ? <ActivityIndicator color="#fff" size="large" /> : <Mic size={42} color="#fff" strokeWidth={2} />}
            </View>
          </View>

          <Text variant="smallBold" style={styles.listening}>{isAnalyzing ? 'Analizando...' : 'Listening...'}</Text>
          <Text variant="small" color="textSecondary">{isAnalyzing ? 'Entendiendo tu audio' : 'Tell me what you spent'}</Text>

          <View style={[styles.waveform, isAnalyzing && { opacity: 0.35 }]}>
            {Array.from({ length: 32 }).map((_, i) => {
              const phaseTick = tick * 0.45 + i * 0.7;
              const base = Math.abs(Math.sin(phaseTick)) * 26 + Math.abs(Math.cos(phaseTick * 0.6)) * 10;
              const h = 10 + base + (i % 4 === 0 ? 6 : 0);
              const clamped = Math.max(10, Math.min(42, h));
              return <View key={i} style={[styles.bar, { height: isAnalyzing ? 14 : clamped, opacity: isAnalyzing ? 0.4 : 0.45 + (clamped / 42) * 0.55 }]} />;
            })}
          </View>

          {isAnalyzing ? (
            <View style={styles.analyzingFooter}>
              <Text variant="small" color="textSecondary">Esto puede tomar unos segundos</Text>
              <Button variant="neutral" size="sm" style={{ alignSelf: 'center' }} onPress={onCancelAnalyzing}>Cancelar</Button>
            </View>
          ) : (
            <Pressable onPress={onStop} style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.85 }]}>
              <Square size={12} color="#2F80FF" fill="#2F80FF" />
              <Text variant="smallBold" style={styles.stopText}>Stop</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    );
  }

  // Results -> small centered modal (not fullscreen, not full bottomSheet)
  // Garantía dura: drafts siempre es array (viene de Redux que nunca deja null).
  const safeDrafts = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  const subtitle = safeDrafts.length === 1 ? '1 gasto detectado' : `${safeDrafts.length} gastos detectados`;

  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onDismissResults}>
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <View style={styles.checkCircle}>
            <Check size={20} color="#fff" strokeWidth={3} />
          </View>
          <Text variant="smallBold" align="center">{subtitle}</Text>
          <Text variant="small" color="textSecondary" align="center">Revisa, edita o guarda cada gasto</Text>
        </View>

        <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent} showsVerticalScrollIndicator={false}>
          {safeDrafts.map((draft, index) => {
            if (!draft) return null;
            const cat = getCategoryConfig(draft.category ?? 'OTHER');
            const confidencePct = draft.confidence !== undefined ? Math.round(draft.confidence * 100) : 96;
            const isEditing = editingIndex === index;
            return (
              <View key={`${draft.category ?? 'OTHER'}-${index}`} style={styles.card}>
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
                  <Text variant="small" color="textSecondary">Confidence {confidencePct}%</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${confidencePct}%` as unknown as number, backgroundColor: confidencePct >= 80 ? '#0EB07B' : confidencePct >= 60 ? '#F59E0B' : '#EF4444' }]} />
                  </View>
                </View>

                {isEditing && (
                  <View style={styles.editBox}>
                    <Input value={String(draft.amount)} onChangeText={(t) => updateDraft(index, { amount: parseFloat(t) || 0 })} keyboardType="numeric" placeholder="Amount" />
                    <Input value={draft.description} onChangeText={(t) => updateDraft(index, { description: t })} placeholder="Description" />
                    <View style={styles.categoryGrid}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <Chip key={c.id} label={c.label} icon={c.emoji} selected={draft.category === c.id} onPress={() => updateDraft(index, { category: c.id as NewExpense['category'] })} size="sm" />
                      ))}
                    </View>
                    <View style={styles.row}>
                      {(['BOB', 'USD', 'EUR'] as const).map((cur) => (
                        <Chip key={cur} label={cur} selected={draft.currency === cur} onPress={() => updateDraft(index, { currency: cur })} size="sm" />
                      ))}
                    </View>
                    <Input value={draft.date} onChangeText={(t) => updateDraft(index, { date: t })} placeholder="YYYY-MM-DD" />
                  </View>
                )}

                <View style={styles.cardActions}>
                  <Button variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setEditingIndex(isEditing ? null : index)}>{isEditing ? 'Done' : 'Edit'}</Button>
                  <Button variant="primary" size="sm" style={{ flex: 1 }} loading={saving} onPress={() => onSaveOne(index, draft)}>Save</Button>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.resultsFooter}>
          {safeDrafts.length > 1 && <Button variant="primary" size="md" fullWidth loading={saving} onPress={() => onSaveAll(safeDrafts)}>{`Save all (${safeDrafts.length})`}</Button>}
          <Button variant="neutral" size="md" fullWidth onPress={onDismissResults}>Cancel</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreenContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  closeBtn: { position: 'absolute', top: 50, left: Spacing.four, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2', zIndex: 10 },
  pulseWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.four },
  pulseOuter: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#D9E1FF', opacity: 0.25 },
  pulseMid: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#C7D6FF', opacity: 0.35 },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#2F80FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#2F80FF', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, borderWidth: 4, borderColor: '#FFFFFF' },
  listening: { marginTop: Spacing.three },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 48, marginTop: Spacing.four },
  bar: { width: 3, backgroundColor: '#2F80FF', borderRadius: 2 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.four, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#2F80FF', alignSelf: 'center' },
  stopText: { color: '#2F80FF' },
  analyzingFooter: { marginTop: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  // results small modal
  resultsContainer: { width: '100%', maxHeight: 520, gap: Spacing.three },
  resultsHeader: { alignItems: 'center', gap: 6 },
  checkCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F80FF', alignItems: 'center', justifyContent: 'center' },
  resultsList: { flexGrow: 0, maxHeight: 360 },
  resultsListContent: { gap: Spacing.three, paddingBottom: Spacing.two },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 20 },
  cardMeta: { flex: 1, gap: 2 },
  confidenceRow: { gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E6E9F2', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  editBox: { gap: Spacing.two, marginTop: Spacing.one },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cardActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  resultsFooter: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderColor: '#E6E9F2' },
});
