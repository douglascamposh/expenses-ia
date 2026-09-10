import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, CircleDollarSign, FileText, Info, Layers, Palette, PiggyBank, Shield, Cpu } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { BudgetModal } from '@/components/BudgetModal';
import { CurrencyModal } from '@/components/CurrencyModal';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { NewBudget } from '@/expenses/models/Budget';
import type { Currency } from '@/expenses/models/Expense';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deleteBudget, fetchExpenses, upsertBudget } from '@/store/expensesSlice';
import { setDefaultCurrency } from '@/store/settingsSlice';

const R = { lg: 16 } as const;

export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const saving = useAppSelector((s) => s.expenses.saving);
  const budgetError = useAppSelector((s) => s.expenses.budgetError);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const [budgetVisible, setBudgetVisible] = useState(false);
  const [currencyVisible, setCurrencyVisible] = useState(false);

  useEffect(() => {
    void dispatch(fetchExpenses(10));
  }, [dispatch]);

  useEffect(() => {
    if (budgetError) Alert.alert('Presupuesto', budgetError);
  }, [budgetError]);

  const handleSaveBudget = useCallback((draft: NewBudget) => {
    void dispatch(upsertBudget({ ...draft })).unwrap().catch(() => {});
  }, [dispatch]);

  const handleDeleteBudget = useCallback((category: string) => {
    void dispatch(deleteBudget(category)).unwrap().catch(() => {});
  }, [dispatch]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.title}>Settings</Text>

        <ThemedView type="backgroundElement" style={styles.card}>
          <SettingRow icon={Palette} label="Appearance" value="Light mode" />
          <View style={styles.divider} />
          <SettingRow icon={CircleDollarSign} label="Currency" value={defaultCurrency} onPress={() => setCurrencyVisible(true)} />
          <View style={styles.divider} />
          <SettingRow icon={Layers} label="Categories" onPress={() => router.push('/categories' as never)} />
          <View style={styles.divider} />
          <SettingRow icon={PiggyBank} label="Budgets" value={budgets.length > 0 ? `${budgets.length} activos` : 'Sin definir'} onPress={() => setBudgetVisible(true)} />
          <View style={styles.divider} />
          <SettingRow icon={Cpu} label="AI Diagnostics" />
        </ThemedView>

        <Text variant="smallBold" style={styles.aboutLabel}>About</Text>
        <ThemedView type="backgroundElement" style={styles.card}>
          <SettingRow icon={Info} label="App version" value="1.0.0" chevron={false} />
          <View style={styles.divider} />
          <SettingRow icon={Shield} label="Privacy Policy" />
          <View style={styles.divider} />
          <SettingRow icon={FileText} label="Terms of Service" />
        </ThemedView>
      </ScrollView>

      <BudgetModal
        visible={budgetVisible}
        saving={saving}
        budgets={budgets.map((b) => ({ category: b.category, amount: b.limit, currency: b.currency }))}
        onClose={() => setBudgetVisible(false)}
        onSave={handleSaveBudget}
        onDelete={handleDeleteBudget}
        defaultCurrency={defaultCurrency}
      />
      <CurrencyModal
        visible={currencyVisible}
        selected={defaultCurrency}
        onClose={() => setCurrencyVisible(false)}
        onSelect={(cur: Currency) => {
          setCurrencyVisible(false);
          void dispatch(setDefaultCurrency(cur)).unwrap().catch(() => {});
        }}
      />
    </ThemedView>
  );
}

function SettingRow({ icon: Icon, label, value, chevron = true, onPress }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value?: string; chevron?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.row} accessibilityRole="button" onPress={onPress}>
      <View style={styles.iconBox}>
        <Icon size={16} color="#2F80FF" />
      </View>
      <Text variant="smallBold" style={styles.rowLabel}>{label}</Text>
      {value && <Text variant="small" color="textSecondary">{value}</Text>}
      {chevron && <ChevronRight size={16} color="#64748B" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: R.lg, paddingVertical: 4, paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: '#E6E9F2', gap: 0 },
  divider: { height: 1, backgroundColor: '#E6E9F2' },
  aboutLabel: { marginTop: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1 },
  chevron: { fontSize: 18, marginLeft: 4 },
});


