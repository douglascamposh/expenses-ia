import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Pause, Play, Trash2 } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { RECUR_LABEL_KEYS } from '@/components/QuickExpenseForm';
import { Button, Text } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { generateForRule } from '@/expenses/services/recurring';
import type { EntryKind } from '@/expenses/models/Expense';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRules, removeRule, updateRule } from '@/store/recurringSlice';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'ALL' | EntryKind;

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function RecurringScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const rules = useAppSelector((s) => s.recurring?.rules ?? []);
  const loading = useAppSelector((s) => s.recurring?.loading ?? false);
  const saveError = useAppSelector((s) => s.recurring?.saveError ?? null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchRules());
  }, [dispatch]);

  useEffect(() => {
    if (saveError) Alert.alert(t('recurring_alert'), saveError);
  }, [saveError, t]);

  const today = todayISO();
  const visible = useMemo(
    () => (rules ?? []).filter((r) => r && (filter === 'ALL' || r.kind === filter)),
    [rules, filter],
  );

  /** Regla pendiente de borrado: da el nombre para el texto de confirmación. */
  const deleting = (rules ?? []).find((r) => r && r.id === deleteId) ?? null;

  const nextDateOf = (ruleId: string): string | null => {
    const rule = (rules ?? []).find((r) => r && r.id === ruleId);
    if (!rule || !rule.active) return null;
    const { occurrences } = generateForRule(rule, today);
    const upcoming = occurrences.find((o) => o.date >= today);
    return upcoming ? upcoming.date : null;
  };

  const openEditor = (id: string, amount: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setAmountText(String(amount));
  };

  const saveAmount = (id: string) => {
    const amount = parseFloat(String(amountText).replace(',', '.')) || 0;
    if (!(amount > 0)) return;
    void dispatch(updateRule({ id, patch: { amount } }))
      .unwrap()
      .then(() => setExpandedId(null))
      .catch(() => {});
  };

  const toggleActive = (id: string, active: boolean) => {
    void dispatch(updateRule({ id, patch: { active: !active } })).unwrap().catch(() => {});
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    void dispatch(removeRule(id)).unwrap().catch(() => {});
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel={t('recurring_a11yBack')} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ChevronLeft size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('recurring_title')}</Text>
        </View>

        <View style={styles.filterRow}>
          {(['ALL', 'EXPENSE', 'INCOME'] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                accessibilityRole="button"
                accessibilityLabel={t('recurring_a11yFilter', { label: t(f === 'ALL' ? 'recurring_all' : f === 'EXPENSE' ? 'recurring_expenses' : 'recurring_income') })}
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f)}
                style={[styles.filterChip, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary + '1A' : 'transparent' }]}
              >
                <Text variant="smallBold" color={active ? 'primary' : 'textSecondary'}>
                  {t(f === 'ALL' ? 'recurring_all' : f === 'EXPENSE' ? 'recurring_expenses' : 'recurring_income')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <Text color="textSecondary">{t('recurring_loading')}</Text>
        ) : visible.length === 0 ? (
          <ThemedView type="backgroundElement" style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text variant="small" color="textSecondary" align="center">{t('recurring_emptyHint')}</Text>
          </ThemedView>
        ) : (
          <View style={styles.list}>
            {visible.map((r) => {
              const cat = getCategoryConfig(r.category);
              const next = nextDateOf(r.id);
              const expanded = expandedId === r.id;
              return (
                <View key={r.id} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('recurring_a11yRow', { label: r.description })}
                    onPress={() => openEditor(r.id, r.amount)}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: `${cat.color}1A` }]}>
                      <Text style={styles.emoji}>{cat.emoji}</Text>
                    </View>
                    <View style={styles.meta}>
                      <Text variant="smallBold" numberOfLines={1}>{r.description}</Text>
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>
                        {r.amount} · {t(RECUR_LABEL_KEYS[r.frequency])}{next ? ` · ${next}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.kindDot, { backgroundColor: r.kind === 'INCOME' ? theme.income : theme.expense }]} />
                  </Pressable>
                  {expanded && (
                    <View style={styles.editor}>
                      <TextInput
                        value={amountText}
                        onChangeText={setAmountText}
                        keyboardType="numeric"
                        style={[styles.amountInput, { borderColor: theme.border, color: theme.text }]}
                        testID={`recurring-amount-${r.id}`}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('recurring_a11ySave')}
                        onPress={() => saveAmount(r.id)}
                        style={[styles.saveCircle, { backgroundColor: theme.dark }]}
                      >
                        <Check size={22} color={theme.white} strokeWidth={3} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(r.active ? 'recurring_a11yPause' : 'recurring_a11yResume')}
                        onPress={() => toggleActive(r.id, r.active)}
                        style={[styles.iconBtn, { borderColor: theme.border }]}
                      >
                        {r.active
                          ? <Pause size={18} color={theme.text} />
                          : <Play size={18} color={theme.text} />}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('recurring_a11yDelete', { label: r.description })}
                        onPress={() => setDeleteId(r.id)}
                        style={[styles.iconBtn, { borderColor: theme.danger }]}
                      >
                        <Trash2 size={18} color={theme.danger} />
                      </Pressable>
                    </View>
                  )}
                  {!r.active && (
                    <Text variant="caption" color="textSecondary">{t('recurring_paused')}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <DeleteConfirm
        visible={deleteId !== null}
        title={t('deleteConfirm_recurringTitle')}
        description={deleting ? t('deleteConfirm_recurringDesc', { label: deleting.description }) : undefined}
        onCancel={() => setDeleteId(null)}
        onDelete={confirmDelete}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, flex: 1 },
  filterRow: { flexDirection: 'row', gap: Spacing.two },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  list: { gap: Spacing.two },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  meta: { flex: 1, gap: 2 },
  kindDot: { width: 12, height: 12, borderRadius: 6 },
  editor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', fontFamily: Fonts.sans },
  saveCircle: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  empty: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1 },
});
