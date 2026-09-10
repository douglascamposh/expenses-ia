import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronDown, ChevronLeft, Plus } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { BudgetModal } from '@/components/BudgetModal';
import { BudgetRow } from '@/components/BudgetRow';
import { Text, Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Currency } from '@/expenses/models/Expense';
import type { NewBudget } from '@/expenses/models/Budget';
import { formatCurrency, formatMonthLabel } from '@/expenses/utils/format';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deleteBudget, fetchExpenses, upsertBudget } from '@/store/expensesSlice';

export default function BudgetsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const loading = useAppSelector((s) => s.expenses.loading);
  const saving = useAppSelector((s) => s.expenses.saving);
  const budgetError = useAppSelector((s) => s.expenses.budgetError);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    void dispatch(fetchExpenses(10));
  }, [dispatch]);

  useEffect(() => {
    if (budgetError) Alert.alert('Presupuesto', budgetError);
  }, [budgetError]);

  const handleSave = useCallback((draft: NewBudget) => {
    void dispatch(upsertBudget({ ...draft })).unwrap().catch(() => {});
  }, [dispatch]);

  const handleDelete = useCallback((category: string) => {
    void dispatch(deleteBudget(category)).unwrap().catch(() => {});
  }, [dispatch]);

  const safe = budgets.filter(Boolean);
  const totals = (() => {
    const map = new Map<Currency, { spent: number; limit: number }>();
    for (const b of safe) {
      const prev = map.get(b.currency) ?? { spent: 0, limit: 0 };
      prev.spent += b.spent ?? 0;
      prev.limit += b.limit ?? 0;
      map.set(b.currency, prev);
    }
    return Array.from(map.entries());
  })();
  const primary = totals.find(([cur]) => cur === defaultCurrency) ?? totals[0];
  const primaryPct = primary && primary[1].limit > 0 ? Math.min((primary[1].spent / primary[1].limit) * 100, 100) : 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <Text variant="h2" style={styles.title}>Presupuestos</Text>
        </View>

        <View style={styles.periodRow}>
          <View style={styles.monthPill}>
            <CalendarDays size={14} color="#64748B" />
            <Text variant="small" color="textSecondary" style={styles.monthText}>{formatMonthLabel(new Date())}</Text>
            <ChevronDown size={14} color="#64748B" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Agregar presupuesto"
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [styles.addCircle, pressed && { opacity: 0.85 }]}
          >
            <Plus size={20} color="#2F80FF" />
          </Pressable>
        </View>

        {loading ? (
          <Text color="textSecondary">Cargando...</Text>
        ) : safe.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.empty}>
            <Text variant="smallBold">Sin presupuestos aún</Text>
            <Text variant="small" color="textSecondary" align="center">Define un monto máximo por categoría para este mes</Text>
            <Button variant="primary" size="md" fullWidth onPress={() => setModalVisible(true)}>+ Agregar presupuesto</Button>
          </ThemedView>
        ) : (
          <>
            {primary && (
              <ThemedView type="backgroundElement" style={styles.totalCard}>
                <Text variant="small" color="textSecondary">Total de presupuestos</Text>
                <Text variant="h1" style={styles.totalAmount}>
                  {formatCurrency(primary[1].spent, primary[0])} / {formatCurrency(primary[1].limit, primary[0])}
                </Text>
                <View style={styles.totalBarBg}>
                  <View style={[styles.totalBarFill, { width: `${primaryPct}%` as unknown as number }]} />
                </View>
                <Text variant="caption" color="textSecondary" style={styles.usedText}>{Math.round(primaryPct)}% usado</Text>
                {totals.filter(([cur]) => cur !== primary[0]).map(([cur, t]) => (
                  <Text key={cur} variant="small" color="textSecondary">
                    {formatCurrency(t.spent, cur)} / {formatCurrency(t.limit, cur)}
                  </Text>
                ))}
              </ThemedView>
            )}

            <Text variant="smallBold">Categorías</Text>
            <ThemedView type="backgroundElement" style={styles.listCard}>
              {safe.map((b) => (
                <BudgetRow key={`${b.category}-${b.currency}`} progress={b} onPress={() => router.push(`/budgets/${b.category}` as never)} />
              ))}
            </ThemedView>

            <Button variant="primary" size="md" fullWidth onPress={() => setModalVisible(true)}>+ Agregar presupuesto</Button>
          </>
        )}
      </ScrollView>

      <BudgetModal
        visible={modalVisible}
        saving={saving}
        budgets={safe.map((b) => ({ category: b.category, amount: b.limit, currency: b.currency }))}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        defaultCurrency={defaultCurrency}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', flex: 1 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  monthPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  monthText: { textTransform: 'capitalize' },
  addCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  totalCard: { borderRadius: 16, padding: Spacing.three, gap: 6, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  totalAmount: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  totalBarBg: { height: 8, borderRadius: 4, backgroundColor: '#E6E9F2', overflow: 'hidden', marginTop: 4 },
  totalBarFill: { height: 8, borderRadius: 4, backgroundColor: '#2F80FF' },
  usedText: { alignSelf: 'flex-end' },
  listCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.three, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  empty: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
});
