/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { ExpenseForm, isValidExpenseForm } from '@/components/ExpenseForm';
import { Spacing } from '@/constants/theme';
import { ExpenseCategory } from '@/expenses/categories/expenseCategories';
import { DEFAULT_CURRENCY, type Currency, type NewExpense } from '@/expenses/models/Expense';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function freshDraft(currency: Currency = DEFAULT_CURRENCY): NewExpense {
  return {
    amount: 0,
    currency,
    category: ExpenseCategory.OTHER,
    description: '',
    date: todayISO(),
    paymentMethod: 'CASH',
  };
}

type Props = {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: NewExpense) => void;
  /** Valores precargados (p. ej. categoría desde el detalle de presupuesto) */
  initial?: Partial<NewExpense>;
  /** Moneda por defecto para el borrador nuevo */
  defaultCurrency?: Currency;
};

export function ManualExpenseModal({ visible, saving, onClose, onSave, initial, defaultCurrency = DEFAULT_CURRENCY }: Props) {
  const [draft, setDraft] = useState<NewExpense>(() => ({ ...freshDraft(defaultCurrency), ...initial }));
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft({ ...freshDraft(defaultCurrency), ...initial });
      setAttempted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const valid = isValidExpenseForm(draft);

  const handleSave = () => {
    setAttempted(true);
    if (!isValidExpenseForm(draft)) return;
    onSave({ ...draft });
  };

  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Text variant="smallBold" align="center">Nuevo gasto</Text>
        <ExpenseForm
          value={draft}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          showErrors={attempted}
        />
        <View style={styles.footer}>
          <Button variant="primary" size="md" fullWidth loading={saving} disabled={!valid && attempted} onPress={handleSave}>Save</Button>
          <Button variant="neutral" size="md" fullWidth onPress={onClose}>Cancel</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: Spacing.three },
  footer: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderColor: '#E6E9F2' },
});
