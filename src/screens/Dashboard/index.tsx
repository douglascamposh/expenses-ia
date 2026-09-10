import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, ChevronDown, Plus, Settings as SettingsIcon } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/EmptyState';
import { ExpenseCard } from '@/components/ExpenseCard';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';
import { ManualExpenseModal } from '@/components/ManualExpenseModal';
import { UnifiedCategories } from '@/components/UnifiedCategories';
import { UnifiedVoiceModal } from '@/components/UnifiedVoiceModal';
import { VoiceButton } from '@/components/VoiceButton';
import { Text, Button, Chip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { isValidCurrency } from '@/expenses/models/Expense';
import type { NewExpense } from '@/expenses/models/Expense';
import { validateExpenseCommand } from '@/expenses/services/ExpenseService';
import { formatCurrency, formatMonthLabel } from '@/expenses/utils/format';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { useAnalyzeAudio } from '@/hooks/use-analyze-audio';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearPending,
  createExpense,
  deleteExpense,
  fetchExpenses,
  saveAllExpenses,
  saveOneExpense,
  setPendingQueue,
  updateExpense,
} from '@/store/expensesSlice';

export function DashboardScreen() {
  const router = useRouter();
  const audio = useAudioRecording();
  const analyzer = useAnalyzeAudio();
  const dispatch = useAppDispatch();
  const recent = useAppSelector((s) => s.expenses.recent ?? []);
  const summary = useAppSelector((s) => s.expenses.summary ?? []);
  const totalMonth = useAppSelector((s) => s.expenses.totalMonth ?? {});
  const loading = useAppSelector((s) => s.expenses.loading);
  const error = useAppSelector((s) => s.expenses.error);
  const pendingQueue = useAppSelector((s) => s.expenses.pendingQueue ?? []);
  const saving = useAppSelector((s) => s.expenses.saving);
  const saveError = useAppSelector((s) => s.expenses.saveError);
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const insets = useSafeAreaInsets();
  // Mic flotante encima del tab bar, sin tocarlo (tab iOS ~49 / Android ~70 + aire 12).
  const micBottom = insets.bottom + (Platform.OS === 'ios' ? 61 : 82);
  /** Moneda válida o la por defecto (nunca entra inválida a la cola). */
  const normalizeCurrency = useCallback(
    (c: unknown): NewExpense['currency'] =>
      typeof c === 'string' && isValidCurrency(c) ? c : defaultCurrency,
    [defaultCurrency],
  );
  const refresh = useCallback(() => dispatch(fetchExpenses(10)).unwrap(), [dispatch]);
  const [selected, setSelected] = useState<import('@/expenses/models/Expense').Expense | null>(null);
  const [manualVisible, setManualVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchExpenses(10));
  }, [dispatch]);

  useEffect(() => {
    if (saveError) Alert.alert('No se pudo guardar', saveError);
  }, [saveError]);

  const voiceButtonState = audio.isRecording
    ? 'recording' as const
    : audio.state === 'processing' || analyzer.isLoading
      ? 'processing' as const
      : analyzer.status === 'loading'
        ? 'understanding' as const
        : 'idle' as const;

  const unifiedPhase = audio.isRecording ? 'recording' as const : analyzer.isLoading ? 'analyzing' as const : (pendingQueue ?? []).length > 0 ? 'results' as const : null;
  const unifiedVisible = !!unifiedPhase;

  const handleCancelAnalyzing = useCallback(() => {
    analyzer.reset();
    dispatch(clearPending());
  }, [analyzer, dispatch]);

  const handleDismissResults = useCallback(() => {
    analyzer.reset();
    dispatch(clearPending());
  }, [analyzer, dispatch]);

  const handleVoicePress = useCallback(async () => {
    if (audio.isRecording) {
      const res = await audio.stopRecording();
      if (res) {
        try {
          const result = await analyzer.analyze(res.filePath);
          const rawExpenses = result.expenses ?? [];
          console.log('Gastos detectados:', rawExpenses);
          if ((rawExpenses ?? []).length === 0) {
            Alert.alert('Sin gastos', 'No se detectaron gastos en el audio');
            return;
          }
          const queue: NewExpense[] = [];
          for (const raw of (rawExpenses ?? []).filter(Boolean)) {
            const cmd = {
              action: 'CREATE_EXPENSE',
              expense: {
                amount: Number((raw as Record<string, unknown>).amount),
                currency: normalizeCurrency((raw as Record<string, unknown>).currency),
                category: String((raw as Record<string, unknown>).category || 'OTHER'),
                description: String((raw as Record<string, unknown>).description || 'Gasto'),
                date: String((raw as Record<string, unknown>).date || new Date().toISOString().split('T')[0]),
                // El backend envía paymentMethod (CASH/CARD); default CASH si falta.
                // Editable en el modal antes de guardar.
                paymentMethod: String((raw as Record<string, unknown>).paymentMethod || 'CASH'),
                confidence: (raw as Record<string, unknown>).confidence as number | undefined,
              },
            };
            const v = validateExpenseCommand(cmd);
            if (v.valid && v.normalized) queue.push(v.normalized);
            else
              queue.push({
                amount: Number((raw as Record<string, unknown>).amount) || 0,
                currency: normalizeCurrency((raw as Record<string, unknown>).currency),
                category: (String((raw as Record<string, unknown>).category) as NewExpense['category']) || 'OTHER',
                description: String((raw as Record<string, unknown>).description || ''),
                date: String((raw as Record<string, unknown>).date || new Date().toISOString().split('T')[0]),
                paymentMethod: 'CASH',
              });
          }
          dispatch(setPendingQueue(queue));
        } catch (e) {
          Alert.alert('No se pudo entender', (e as Error).message);
        }
      }
    } else {
      analyzer.reset();
      await audio.startRecording();
    }
  }, [audio, analyzer, dispatch, normalizeCurrency]);

  const handleSaveOne = useCallback(
    (index: number, e: NewExpense) => {
      try {
        if (!e || typeof e !== 'object' || typeof index !== 'number') return;
        // Snapshot serializable: el thunk guarda en SQLite y actualiza Redux.
        // No se usa closure de pendingQueue -> no hay stale context.
        const snapshot = JSON.parse(JSON.stringify(e)) as NewExpense;
        void dispatch(saveOneExpense({ index, draft: snapshot }))
          .unwrap()
          .catch((err) => {
            /* saveError ya se muestra vía useEffect */
            if (__DEV__) console.error('[SaveOne] thunk rechazado:', err);
          });
      } catch (err) {
        // Diagnóstico dev: expone el stack JS real (LogBox solo muestra component stack)
        if (__DEV__) console.error('[SaveOne] throw síncrono:', (err as Error)?.stack ?? err);
        Alert.alert('No se pudo guardar', (err as Error)?.message ?? 'Error inesperado');
      }
    },
    [dispatch],
  );

  const handleSaveAll = useCallback(
    (expenses: NewExpense[]) => {
      try {
        const safe = (Array.isArray(expenses) ? expenses : []).filter(Boolean).map((e) => JSON.parse(JSON.stringify(e)) as NewExpense);
        if (safe.length === 0) return;
        void dispatch(saveAllExpenses({ drafts: safe }))
          .unwrap()
          .catch((err) => {
            if (__DEV__) console.error('[SaveAll] thunk rechazado:', err);
          });
      } catch (err) {
        if (__DEV__) console.error('[SaveAll] throw síncrono:', (err as Error)?.stack ?? err);
        Alert.alert('No se pudo guardar', (err as Error)?.message ?? 'Error inesperado');
      }
    },
    [dispatch],
  );

  const handleSaveManual = useCallback(
    (draft: NewExpense) => {
      // Snapshot serializable; el thunk createExpense guarda en SQLite y refresca.
      // El modal solo se cierra si el guardado cumple (saveError se muestra vía useEffect).
      const snapshot = JSON.parse(JSON.stringify(draft)) as NewExpense;
      void dispatch(createExpense(snapshot))
        .unwrap()
        .then(() => setManualVisible(false))
        .catch(() => {});
    },
    [dispatch],
  );

  // ExpenseDetailModal ya confirma con DeleteConfirm (mockup) antes de llamar aquí.
  const handleDelete = useCallback(
    async (id: string) => {
      setSelected(null);
      void dispatch(deleteExpense(id)).unwrap().catch(() => {});
    },
    [dispatch],
  );

  const safeTotalMonth = totalMonth ?? {};
  const totalsByCurrency = Object.entries(safeTotalMonth);
  const monthTotalPrimary = (() => {
    if (safeTotalMonth[defaultCurrency] !== undefined) return formatCurrency(safeTotalMonth[defaultCurrency], defaultCurrency);
    const firstKey = Object.keys(safeTotalMonth)[0] as NewExpense['currency'] | undefined;
    if (firstKey) return formatCurrency(safeTotalMonth[firstKey], firstKey);
    return formatCurrency(0, defaultCurrency);
  })();

  const thisMonthLabel = formatMonthLabel(new Date());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header mockup: September + gear */}
          <View style={styles.topBar}>
            <Pressable style={styles.monthPicker}>
              <Text variant="smallBold" style={styles.monthText}>{thisMonthLabel}</Text>
              <ChevronDown size={16} color="#0F172A" />
            </Pressable>
            <View style={styles.topBarActions}>
              <Pressable accessibilityLabel="Agregar gasto manual" onPress={() => setManualVisible(true)} style={styles.gearBtn}>
                <Plus size={18} color="#2F80FF" />
              </Pressable>
              <Pressable accessibilityLabel="Settings" onPress={() => router.push('/settings' as never)} style={styles.gearBtn}>
                <SettingsIcon size={18} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* Spent this month card - mockup */}
          <ThemedView type="backgroundElement" style={styles.spentCard}>
            <View style={styles.spentTop}>
              <View>
                <Text variant="small" color="textSecondary">Spent this month</Text>
                <Text variant="h1" style={styles.spentAmount}>{loading ? '...' : monthTotalPrimary}</Text>
                {totalsByCurrency.length > 1 && (
                  <View style={styles.currencyRowSmall}>
                    {totalsByCurrency.map(([cur, total]) => (
                      <Text key={cur} variant="small" color="textSecondary">{formatCurrency(total, cur as NewExpense['currency'])} {cur !== defaultCurrency ? `· ${cur}` : ''}</Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.chartIcon}>
                <BarChart3 size={20} color="#2F80FF" />
              </View>
            </View>
          </ThemedView>

          {/* Categorías unificadas estilo mockup: cada una sale una sola vez */}
          <UnifiedCategories
            loading={loading}
            budgets={budgets}
            summary={summary}
            onOpenCategory={(category) => router.push(`/budgets/${category}` as never)}
            onSeeAll={() => router.push('/budgets' as never)}
          />

          {/* Filtros básicos -> Chip genérico */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Chip label="Todos" selected={!filterCategory} onPress={() => setFilterCategory(null)} />
            {(summary ?? []).filter(Boolean).map((s) => {
              const cat = getCategoryConfig(s.category);
              const active = filterCategory === s.category;
              return <Chip key={`${s.category}-${s.currency}`} label={cat.label} icon={cat.emoji} selected={active} onPress={() => setFilterCategory(active ? null : s.category)} />;
            })}
          </ScrollView>

          {/* Recent expenses - mockup */}
          <View style={styles.sectionHeader}>
            <Text variant="smallBold">Recent expenses</Text>
            <View style={styles.sectionHeaderRight}>
              {filterCategory && (
                <Pressable onPress={() => setFilterCategory(null)}>
                  <Text variant="small" color="textSecondary">Limpiar</Text>
                </Pressable>
              )}
              <Pressable onPress={() => router.push('/explore')}>
                <Text variant="small" color="textSecondary">See all</Text>
              </Pressable>
            </View>
          </View>

          {/* Demo offline banner - hide by default, muestra mockup 9 */}
          {/* <OfflineBanner /> */}

          {loading ? (
            <Text color="textSecondary">Cargando gastos...</Text>
          ) : error ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <Text color="danger">No se pudo cargar</Text>
              <Button variant="neutral" size="sm" onPress={() => void refresh().catch(() => {})}>Reintentar</Button>
            </ThemedView>
          ) : (recent ?? []).length === 0 ? (
            <EmptyState />
          ) : (
            <View style={styles.list}>
              {(filterCategory ? (recent ?? []).filter((e) => e?.category === filterCategory) : (recent ?? [])).filter(Boolean).map((e) => (
                <ExpenseCard key={e.id} expense={e} onPress={() => setSelected(e)} />
              ))}
              {filterCategory && (recent ?? []).filter((e) => e?.category === filterCategory).length === 0 && (
                <Text variant="small" color="textSecondary">Sin gastos en {getCategoryConfig(filterCategory).label}</Text>
              )}
            </View>
          )}

          <View style={styles.footerSpace} />
        </ScrollView>

        {/* Mic flotante encima del tab bar, sin tocarlo */}
        <View style={[styles.micDock, { bottom: micBottom }]} pointerEvents="box-none">
          <VoiceButton state={voiceButtonState} onPress={handleVoicePress} disabled={analyzer.isLoading || audio.state === 'processing'} />
          {audio.errorMessage && <Text variant="small" color="danger" style={styles.voiceError}>{audio.errorMessage}</Text>}
          {analyzer.error && <Text variant="small" color="danger" style={styles.voiceError}>{analyzer.error}</Text>}
        </View>
      </SafeAreaView>

      {/* Mismo modal para recording -> loading -> resultados pequeño (no se toca mic central) */}
      <UnifiedVoiceModal
        visible={unifiedVisible}
        phase={unifiedPhase}
        expenses={pendingQueue}
        onStop={handleVoicePress}
        onClose={() => void audio.stopRecording()}
        onCancelAnalyzing={handleCancelAnalyzing}
        onSaveOne={handleSaveOne}
        onSaveAll={handleSaveAll}
        onDismissResults={handleDismissResults}
        saving={saving}
      />

      {/* Alta manual */}
      <ManualExpenseModal
        visible={manualVisible}
        saving={saving}
        onClose={() => setManualVisible(false)}
        onSave={handleSaveManual}
        defaultCurrency={defaultCurrency}
      />

      {/* Detail - genérico */}
      <ExpenseDetailModal
        expense={selected as import('@/expenses/models/Expense').Expense}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        onEdit={(patch) => {
          if (!selected) return;
          const id = selected.id;
          setSelected(null);
          void dispatch(updateExpense({ id, patch })).unwrap().catch(() => {});
        }}
        saving={saving}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 100 },
  // Top bar mockup
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.one },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthText: { fontSize: 16, textTransform: 'capitalize' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gearBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  micDock: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6, zIndex: 10 },
  // Spent card
  spentCard: { borderRadius: 16, padding: Spacing.three, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF', shadowColor: 'rgba(45,125,255,0.08)', shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  spentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  spentAmount: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  vsText: { color: '#0EB07B', fontSize: 12, fontWeight: '600' },
  currencyRowSmall: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', marginTop: 4 },
  chartIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6E9F2' },
  // Spending
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  sectionHeaderRight: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#fff' },
  filterActive: { backgroundColor: '#2F80FF1A', borderColor: '#2F80FF' },
  currencyRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', justifyContent: 'center' },
  list: { gap: Spacing.two },
  emptyCard: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  emptyHint: { textAlign: 'center' },
  error: { color: '#EF4444' },
  retry: { padding: 8, borderWidth: 1, borderColor: '#E6E9F2', borderRadius: 999, paddingHorizontal: 16 },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.12)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  analyzingCard: { borderRadius: 16, padding: Spacing.four, gap: Spacing.one, alignItems: 'center', borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF', shadowColor: 'rgba(45,125,255,0.12)', shadowRadius: 12, elevation: 4 },
  voiceError: { color: '#EF4444', textAlign: 'center', paddingHorizontal: Spacing.four },
  footerSpace: { height: 40 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: Spacing.three },
  detailCard: { borderRadius: 20, padding: Spacing.four, gap: Spacing.two, alignItems: 'center', borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  detailTopBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detailIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  detailTitle: { fontSize: 16, color: '#0F172A', marginTop: 4 },
  detailAmount: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  detailBadgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E6E9F2' },
  detailDateRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },
  detailEmoji: { fontSize: 36 },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 8 },
  editBox: { width: '100%', gap: Spacing.two },
  input: { borderWidth: 1, borderColor: '#E6E9F2', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#fff' },
  catActive: { backgroundColor: '#2F80FF1A', borderColor: '#2F80FF' },
  row: { flexDirection: 'row', gap: 8 },
  currChip: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E6E9F2', alignItems: 'center', backgroundColor: '#fff' },
  detailActions: { flexDirection: 'row', gap: Spacing.three, width: '100%', marginTop: Spacing.two },
  btn: { flex: 1, padding: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1 },
  btnGhost: { backgroundColor: '#fff', borderColor: '#2F80FF' },
  btnDeleteOutline: { backgroundColor: '#fff', borderColor: '#FECACA' },
  btnDanger: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  btnPrimary: { backgroundColor: '#2F80FF', borderColor: '#2F80FF' },
  inputRow: { gap: 6 },
});
