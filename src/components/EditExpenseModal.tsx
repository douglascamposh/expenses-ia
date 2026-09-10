/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Button, Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { ExpenseForm, isValidExpenseForm } from '@/components/ExpenseForm';
import { formatDateDisplay } from '@/components/DatePickerModal';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { getCurrencySymbol } from '@/expenses/utils/format';
import type { Expense } from '@/expenses/models/Expense';

type Props = {
  visible: boolean;
  expense: Expense;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Expense>) => void;
};

/**
 * Edición en modal de pantalla completa (estilo "Agregar gasto" del mockup,
 * sin el selector Voz/Manual y con botón Cancel).
 */
export function EditExpenseModal({ visible, expense, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Expense>(expense);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(expense);
      setAttempted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const valid = isValidExpenseForm(draft);

  const handleSave = () => {
    setAttempted(true);
    if (!isValidExpenseForm(draft)) return;
    onSave({
      amount: draft.amount,
      description: draft.description,
      category: draft.category,
      currency: draft.currency,
      date: draft.date,
      paymentMethod: draft.paymentMethod ?? 'CASH',
    });
  };

  const cat = getCategoryConfig(draft.category ?? 'OTHER');

  return (
    <Modal visible={visible} variant="fullscreen" animation="slide" onDismiss={onClose}>
      <View style={styles.headerBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onClose} style={styles.backBtn}>
          <ChevronLeft size={22} color="#0F172A" />
        </Pressable>
        <Text variant="smallBold" style={styles.title}>Editar gasto</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: cat.color + '1A' }]}>
            <Text style={styles.summaryEmoji}>{cat.emoji}</Text>
          </View>
          <View style={styles.summaryText}>
            <Text variant="smallBold">{draft.description?.trim() ? draft.description : 'Sin descripción'}</Text>
            <Text variant="h1" style={styles.summaryAmount}>
              {getCurrencySymbol(draft.currency)} {(Number(draft.amount) || 0).toFixed(2)}
            </Text>
            <Text variant="caption" color="textSecondary">{cat.label} · {formatDateDisplay(draft.date)}</Text>
          </View>
        </View>
        <ExpenseForm
          value={draft}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          showErrors={attempted}
        />
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" style={{ flex: 1 }} loading={saving} disabled={!valid && attempted} onPress={handleSave}>Guardar</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  headerSpacer: { width: 32 },
  body: { gap: Spacing.three, paddingVertical: Spacing.two },
  summaryCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9F2',
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
  },
  summaryIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  summaryEmoji: { fontSize: 28 },
  summaryText: { flex: 1, gap: 2 },
  summaryAmount: { fontSize: 22 },
  footer: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderColor: '#E6E9F2' },
});
