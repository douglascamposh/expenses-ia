/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text, Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { QuickExpenseForm } from '@/components/QuickExpenseForm';
import { Spacing } from '@/constants/theme';
import { DEFAULT_CURRENCY, type NewExpense } from '@/expenses/models/Expense';
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

  useEffect(() => {
    setDraft(expense);
  }, [expense]);

  return (
    <Modal visible={visible} variant="center" animation="slide" onDismiss={onCancel}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
          <Check size={18} color="#fff" strokeWidth={3} />
        </View>
        <Text variant="smallBold" align="center">{t('expenseConfirmation_title')}{subtitle ? ` · ${subtitle}` : ''}</Text>

        {/* Mismo formulario que el alta/edición principal (look & feel mockup, compacto). */}
        <QuickExpenseForm
          value={draft}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          defaultCurrency={draft.currency ?? DEFAULT_CURRENCY}
          onSave={(d) => onSave(d)}
          allowCategory={draft.category}
          compact
        />
        <Button variant="ghost" size="sm" style={{ alignSelf: 'stretch' }} onPress={onCancel}>{t('expenseConfirmation_cancel')}</Button>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: Spacing.two, width: '100%' },
  checkCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
