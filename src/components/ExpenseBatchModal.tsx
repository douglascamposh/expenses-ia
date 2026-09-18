/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { QuickExpenseForm } from '@/components/QuickExpenseForm';
import { Spacing } from '@/constants/theme';
import { DEFAULT_CURRENCY, type NewExpense } from '@/expenses/models/Expense';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  expenses: NewExpense[];
  onSaveOne: (index: number, expense: NewExpense) => void;
  onSaveAll: (expenses: NewExpense[]) => void;
  onDeleteOne: (index: number) => void;
  onCancel: () => void;
  saving: boolean;
};

export function ExpenseBatchModal({ visible, expenses, onSaveOne, onSaveAll, onDeleteOne, onCancel, saving }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [drafts, setDrafts] = useState<NewExpense[]>(expenses);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  useEffect(() => {
    setDrafts(expenses);
  }, [expenses]);

  const updateDraft = (index: number, patch: Partial<NewExpense>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const headerCount = expenses.length;
  const subtitle = headerCount === 1 ? t('voice_detectedOne') : t('voice_detectedMany', { n: headerCount });

  return (
    <Modal visible={visible} variant="bottomSheet" animation="slide" showHandle onDismiss={onCancel}>
      <View style={styles.header}>
        <Text variant="smallBold" align="center">{subtitle}</Text>
        <Text variant="small" color="textSecondary" align="center">{t('batch_reviewHint')}</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {drafts.map((draft, index) => (
            <View key={`${draft.category}-${index}`}>
              {/* Mismo formulario que el alta/edición principal (look & feel mockup, compacto). */}
              <QuickExpenseForm
                value={draft}
                onChange={(patch) => updateDraft(index, patch)}
                defaultCurrency={draft.currency ?? DEFAULT_CURRENCY}
                onSave={(d) => onSaveOne(index, d)}
                allowCategory={draft.category}
                compact
                onDeletePress={() => setConfirmIndex(index)}
              />
              {index < drafts.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            </View>
          ))}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border }]}>
        <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onCancel}>{t('batch_cancel')}</Button>
        {drafts.length > 1 && (
          <Button variant="dark" size="md" style={{ flex: 2 }} loading={saving} onPress={() => onSaveAll(drafts)}>{t('voice_saveAll', { n: drafts.length })}</Button>
        )}
      </View>
      <DeleteConfirm
        visible={confirmIndex !== null}
        onCancel={() => setConfirmIndex(null)}
        onDelete={() => {
          if (confirmIndex !== null) onDeleteOne(confirmIndex);
          setConfirmIndex(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6 },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.two },
  divider: { height: 1, marginTop: Spacing.three, opacity: 0.7 },
  footer: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1 },
});
