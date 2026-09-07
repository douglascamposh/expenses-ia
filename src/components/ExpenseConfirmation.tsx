/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text, Button, Chip, Input } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { EXPENSE_CATEGORIES, getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';

type Props = {
  visible: boolean;
  expense: NewExpense;
  onSave: (e: NewExpense) => void;
  onCancel: () => void;
  subtitle?: string;
};

export function ExpenseConfirmation({ visible, expense, onSave, onCancel, subtitle }: Props) {
  const [draft, setDraft] = useState<NewExpense>(expense);
  const [editing, setEditing] = useState(false);
  const cat = getCategoryConfig(draft.category);

  useEffect(() => {
    setDraft(expense);
    setEditing(false);
  }, [expense]);

  const confidencePct = draft.confidence !== undefined ? Math.round(draft.confidence * 100) : 96;

  return (
    <Modal visible={visible} variant="center" animation="slide" onDismiss={onCancel}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Check size={18} color="#fff" strokeWidth={3} />
        </View>
        <Text variant="smallBold" align="center">New expense{subtitle ? ` · ${subtitle}` : ''}</Text>

        <View style={styles.expenseCardInner}>
          <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33', borderWidth: 1 }]}>
            <Text style={styles.emoji}>{cat.emoji}</Text>
          </View>
          <Text variant="smallBold" align="center">{draft.description || cat.label}</Text>
          <Text variant="h1" align="center">{formatCurrency(draft.amount, draft.currency)}</Text>
          <Text variant="small" color="textSecondary" align="center">{cat.label} · {draft.date}</Text>
        </View>

        <View style={styles.confidenceBox}>
          <View style={styles.confidenceHeader}>
            <Text variant="small" color="textSecondary">Confidence</Text>
            <Text variant="smallBold">{confidencePct}%</Text>
          </View>
          <View style={styles.confidenceTrack}>
            <View style={[styles.confidenceFill, { width: `${confidencePct}%` as unknown as number }]} />
          </View>
        </View>

        {editing && (
          <View style={styles.editBox}>
            <Text variant="smallBold">Editar</Text>
            <Input value={String(draft.amount)} onChangeText={(t) => setDraft({ ...draft, amount: parseFloat(t) || 0 })} keyboardType="numeric" placeholder="Amount" />
            <Input value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} placeholder="Description" />
            <View style={styles.categoryGrid}>
              {EXPENSE_CATEGORIES.map((c) => (
                <Chip key={c.id} label={c.label} icon={c.emoji} selected={draft.category === c.id} onPress={() => setDraft({ ...draft, category: c.id as NewExpense['category'] })} size="sm" />
              ))}
            </View>
            <View style={styles.row}>
              {(['BOB', 'USD', 'EUR'] as const).map((cur) => (
                <Chip key={cur} label={cur} selected={draft.currency === cur} onPress={() => setDraft({ ...draft, currency: cur })} size="sm" />
              ))}
            </View>
            <Input value={draft.date} onChangeText={(t) => setDraft({ ...draft, date: t })} placeholder="YYYY-MM-DD" />
          </View>
        )}

        <View style={styles.actions}>
          <Button variant="ghost" size="md" onPress={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</Button>
          <Button variant="primary" size="md" onPress={() => onSave(draft)}>Save</Button>
        </View>
        <Button variant="neutral" size="sm" onPress={onCancel} style={{ borderWidth: 0, backgroundColor: 'transparent' }}>Cancel</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: Spacing.two, width: '100%' },
  checkCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2F80FF', alignItems: 'center', justifyContent: 'center' },
  expenseCardInner: { width: '100%', borderRadius: 16, padding: Spacing.three, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF', marginTop: Spacing.two },
  iconBox: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  confidenceBox: { width: '100%', borderRadius: 12, padding: Spacing.three, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E6E9F2', gap: 8, marginTop: Spacing.one },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confidenceTrack: { height: 6, borderRadius: 3, backgroundColor: '#E6E9F2', overflow: 'hidden' },
  confidenceFill: { height: 6, borderRadius: 3, backgroundColor: '#0EB07B' },
  editBox: { width: '100%', gap: Spacing.two, marginTop: Spacing.two },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', gap: Spacing.three, width: '100%', marginTop: Spacing.two },
});
