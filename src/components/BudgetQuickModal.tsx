import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { Currency } from '@/expenses/models/Expense';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  /** Null = cerrado (no hay categoría elegida). */
  categoryId: string | null;
  currency: Currency;
  /** Límite actual si ya tiene presupuesto (se precarga). */
  currentLimit?: number | null;
  saving: boolean;
  onClose: () => void;
  onSave: (amount: number) => void;
};

/**
 * Modal rápido de presupuesto desde el carrusel (long-press):
 * monto máximo del mes para la categoría. Crea o actualiza.
 */
export function BudgetQuickModal({ visible, categoryId, currency, currentLimit, saving, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [amountText, setAmountText] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountText(currentLimit && currentLimit > 0 ? String(currentLimit) : '');
      setAttempted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, categoryId]);

  if (!categoryId) return null;
  const config = getCategoryConfig(categoryId);

  const amount = parseFloat((amountText ?? '').replace(',', '.')) || 0;
  const invalid = amount <= 0;

  const handleSave = () => {
    setAttempted(true);
    if (invalid) return;
    onSave(amount);
  };

  return (
    <Modal visible={visible} variant="bottomSheet" animation="slide" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.emoji}>{config.emoji}</Text>
          <Text variant="h3" style={styles.title} numberOfLines={2}>
            {t('budgets_quickTitle', { label: config.label })}
          </Text>
        </View>
        <View style={styles.editor}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            placeholder={t('budgets_quickLimitPh')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.amountInput, { borderColor: theme.border, color: theme.text }]}
            testID={`budget-quick-amount-${config.id}`}
          />
          <View style={[styles.currencyBadge, { borderColor: theme.border }]}>
            <Text variant="smallBold">{currency}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('budgets_a11ySave')}
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveCircle, { backgroundColor: theme.dark }, saving && { opacity: 0.6 }]}
          >
            <Check size={22} color={theme.white} strokeWidth={3} />
          </Pressable>
        </View>
        {attempted && invalid && (
          <Text variant="small" color="danger">{t('budgetModal_amountError')}</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: Spacing.three, paddingTop: Spacing.one, paddingBottom: Spacing.four },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  emoji: { fontSize: 32, lineHeight: 40 },
  title: { flex: 1 },
  editor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  currencyBadge: { borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  saveCircle: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
