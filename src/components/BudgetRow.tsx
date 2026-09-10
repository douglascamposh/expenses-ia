import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { Currency } from '@/expenses/models/Expense';
import type { BudgetProgress } from '@/expenses/models/Budget';
import { getCurrencySymbol } from '@/expenses/utils/format';

type Props = {
  progress: BudgetProgress;
  onPress?: () => void;
};

/**
 * Fila de presupuesto estilo mockup: línea 1 icono + nombre … gastado/límite + %,
 * línea 2 barra a ancho completo (capada al 100%, roja si excedido).
 */
export function BudgetRow({ progress, onPress }: Props) {
  if (!progress) return null;
  const cat = getCategoryConfig(progress.category);
  const pct = Math.max(0, Math.round((progress.pct ?? 0) * 100));
  const barPct = Math.min(pct, 100);
  const color = progress.over ? '#EF4444' : cat.color;
  const symbol = getCurrencySymbol(progress.currency as Currency);

  const content = (
    <View style={styles.row}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
          <Text style={styles.emoji}>{cat.emoji}</Text>
        </View>
        <Text variant="smallBold" style={styles.name}>{cat.label}</Text>
        <View style={styles.right}>
          <Text variant="smallBold" numberOfLines={1}>
            {symbol} {Math.round(progress.spent ?? 0)} / {Math.round(progress.limit ?? 0)}
          </Text>
          <Text variant="caption" color={progress.over ? 'danger' : 'textSecondary'}>{pct}%</Text>
        </View>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { backgroundColor: color, width: `${barPct}%` as unknown as number }]} />
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, width: '100%' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 20 },
  name: { flex: 1 },
  barBg: { height: 6, borderRadius: 3, backgroundColor: '#E6E9F2', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  right: { alignItems: 'flex-end', gap: 2 },
});
