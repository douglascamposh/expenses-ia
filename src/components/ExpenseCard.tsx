import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { Expense } from '@/expenses/models/Expense';
import { getPaymentLabel } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';
import { pastel } from '@/expenses/utils/colors';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

/** Fila de gasto estilo mockup: círculo pastel + título + tag + monto píldora. */
export function ExpenseCard({ expense, onPress }: { expense: Expense; onPress?: () => void }) {
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const cat = getCategoryConfig(expense.category);
  const sign = (expense.kind ?? 'EXPENSE') === 'INCOME' ? '+' : '-';
  return (
    <Pressable onPress={onPress} accessibilityLabel={t('dashboard_a11ySeeExpense', { desc: expense.description })} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: pastel(cat.color, 0.25, expense.category) }]}>
          <Text style={styles.icon}>{cat.emoji}</Text>
        </View>
        <View style={styles.middle}>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>{cat.label}</Text>
          <Text variant="smallBold" style={styles.title} numberOfLines={2}>{expense.description}</Text>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
            <Text variant="caption" color="textSecondary">#{getPaymentLabel(expense.paymentMethod ?? 'CASH', lang).toLowerCase()}</Text>
          </View>
        </View>
        <View style={[styles.amountPill, { backgroundColor: theme.backgroundSelected }]}>
          <Text variant="smallBold" numberOfLines={1}>{`${sign} ${formatCurrency(expense.amount, expense.currency)}`}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26, lineHeight: 32 },
  middle: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontFamily: Fonts.sans },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  amountPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
