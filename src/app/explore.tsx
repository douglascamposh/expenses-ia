import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Search } from 'lucide-react-native';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { EmptyState } from '@/components/EmptyState';
import { ThemedView } from '@/components/themed-view';
import { Text, Button } from '@/components/ui';
import { ExpenseCard } from '@/components/ExpenseCard';
import { Spacing } from '@/constants/theme';
import type { Expense, PaymentMethod } from '@/expenses/models/Expense';
import { getPaymentEmoji, getPaymentLabel } from '@/expenses/models/Expense';
import { formatDateLabel } from '@/expenses/utils/format';
import { getDbVersion } from '@/database/sqlite';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { backfillEmbeddings, clearSemanticSearch, deleteExpense, fetchExpenses, semanticSearch } from '@/store/expensesSlice';

export default function ExpensesScreen() {
  const dispatch = useAppDispatch();
  const expenses = useAppSelector((s) => s.expenses.items ?? []);
  const loading = useAppSelector((s) => s.expenses.loading);
  const semanticIds = useAppSelector((s) => s.expenses.semanticIds);
  const searchMode = useAppSelector((s) => s.expenses.searchMode ?? 'keyword');
  const [version, setVersion] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [payFilter, setPayFilter] = useState<PaymentMethod | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void dispatch(fetchExpenses(10))
      .unwrap()
      .catch(() => {});
    void getDbVersion()
      .then((v) => setVersion(v ?? null))
      .catch(() => {});
    // Rescata vectores de guardados offline/cuando el embed inmediato falló
    void dispatch(backfillEmbeddings({})).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    void getDbVersion()
      .then((v) => setVersion(v ?? null))
      .catch(() => {});
    // Backfill de vectores al entrar (fondo, con tope por corrida)
    void dispatch(backfillEmbeddings({})).catch(() => {});
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    void dispatch(deleteExpense(id)).unwrap().catch(() => {});
  };

  // Búsqueda explícita al pulsar la lupa: si falla (sin red/sin índice), keyword.
  const handleSearch = useCallback(() => {
    const q = query.trim();
    if (q.length < 2) {
      dispatch(clearSemanticSearch());
      return;
    }
    void dispatch(semanticSearch(q)).unwrap().catch(() => {});
  }, [query, dispatch]);

  const filtered = useMemo(() => {
    const safeExpenses = expenses ?? [];
    const byPay = payFilter ? safeExpenses.filter((e) => e && (e.paymentMethod ?? 'CASH') === payFilter) : safeExpenses;
    // Semántico: ordenar por ranking del índice (los no rankeados quedan fuera)
    if (searchMode === 'semantic' && Array.isArray(semanticIds)) {
      const rank = new Map(semanticIds.map((id, i) => [id, i]));
      return byPay
        .filter((e) => e && rank.has(e.id))
        .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }
    if (!query.trim()) return byPay;
    const q = query.toLowerCase();
    return byPay.filter((e) => e && (e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)));
  }, [expenses, query, payFilter, searchMode, semanticIds]);

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar"
            onPress={handleSearch}
            style={styles.searchIcon}
          >
            <Search size={18} color="#64748B" />
          </Pressable>
        </View>

        <TextInput value={query} onChangeText={setQuery} placeholder="Search..." style={styles.searchInput} placeholderTextColor="#94A3B8" />

        <View style={styles.payRow}>
          {(['CASH', 'CARD'] as const satisfies readonly PaymentMethod[]).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              onPress={() => setPayFilter((prev) => (prev === m ? null : m))}
              style={[styles.payChip, payFilter === m && styles.payChipActive]}
            >
              <Text variant="small" color={payFilter === m ? 'primary' : 'textSecondary'}>
                {getPaymentEmoji(m)} {getPaymentLabel(m)}
              </Text>
            </Pressable>
          ))}
          {payFilter && (
            <Pressable accessibilityRole="button" onPress={() => setPayFilter(null)}>
              <Text variant="small" color="textSecondary">Limpiar</Text>
            </Pressable>
          )}
        </View>

        <Text variant="small" color="textSecondary">
          {(expenses ?? []).length} registros {version !== null ? `· DB v${version}` : ''}
          {query.trim().length >= 2 ? (searchMode === 'semantic' ? ' · Búsqueda IA' : ' · Búsqueda por texto') : ''}
        </Text>

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
          <Text variant="small" color="textSecondary">Tabla: expenses (id, amount, currency, category, description, date, payment_method, confidence, created_at, updated_at)</Text>
        </View>
      </ScrollView>
      <DeleteConfirm visible={deleteId !== null} onCancel={() => setDeleteId(null)} onDelete={confirmDelete} />
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
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  payChipActive: { borderColor: '#2F80FF', backgroundColor: '#2F80FF1A' },
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
