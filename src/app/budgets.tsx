import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft } from 'lucide-react-native';
import type { Swipeable } from 'react-native-gesture-handler';
import { ThemedView } from '@/components/themed-view';
import { BudgetCategoryRow } from '@/components/BudgetCategoryRow';
import { ThresholdSlider } from '@/components/ThresholdSlider';
import { Text, Button } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import { SYSTEM_CATEGORY, getAllCategories } from '@/expenses/categories/expenseCategories';
import type { Currency } from '@/expenses/models/Expense';
import type { NewBudget } from '@/expenses/models/Budget';
import { formatCurrency, formatMonthLabel } from '@/expenses/utils/format';
import { useTranslation } from '@/i18n/useTranslation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deleteBudget, fetchExpenses, upsertBudget } from '@/store/expensesSlice';
import { fetchCategories } from '@/store/categoriesSlice';
import { setBudgetAlertThreshold, setBudgetAlertsEnabled } from '@/store/settingsSlice';
import { ensurePermissions } from '@/services/budget-alerts';
import { useTheme } from '@/hooks/use-theme';

export default function BudgetsScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const loading = useAppSelector((s) => s.expenses.loading);
  const budgetError = useAppSelector((s) => s.expenses.budgetError);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const alertsEnabled = useAppSelector((s) => s.settings.budgetAlertsEnabled ?? false);
  const alertThreshold = useAppSelector((s) => s.settings.budgetAlertThreshold ?? 80);
  const visibleMonth = useAppSelector((s) => s.expenses.visibleMonth);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Arrastre del slider: desactiva el scroll padre para no pelear el gesto. */
  const [sliding, setSliding] = useState(false);

  /** Filas swipe abiertas: solo una a la vez. */
  const swipeRefs = useRef(new Map<string, Swipeable | null>());
  const closeOtherRows = useCallback((exceptId: string) => {
    swipeRefs.current.forEach((row, id) => {
      if (id !== exceptId) row?.close();
    });
  }, []);

  useEffect(() => {
    void dispatch(fetchExpenses(10));
    void dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (budgetError) Alert.alert(t('budgets_alert'), budgetError);
  }, [budgetError, t]);

  /** Todas las categorías de gasto (mockup): con y sin presupuesto. */
  const rows = useMemo(() => {
    const progressByCat = new Map((budgets ?? []).filter(Boolean).map((b) => [String(b.category), b]));
    return getAllCategories()
      .filter((c) => c && (c.kind === 'GASTO' || String(c.id) === String(SYSTEM_CATEGORY.id)))
      .map((c) => ({ config: c, progress: progressByCat.get(String(c.id)) ?? null }));
  }, [budgets]);

  const withBudget = rows.filter((r) => r.progress && (r.progress.limit ?? 0) > 0);
  const withoutBudget = rows.filter((r) => !r.progress || !((r.progress.limit ?? 0) > 0));

  const handleSave = useCallback((category: string) => (amount: number) => {
    const draft: NewBudget = { category: category as NewBudget['category'], amount, currency: defaultCurrency };
    void dispatch(upsertBudget(draft))
      .unwrap()
      .then(() => setExpandedId(null))
      .catch(() => {});
  }, [dispatch, defaultCurrency]);

  const handleDelete = useCallback((category: string) => {
    void dispatch(deleteBudget(category)).unwrap().catch(() => {});
  }, [dispatch]);

  const handleToggleAlerts = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(t('budgets_alertsTitle'), t('budgets_alertDenied'));
        return;
      }
    }
    void dispatch(setBudgetAlertsEnabled(next)).unwrap().catch(() => {});
  }, [dispatch, t]);

  const handleThreshold = useCallback((n: number) => {
    void dispatch(setBudgetAlertThreshold(n)).unwrap().catch(() => {});
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
  const monthLabel = formatMonthLabel(new Date(visibleMonth.year, visibleMonth.month - 1, 1), lang);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!sliding}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel={t('budgets_a11yBack')} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ChevronLeft size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('budgets_title')}</Text>
        </View>

        <View style={[styles.alertsCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.alertsRow}>
            <Text style={styles.alertsEmoji}>🔔</Text>
            <Text variant="smallBold" style={styles.alertsTitle}>{t('budgets_alertsTitle')}</Text>
            <Switch
              value={alertsEnabled}
              onValueChange={(v) => void handleToggleAlerts(v)}
              trackColor={{ false: theme.border, true: '#F0524D' }}
              thumbColor="#FFFFFF"
              testID="budget-alerts-toggle"
            />
          </View>
          <View style={styles.alertsRow}>
            <Text variant="small" color="textSecondary">{t('budgets_alertThreshold')}</Text>
            <Text variant="smallBold">{alertThreshold}%</Text>
          </View>
          <ThresholdSlider value={alertThreshold} onCommit={handleThreshold} onSlidingChange={setSliding} />
        </View>

        <View style={[styles.monthPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <CalendarDays size={14} color={theme.textSecondary} />
          <Text variant="small" color="textSecondary" style={styles.monthText}>{monthLabel}</Text>
        </View>

        {loading ? (
          <Text color="textSecondary">{t('budgets_loading')}</Text>
        ) : (
          <>
            {primary && (
              <ThemedView type="backgroundElement" style={[styles.totalCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text variant="small" color="textSecondary">{t('budgets_totalTitle')}</Text>
                <Text variant="h1" style={[styles.totalAmount, { color: theme.text }]}>
                  {formatCurrency(primary[1].spent, primary[0])} / {formatCurrency(primary[1].limit, primary[0])}
                </Text>
                <View style={[styles.totalBarBg, { backgroundColor: theme.border }]}>
                  <View style={[styles.totalBarFill, { backgroundColor: theme.primary, width: `${primaryPct}%` as unknown as number }]} />
                </View>
                <Text variant="caption" color="textSecondary" style={styles.usedText}>{t('budgets_usedPct', { n: Math.round(primaryPct) })}</Text>
                {totals.filter(([cur]) => cur !== primary[0]).map(([cur, t]) => (
                  <Text key={cur} variant="small" color="textSecondary">
                    {formatCurrency(t.spent, cur)} / {formatCurrency(t.limit, cur)}
                  </Text>
                ))}
              </ThemedView>
            )}

            {rows.length === 0 ? (
              <ThemedView type="backgroundElement" style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text variant="small" color="textSecondary" align="center">{t('budgets_emptyHint')}</Text>
                <Button variant="primary" size="md" fullWidth onPress={() => router.push('/categories' as never)}>{t('categories_newCategory')}</Button>
              </ThemedView>
            ) : (
              <>
                {withBudget.length > 0 && (
                  <>
                    <Text variant="small" color="textSecondary" style={styles.sectionLabel}>{t('budgets_withBudget')}</Text>
                    {withBudget.map(({ config, progress }) => (
                      <BudgetCategoryRow
                        key={String(config.id)}
                        config={config}
                        progress={progress}
                        currency={defaultCurrency}
                        expanded={expandedId === String(config.id)}
                        onToggle={() => setExpandedId((prev) => (prev === String(config.id) ? null : String(config.id)))}
                        onSave={handleSave(String(config.id))}
                        onTrashPress={handleDelete}
                        swipeRefs={swipeRefs}
                        onOpen={closeOtherRows}
                      />
                    ))}
                  </>
                )}
                {withoutBudget.length > 0 && (
                  <>
                    <Text variant="small" color="textSecondary" style={styles.sectionLabel}>{t('budgets_withoutBudget')}</Text>
                    {withoutBudget.map(({ config, progress }) => (
                      <BudgetCategoryRow
                        key={String(config.id)}
                        config={config}
                        progress={progress}
                        currency={defaultCurrency}
                        expanded={expandedId === String(config.id)}
                        onToggle={() => setExpandedId((prev) => (prev === String(config.id) ? null : String(config.id)))}
                        onSave={handleSave(String(config.id))}
                        onTrashPress={handleDelete}
                        swipeRefs={swipeRefs}
                        onOpen={closeOtherRows}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, flex: 1 },
  alertsCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  alertsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  alertsEmoji: { fontSize: 22 },
  alertsTitle: { flex: 1, fontFamily: Fonts.sans },
  monthPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  monthText: { textTransform: 'capitalize', fontFamily: Fonts.sans },
  sectionLabel: { fontFamily: Fonts.sans },
  totalCard: { borderRadius: 16, padding: Spacing.three, gap: 6, borderWidth: 1 },
  totalAmount: { fontSize: 24, fontWeight: '800', fontFamily: Fonts.sans },
  totalBarBg: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  totalBarFill: { height: 8, borderRadius: 4 },
  usedText: { alignSelf: 'flex-end', fontFamily: Fonts.sans },
  empty: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1 },
});
