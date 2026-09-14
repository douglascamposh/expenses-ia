/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Modal } from '@/components/ui/Modal';
import { QuickExpenseForm } from '@/components/QuickExpenseForm';
import { Spacing } from '@/constants/theme';
import { DEFAULT_CURRENCY, type Currency, type NewExpense } from '@/expenses/models/Expense';
import { useTranslation } from '@/i18n/useTranslation';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function freshDraft(currency: Currency = DEFAULT_CURRENCY): NewExpense {
  return {
    amount: 0,
    currency,
    category: '' as NewExpense['category'],
    kind: 'EXPENSE',
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
  /** Moneda fija desde settings (sin selector). */
  defaultCurrency?: Currency;
  /** Cambiarlo para reiniciar el borrador (apertura nueva). */
  resetKey?: number;
};

export function ManualExpenseModal({ visible, saving, onClose, onSave, initial, defaultCurrency = DEFAULT_CURRENCY, resetKey = 0 }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<NewExpense>(() => ({ ...freshDraft(defaultCurrency), ...initial, currency: defaultCurrency }));
  const appliedRef = useRef<number | null>(null);

  useEffect(() => {
    // Solo se reinicia en aperturas nuevas (nuevo resetKey): al volver de
    // /categories el borrador se conserva para seguir donde quedó.
    if (visible && appliedRef.current !== resetKey) {
      appliedRef.current = resetKey;
      setDraft({ ...freshDraft(defaultCurrency), ...initial, currency: initial?.currency ?? defaultCurrency });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, resetKey]);

  return (
    <Modal visible={visible} variant="bottomSheet" animation="slide" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick_a11yCloseForm')}
          onPress={onClose}
          style={styles.closeBtn}
        >
          <X size={22} color="#0F172A" />
        </Pressable>
        <QuickExpenseForm
          value={draft}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          defaultCurrency={defaultCurrency}
          onSave={(d) => onSave({ ...d, currency: defaultCurrency })}
          expandBottom
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: Math.round(Dimensions.get('window').height * 0.8), gap: Spacing.two, paddingTop: Spacing.one },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', alignSelf: 'flex-end',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
});
