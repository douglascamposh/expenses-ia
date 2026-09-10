/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text, Button, Chip, Input } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { SUPPORTED_CURRENCIES, type NewExpense, type PaymentMethod } from '@/expenses/models/Expense';
import { getPaymentEmoji, getPaymentLabel } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';

const PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CARD'];

type Props = {
  visible: boolean;
  expenses: NewExpense[];
  onSaveOne: (index: number, expense: NewExpense) => void;
  onSaveAll: (expenses: NewExpense[]) => void;
  onCancel: () => void;
  saving: boolean;
};

export function ExpenseBatchModal({ visible, expenses, onSaveOne, onSaveAll, onCancel, saving }: Props) {
  const [drafts, setDrafts] = useState<NewExpense[]>(expenses);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    setDrafts(expenses);
    setEditingIndex(null);
  }, [expenses]);

  const updateDraft = (index: number, patch: Partial<NewExpense>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const headerCount = expenses.length;
  const subtitle = headerCount === 1 ? '1 gasto detectado' : `${headerCount} gastos detectados`;

  return (
    <Modal visible={visible} variant="bottomSheet" animation="slide" showHandle onDismiss={onCancel}>
      <View style={styles.header}>
        <View style={styles.checkCircle}>
          <Check size={20} color="#fff" strokeWidth={3} />
        </View>
        <Text variant="smallBold" align="center">{subtitle}</Text>
        <Text variant="small" color="textSecondary" align="center">Revisa, edita o guarda cada gasto</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {drafts.map((draft, index) => {
          const cat = getCategoryConfig(draft.category);
          const confidencePct = draft.confidence !== undefined ? Math.round(draft.confidence * 100) : 96;
          const isEditing = editingIndex === index;
          return (
            <View key={`${draft.category}-${index}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
                  <Text style={styles.emoji}>{cat.emoji}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Text variant="smallBold" numberOfLines={1}>{draft.description || cat.label}</Text>
                  <Text variant="small" color="textSecondary">{cat.label} · {draft.date}</Text>
                </View>
                <Text variant="smallBold">{formatCurrency(draft.amount, draft.currency)}</Text>
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
                  <CategoryPicker selected={draft.category} onSelect={(id) => updateDraft(index, { category: id as NewExpense['category'] })} />
                    <View style={[styles.row, styles.currencyGrid]}>
                      {SUPPORTED_CURRENCIES.map((cur) => (
                        <Chip key={cur} label={cur} selected={draft.currency === cur} onPress={() => updateDraft(index, { currency: cur })} size="sm" />
                      ))}
                    </View>
                    <View style={styles.row}>
                      {PAYMENT_METHODS.map((m) => (
                        <Chip key={m} label={getPaymentLabel(m)} icon={getPaymentEmoji(m)} selected={(draft.paymentMethod ?? 'CASH') === m} onPress={() => updateDraft(index, { paymentMethod: m })} size="sm" />
                      ))}
                    </View>
                    <Input value={draft.date} onChangeText={(t) => updateDraft(index, { date: t })} placeholder="YYYY-MM-DD" />
                </View>
              )}

              <View style={styles.cardActions}>
                <Button variant="ghost" size="sm" onPress={() => setEditingIndex(isEditing ? null : index)}>{isEditing ? 'Done' : 'Edit'}</Button>
                <Button variant="primary" size="sm" loading={saving} onPress={() => onSaveOne(index, draft)}>Save</Button>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {drafts.length > 1 && (
          <Button variant="primary" size="md" fullWidth loading={saving} onPress={() => onSaveAll(drafts)}>{`Save all (${drafts.length})`}</Button>
        )}
        <Button variant="neutral" size="md" fullWidth onPress={onCancel}>Cancel</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6 },
  checkCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F80FF', alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.two },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 20 },
  cardMeta: { flex: 1, gap: 2 },
  confidenceRow: { gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E6E9F2', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  editBox: { gap: Spacing.two, marginTop: Spacing.one },
  row: { flexDirection: 'row', gap: 8 },
  currencyGrid: { flexWrap: 'wrap' },
  cardActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  footer: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderColor: '#E6E9F2' },
});
