import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Search } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedView } from '@/components/themed-view';
import { Text, Button } from '@/components/ui';
import { ExpenseCard } from '@/components/ExpenseCard';
import { Spacing } from '@/constants/theme';
import type { Expense } from '@/expenses/models/Expense';
import { formatDateLabel } from '@/expenses/utils/format';
import { getDbVersion } from '@/database/sqlite';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deleteExpense, fetchExpenses } from '@/store/expensesSlice';

export default function ExpensesScreen() {
  const dispatch = useAppDispatch();
  const expenses = useAppSelector((s) => s.expenses.items ?? []);
  const loading = useAppSelector((s) => s.expenses.loading);
  const [version, setVersion] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => {
    void dispatch(fetchExpenses(10))
      .unwrap()
      .catch(() => {});
    void getDbVersion()
      .then((v) => setVersion(v ?? null))
      .catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    void getDbVersion()
      .then((v) => setVersion(v ?? null))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar?', 'No se puede deshacer', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void dispatch(deleteExpense(id)).unwrap().catch(() => {});
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    const safeExpenses = expenses ?? [];
    if (!query.trim()) return safeExpenses;
    const q = query.toLowerCase();
    return safeExpenses.filter((e) => e && (e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)));
  }, [expenses, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    const safeFiltered = Array.isArray(filtered) ? filtered : [];
    for (const e of safeFiltered) {
      if (!e || !e.date) continue;
      const label = formatDateLabel(e.date);
      // Map Hoy/Ayer to Today/Yesterday for mockup alignment
      const key = label === 'Hoy' ? 'Today' : label === 'Ayer' ? 'Yesterday' : label;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text variant="h2" style={styles.title}>Expenses</Text>
          <View style={styles.searchIcon}>
            <Search size={18} color="#64748B" />
          </View>
        </View>

        <TextInput value={query} onChangeText={setQuery} placeholder="Search..." style={styles.searchInput} placeholderTextColor="#94A3B8" />

        <Text variant="small" color="textSecondary">{(expenses ?? []).length} registros {version !== null ? `· DB v${version}` : ''}</Text>

        {loading ? (
          <Text>Cargando...</Text>
        ) : (filtered ?? []).length === 0 ? (
          (expenses ?? []).length === 0 ? (
            <EmptyState />
          ) : (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <Text variant="small" color="textSecondary">Sin resultados para &quot;{query}&quot;</Text>
            </ThemedView>
          )
        ) : (
          <View style={styles.grouped}>
            {(grouped ?? []).map(([dateLabel, items]) => (
              <View key={dateLabel} style={styles.group}>
                <Text variant="smallBold" style={styles.groupLabel}>{dateLabel}</Text>
                <View style={styles.list}>
                  {(items ?? []).filter(Boolean).map((e) => (
                    <View key={e.id} style={styles.row}>
                      <View style={styles.cardFlex}>
                        <ExpenseCard expense={e} />
                      </View>
                      <Button variant="dangerOutline" size="sm" onPress={() => handleDelete(e.id)}>Eliminar</Button>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.diagnostics}>
          <Text variant="smallBold">Diagnostics</Text>
          <Text variant="small" color="textSecondary">DB: SQLite {version !== null ? `v${version}` : '...'} · Offline-first · Sin cloud</Text>
          <Text variant="small" color="textSecondary">Tabla: expenses (id, amount, currency, category, description, date, confidence, created_at, updated_at)</Text>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  searchIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2', alignItems: 'center', justifyContent: 'center' },
  searchInput: { borderWidth: 1, borderColor: '#E6E9F2', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  grouped: { gap: Spacing.four },
  group: { gap: Spacing.two },
  groupLabel: { color: '#0F172A' },
  list: { gap: Spacing.two },
  row: { gap: Spacing.one },
  cardFlex: { flex: 1 },
  deleteBtn: { alignSelf: 'flex-end', padding: 6 },
  deleteText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  empty: { padding: Spacing.four, borderRadius: 16, alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  diagnostics: { marginTop: Spacing.four, gap: 4, padding: Spacing.three, borderRadius: 16, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E6E9F2' },
});
