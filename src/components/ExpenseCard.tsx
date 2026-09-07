import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { Expense } from '@/expenses/models/Expense';
import { formatCurrency, formatDateLabel } from '@/expenses/utils/format';

export function ExpenseCard({ expense, onPress }: { expense: Expense; onPress?: () => void }) {
  const cat = getCategoryConfig(expense.category);
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Ver ${expense.description}`} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
          <Text style={styles.icon}>{cat.emoji}</Text>
        </View>
        <View style={styles.middle}>
          <Text variant="smallBold" numberOfLines={1}>{expense.description}</Text>
          <Text variant="small" color="textSecondary">{cat.label} · {formatDateLabel(expense.date)}</Text>
        </View>
        <Text variant="smallBold" style={styles.amount}>{formatCurrency(expense.amount, expense.currency)}</Text>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9F2',
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(45,125,255,0.06)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  icon: { fontSize: 20 },
  middle: { flex: 1, gap: 2 },
  amount: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
});
