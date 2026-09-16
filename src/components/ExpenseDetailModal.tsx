/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Modal } from '@/components/ui/Modal';
import { QuickExpenseForm } from '@/components/QuickExpenseForm';
import { Spacing } from '@/constants/theme';
import type { Expense, Frequency, NewExpense } from '@/expenses/models/Expense';
import { useTranslation } from '@/i18n/useTranslation';

type Props = {
  expense: Expense | null | undefined;
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  /** Guarda el borrador editado (la pantalla despacha updateExpense / regla). */
  onSave: (patch: Partial<Expense> & { recurrence?: Frequency }) => void;
};

/** Separa un #tag final de la descripción para editarlo aparte. */
function splitTag(description: string): { desc: string; tag: string } {
  const m = String(description ?? '').match(/^(.*)\s+#(\S+)\s*$/);
  if (!m) return { desc: String(description ?? ''), tag: '' };
  return { desc: m[1], tag: m[2] };
}

/**
 * Detalle editable con la misma interfaz que agregar (QuickExpenseForm).
 * Sheet alto estilo mockup (fondo blanco hasta abajo), sin tag visible
 * (se conserva al guardar) y sin modales anidados.
 */
export function ExpenseDetailModal({ expense, visible, saving, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<NewExpense | null>(null);
  const [initialTag, setInitialTag] = useState('');

  useEffect(() => {
    if (visible && expense) {
      const { desc, tag } = splitTag(expense.description);
      setDraft({
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        kind: expense.kind ?? 'EXPENSE',
        description: desc,
        date: expense.date,
        paymentMethod: expense.paymentMethod ?? 'CASH',
        confidence: expense.confidence,
      });
      setInitialTag(tag);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, expense?.id]);

  if (!expense) return null;

  const handleSave = (d: NewExpense) => {
    onSave({
      amount: d.amount,
      description: d.description,
      category: d.category,
      kind: d.kind,
      currency: d.currency,
      date: d.date,
      paymentMethod: d.paymentMethod ?? 'CASH',
      recurrence: d.recurrence ?? 'ONCE',
    });
  };

  return (
    <Modal visible={visible} variant="bottomSheet" animation="slide" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common_close')}
          onPress={onClose}
          style={styles.closeBtn}
        >
          <X size={22} color="#0F172A" />
        </Pressable>
        {draft && (
          <QuickExpenseForm
            key={expense.id}
            value={draft}
            onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
            defaultCurrency={expense.currency}
            onSave={handleSave}
            initialTag={initialTag}
            expandBottom
            allowCategory={expense.category}
          />
        )}
      </View>
    </Modal>
  );
}

/** Sheet alto estilo mockup: el blanco llega hasta abajo con la fila de pago. */
const SHEET_MIN_H = Math.round(Dimensions.get('window').height * 0.8);

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: SHEET_MIN_H, gap: Spacing.two },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', alignSelf: 'flex-end',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
});
