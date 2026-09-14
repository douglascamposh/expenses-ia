/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text, Button, Chip, Input } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { SUPPORTED_CURRENCIES, type NewExpense } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  expense: NewExpense;
  onSave: (e: NewExpense) => void;
  onCancel: () => void;
  subtitle?: string;
};

export function ExpenseConfirmation({ visible, expense, onSave, onCancel, subtitle }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
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
        <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
          <Check size={18} color="#fff" strokeWidth={3} />
        </View>
        <Text variant="smallBold" align="center">{t('expenseConfirmation_title')}{subtitle ? ` · ${subtitle}` : ''}</Text>

        <View style={[styles.expenseCardInner, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33', borderWidth: 1 }]}>
            <Text style={styles.emoji}>{cat.emoji}</Text>
          </View>
          <Text variant="smallBold" align="center">{draft.description || cat.label}</Text>
          <Text variant="h1" align="center">{formatCurrency(draft.amount, draft.currency)}</Text>
          <Text variant="small" color="textSecondary" align="center">{cat.label} · {draft.date}</Text>
        </View>

        <View style={[styles.confidenceBox, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
          <View style={styles.confidenceHeader}>
            <Text variant="small" color="textSecondary">{t('expenseConfirmation_confidence')}</Text>
            <Text variant="smallBold">{confidencePct}%</Text>
          </View>
          <View style={[styles.confidenceTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.confidenceFill, { width: `${confidencePct}%` as unknown as number, backgroundColor: theme.success }]} />
          </View>
        </View>

        {editing && (
          <View style={styles.editBox}>
            <Text variant="smallBold">{t('expenseConfirmation_edit')}</Text>
            <Input value={String(draft.amount)} onChangeText={(txt) => setDraft({ ...draft, amount: parseFloat(txt) || 0 })} keyboardType="numeric" placeholder={t('expenseConfirmation_amountPh')} />
            <Input value={draft.description} onChangeText={(txt) => setDraft({ ...draft, description: txt })} placeholder={t('expenseConfirmation_descPh')} />
            <CategoryPicker selected={draft.category} onSelect={(id) => setDraft({ ...draft, category: id as NewExpense['category'] })} />
            <View style={[styles.row, styles.currencyGrid]}>
              {SUPPORTED_CURRENCIES.map((cur) => (
                <Chip key={cur} label={cur} selected={draft.currency === cur} onPress={() => setDraft({ ...draft, currency: cur })} size="sm" />
              ))}
            </View>
            <Input value={draft.date} onChangeText={(txt) => setDraft({ ...draft, date: txt })} placeholder={t('expenseConfirmation_datePh')} />
          </View>
        )}

        <View style={styles.actions}>
          <Button variant="ghost" size="md" onPress={() => setEditing((v) => !v)}>{editing ? t('expenseConfirmation_done') : t('expenseConfirmation_editBtn')}</Button>
          <Button variant="primary" size="md" onPress={() => onSave(draft)}>{t('expenseConfirmation_save')}</Button>
        </View>
        <Button variant="neutral" size="sm" onPress={onCancel} style={{ borderWidth: 0, backgroundColor: 'transparent' }}>{t('expenseConfirmation_cancel')}</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: Spacing.two, width: '100%' },
  checkCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  expenseCardInner: { width: '100%', borderRadius: 16, padding: Spacing.three, alignItems: 'center', gap: 6, borderWidth: 1, marginTop: Spacing.two },
  iconBox: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  confidenceBox: { width: '100%', borderRadius: 12, padding: Spacing.three, borderWidth: 1, gap: 8, marginTop: Spacing.one },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confidenceTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  confidenceFill: { height: 6, borderRadius: 3 },
  editBox: { width: '100%', gap: Spacing.two, marginTop: Spacing.two },
  row: { flexDirection: 'row', gap: 8 },
  currencyGrid: { flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: Spacing.three, width: '100%', marginTop: Spacing.two },
});
