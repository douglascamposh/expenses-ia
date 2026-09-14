import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { BudgetRow } from '@/components/BudgetRow';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { NewExpense } from '@/expenses/models/Expense';
import { getCurrencySymbol } from '@/expenses/utils/format';
import type { BudgetProgress } from '@/expenses/models/Budget';
import type { CategorySummary } from '@/store/expensesSlice';

/** Máximo visible en inicio; el resto vive en /budgets. */
const MAX_ROWS = 6;

type Row =
  | { kind: 'budget'; key: string; category: string; progress: BudgetProgress }
  | { kind: 'spent'; key: string; category: string; currency: string; total: number };

type Props = {
  loading: boolean;
  budgets: BudgetProgress[];
  summary: CategorySummary[];
  onOpenCategory: (category: string) => void;
  onSeeAll: () => void;
};

/**
 * Lista única de categorías estilo mockup: cada una sale una sola vez.
 * Con presupuesto → gastado/límite + % + barra; sin presupuesto → solo gastado.
 * Presupuestadas primero (% desc), luego con gasto (total desc).
 */
export function UnifiedCategories({ loading, budgets, summary, onOpenCategory, onSeeAll }: Props) {
  const rows = useMemo<Row[]>(() => {
    const budgeted = (budgets ?? []).filter(Boolean);
    const keys = new Set(budgeted.map((b) => `${b.category}|${b.currency}`));
    const spent = (summary ?? []).filter(
      (s) => s && (s.total ?? 0) > 0 && !keys.has(`${s.category}|${s.currency}`),
    );
    const byPct = [...budgeted].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
    const byTotal = [...spent].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    return [
      ...byPct.map(
        (b): Row => ({ kind: 'budget', key: `b-${b.category}-${b.currency}`, category: String(b.category), progress: b }),
      ),
      ...byTotal.map(
        (s): Row => ({ kind: 'spent', key: `s-${s.category}-${s.currency}`, category: String(s.category), currency: String(s.currency), total: s.total ?? 0 }),
      ),
    ].slice(0, MAX_ROWS);
  }, [budgets, summary]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="smallBold">Categorías</Text>
        <Pressable accessibilityLabel="Ver todas las categorías" onPress={onSeeAll}>
          <Text variant="small" color="textSecondary">Ver todas ›</Text>
        </Pressable>
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        {loading ? (
          <Text color="textSecondary">Cargando...</Text>
        ) : rows.length === 0 ? (
          <Text color="textSecondary">Sin gastos aún</Text>
        ) : (
          rows.map((r) => {
            if (r.kind === 'budget') {
              return <BudgetRow key={r.key} progress={r.progress} onPress={() => onOpenCategory(r.category)} />;
            }
            const cat = getCategoryConfig(r.category);
            return (
              <Pressable
                key={r.key}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${cat.label}`}
                onPress={() => onOpenCategory(r.category)}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <View style={styles.spentRow}>
                  <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
                    <Text style={styles.emoji}>{cat.emoji}</Text>
                  </View>
                  <Text variant="smallBold" style={styles.name}>{cat.label}</Text>
                  <Text variant="small" color="textSecondary" numberOfLines={1}>
                    {getCurrencySymbol(r.currency as NewExpense['currency'])} {Math.round(r.total)} gastados
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.three, borderWidth: 1, borderColor: '#E4E2DE', backgroundColor: '#FFFFFF' },
  spentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 20 },
  name: { flex: 1 },
});
