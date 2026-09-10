import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { BudgetModal } from '@/components/BudgetModal';
import { ExpenseCard } from '@/components/ExpenseCard';
import { ManualExpenseModal } from '@/components/ManualExpenseModal';
import { ProgressRing } from '@/components/ProgressRing';
import { Text, Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { Currency, NewExpense } from '@/expenses/models/Expense';
import type { NewBudget } from '@/expenses/models/Budget';
import { formatCurrency, formatDateLabel, formatMonthRange } from '@/expenses/utils/format';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createExpense, deleteBudget, fetchExpenses, upsertBudget } from '@/store/expensesSlice';

export default function BudgetDetailScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const dispatch = useAppDispatch();
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const items = useAppSelector((s) => s.expenses.items ?? []);
  const loading = useAppSelector((s) => s.expenses.loading);
  const saving = useAppSelector((s) => s.expenses.saving);
  const saveError = useAppSelector((s) => s.expenses.saveError);
  const budgetError = useAppSelector((s) => s.expenses.budgetError);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [budgetVisible, setBudgetVisible] = useState(false);

  useEffect(() => {
    void dispatch(fetchExpenses(50));
  }, [dispatch]);

  useEffect(() => {
    if (saveError) Alert.alert('No se pudo guardar', saveError);
  }, [saveError]);

  useEffect(() => {
    if (budgetError) Alert.alert('Presupuesto', budgetError);
  }, [budgetError]);

  const progress = useMemo(
    () => (budgets ?? []).find((b) => b && b.category === category),
    [budgets, category],
  );

  const handleSaveExpense = useCallback((draft: NewExpense) => {
    const snapshot = JSON.parse(JSON.stringify(draft)) as NewExpense;
    void dispatch(createExpense(snapshot))
      .unwrap()
      .then(() => setExpenseVisible(false))
      .catch(() => {});
  }, [dispatch]);

  const handleSaveBudget = useCallback((draft: NewBudget) => {
    void dispatch(upsertBudget({ ...draft })).unwrap().catch(() => {});
  }, [dispatch]);

  const handleDeleteBudget = useCallback((cat: string) => {
    setBudgetVisible(false);
    void dispatch(deleteBudget(cat)).unwrap().catch(() => {});
    router.back();
  }, [dispatch, router]);

  const cat = getCategoryConfig(category ?? 'OTHER');
  const { from } = formatMonthRange(new Date());
  const recent = useMemo(
    () => (items ?? []).filter((e) => e && e.category === category && e.date >= from),
    [items, category, from],
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        {loading ? (
          <Text color="textSecondary">Cargando...</Text>
        ) : !progress ? (
          <ThemedView type="backgroundElement" style={styles.empty}>
            <Text variant="smallBold">Sin presupuesto para {cat.label}</Text>
            <Button variant="primary" size="md" fullWidth onPress={() => setBudgetVisible(true)}>+ Agregar presupuesto</Button>
          </ThemedView>
        ) : (
          <>
            <ThemedView type="backgroundElement" style={styles.hero}>
              <View style={[styles.iconBox, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
                <Text style={styles.icon}>{cat.emoji}</Text>
              </View>
              <Text variant="h2">{cat.label}</Text>
              <Text variant="small" color="textSecondary">Presupuesto mensual</Text>
              <Text variant="h1">{formatCurrency(progress.limit, progress.currency as Currency)}</Text>
              <ProgressRing pct={progress.pct ?? 0} color={cat.color} />
              <View style={styles.numsRow}>
                <View style={styles.numBox}>
                  <Text variant="small" color="textSecondary">Gastado</Text>
                  <Text variant="smallBold">{formatCurrency(progress.spent ?? 0, progress.currency as Currency)}</Text>
                </View>
                <View style={styles.numBox}>
                  <Text variant="small" color="textSecondary">Disponible</Text>
                  <Text variant="smallBold">
                    {formatCurrency(Math.max((progress.limit ?? 0) - (progress.spent ?? 0), 0), progress.currency as Currency)}
                  </Text>
                </View>
              </View>
              {progress.over && <Text variant="small" color="danger">Over budget</Text>}
            </ThemedView>

            <Button variant="primary" size="md" fullWidth onPress={() => setExpenseVisible(true)}>
              {`+ Agregar ${cat.label.toLowerCase()}`}
            </Button>

            <Text variant="smallBold">Gastos recientes</Text>
            {recent.length === 0 ? (
              <Text variant="small" color="textSecondary">Sin gastos de {cat.label} este mes</Text>
            ) : (
              <View style={styles.list}>
                {recent.filter(Boolean).map((e) => (
                  <View key={e.id} style={styles.expenseRow}>
                    <View style={styles.cardFlex}>
                      <ExpenseCard expense={e} />
                    </View>
                    <Text variant="small" color="textSecondary">{formatDateLabel(e.date)}</Text>
                  </View>
                ))}
              </View>
            )}

            <Button variant="neutral" size="md" fullWidth onPress={() => setBudgetVisible(true)}>Aumentar presupuesto</Button>
          </>
        )}
      </ScrollView>

      <ManualExpenseModal
        visible={expenseVisible}
        saving={saving}
        onClose={() => setExpenseVisible(false)}
        onSave={handleSaveExpense}
        initial={{ category: (category ?? 'OTHER') as NewExpense['category'] }}
        defaultCurrency={defaultCurrency}
      />

      <BudgetModal
        visible={budgetVisible}
        saving={saving}
        budgets={(budgets ?? []).filter(Boolean).map((b) => ({ category: b.category, amount: b.limit, currency: b.currency }))}
        initialCategory={(category ?? 'OTHER') as NewExpense['category']}
        onClose={() => setBudgetVisible(false)}
        onSave={handleSaveBudget}
        onDelete={handleDeleteBudget}
        defaultCurrency={defaultCurrency}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  hero: { borderRadius: 20, padding: Spacing.four, gap: Spacing.two, alignItems: 'center', borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  iconBox: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  icon: { fontSize: 32 },
  numsRow: { flexDirection: 'row', gap: Spacing.four, width: '100%', justifyContent: 'center' },
  numBox: { alignItems: 'center', gap: 2 },
  list: { gap: Spacing.two },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardFlex: { flex: 1 },
  empty: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
});
