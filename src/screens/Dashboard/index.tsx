import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Plus, Search, Settings as SettingsIcon, X, Mic } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { DeleteBubble } from '@/components/DeleteBubble';
import { EmptyState } from '@/components/EmptyState';
import { ExpenseRow } from '@/components/ExpenseRow';
import { FrostedDock } from '@/components/FrostedDock';
import { Toast } from '@/components/Toast';
import type { Swipeable } from 'react-native-gesture-handler';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';
import { ManualExpenseModal } from '@/components/ManualExpenseModal';
import { UnifiedVoiceModal } from '@/components/UnifiedVoiceModal';

import { Text, Button } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';
import { getAllCategories, getCategoryConfig, getSuggestions, isUserCategory, resolveCategoryId } from '@/expenses/categories/expenseCategories';
import { isValidCurrency, isValidKind, type EntryKind, type Expense, type NewExpense } from '@/expenses/models/Expense';
import { validateExpenseCommand } from '@/expenses/services/ExpenseService';
import { formatCurrency, formatDateLabel, formatMonthLabel, formatMonthRange, getCurrencySymbol } from '@/expenses/utils/format';
import { groupRecent } from '@/expenses/utils/groupRecent';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { useAnalyzeAudio } from '@/hooks/use-analyze-audio';
import { useBudgetAlerts } from '@/hooks/use-budget-alerts';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  answerAnalytics,
  clearPending,
  clearSemanticSearch,
  createExpense,
  deleteExpense,
  fetchExpenses,
  saveAllExpenses,
  saveOneExpense,
  semanticSearch,
  setPendingQueue,
  updateExpense,
} from '@/store/expensesSlice';
import { createCategory } from '@/store/categoriesSlice';
import { setSkipIncome } from '@/store/settingsSlice';
import { AnalyticsAnswerCard } from '@/components/AnalyticsAnswerCard';
import { CategoryCarousel, COLLAPSE_D } from '@/components/CategoryCarousel';
import { MonthStrip } from '@/components/MonthStrip';
import { SearchDock } from '@/components/SearchDock';

export function DashboardScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Android edge-to-edge: la barra de navegación virtual tapa los flotantes
  // (iOS ya queda perfecto con el SafeAreaView, no se toca).
  const androidLift = Platform.OS === 'android' ? Math.max(insets.bottom, 28) : 0;
  const audio = useAudioRecording();
  const analyzer = useAnalyzeAudio();
  /** Sin push nativa (Expo Go): la alerta de presupuesto se muestra en-app. */
  const [budgetToast, setBudgetToast] = useState<{ title: string; body: string } | null>(null);
  useBudgetAlerts(useCallback((title: string, body: string) => setBudgetToast({ title, body }), []));
  const dispatch = useAppDispatch();
  const recent = useAppSelector((s) => s.expenses.recent ?? []);
  const allExpenses = useAppSelector((s) => s.expenses.items ?? []);
  const summary = useAppSelector((s) => s.expenses.summary ?? []);
  const totalMonth = useAppSelector((s) => s.expenses.totalMonth ?? {});
  const incomeTotalMonth = useAppSelector((s) => s.expenses.incomeTotalMonth ?? {});
  const loading = useAppSelector((s) => s.expenses.loading);
  const error = useAppSelector((s) => s.expenses.error);
  const pendingQueue = useAppSelector((s) => s.expenses.pendingQueue ?? []);
  const saving = useAppSelector((s) => s.expenses.saving);
  const saveError = useAppSelector((s) => s.expenses.saveError);
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const visibleMonth = useAppSelector((s) => s.expenses.visibleMonth);
  const monthlyTotals = useAppSelector((s) => s.expenses.monthlyTotals ?? []);
  const oldestDate = useAppSelector((s) => s.expenses.oldestDate);
  /** Tira de meses visible (primer filtro): tap en la fecha del header. */
  const [showMonthStrip, setShowMonthStrip] = useState(false);
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth() + 1;
  const minYear = oldestDate ? Number(String(oldestDate).slice(0, 4)) : nowY;
  const minMonth = oldestDate ? Number(String(oldestDate).slice(5, 7)) : nowM;
  const selectMonth = useCallback((m: number) => {
    void dispatch(fetchExpenses({ year: visibleMonth.year, month: m })).unwrap().catch(() => {});
  }, [dispatch, visibleMonth.year]);
  const selectYear = useCallback((y: number) => {
    const clamped = y >= nowY ? Math.min(visibleMonth.month, nowM) : y <= minYear ? Math.max(visibleMonth.month, minMonth) : visibleMonth.month;
    void dispatch(fetchExpenses({ year: y, month: clamped })).unwrap().catch(() => {});
  }, [dispatch, visibleMonth.month, nowY, nowM, minYear, minMonth]);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const customCats = useAppSelector((s) => s.categories.custom ?? []);
  const catsLoaded = useAppSelector((s) => s.categories.loaded);
  const skipIncome = useAppSelector((s) => s.settings.skipIncome ?? false);
  /** Sin categorías del usuario ni datos: onboarding (mockup 10) en vez de carrusel/recientes. */
  const showOnboarding =
    catsLoaded &&
    customCats.length === 0 &&
    (recent ?? []).length === 0 &&
    (budgets ?? []).length === 0;
  const onboardingSuggestions = useMemo(
    () => getSuggestions().slice(0, 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customCats.length],
  );
  const [manualKind, setManualKind] = useState<EntryKind>('EXPENSE');
  /** Moneda válida o la por defecto (nunca entra inválida a la cola). */
  const normalizeCurrency = useCallback(
    (c: unknown): NewExpense['currency'] =>
      typeof c === 'string' && isValidCurrency(c) ? c : defaultCurrency,
    [defaultCurrency],
  );
  const refresh = useCallback(() => dispatch(fetchExpenses(10)).unwrap(), [dispatch]);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [manualVisible, setManualVisible] = useState(false);
  /** Sesión del form: solo una apertura nueva reinicia el borrador. */
  const [manualSession, setManualSession] = useState(0);
  const openManual = useCallback((kind: EntryKind) => {
    setManualKind(kind);
    setManualSession((s) => s + 1);
    setManualVisible(true);
  }, []);
  /** Filas swipe abiertas: solo una a la vez. */
  const swipeRefs = useRef(new Map<string, Swipeable | null>());
  const closeOtherRows = useCallback((exceptId: string) => {
    swipeRefs.current.forEach((row, id) => {
      if (id !== exceptId) row?.close();
    });
  }, []);
  /** Bubble confirmar eliminación (swipe → papelera). */
  const [bubbleExpense, setBubbleExpense] = useState<Expense | null>(null);
  /** Toast no bloqueante (p. ej. voz sin match de categoría). */
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  /** Búsqueda abierta (dock iOS / barra Android). Al escribir filtra la lista del inicio. */
  const [searchOpen, setSearchOpen] = useState(false);
  /** Altura del teclado en iOS: el dock se sienta encima (el KAV absoluto no empuja). */
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (!searchOpen || Platform.OS !== 'ios') {
      setKbHeight(0);
      return;
    }
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [searchOpen]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  /** Modo del hero: también filtra recientes (gastos/ingresos/todo). */
  const [heroMode, setHeroMode] = useState<'net' | 'exp' | 'inc'>('net');
  /** Total del día en la moneda principal (o la primera disponible). */
  const dayTotal = useCallback((totals: Record<string, number>): { text: string } => {
    const cur = (defaultCurrency in totals ? defaultCurrency : Object.keys(totals)[0]) as NewExpense['currency'] | undefined;
    if (!cur) return { text: '' };
    return { text: `- ${formatCurrency(totals[cur] ?? 0, cur)}` };
  }, [defaultCurrency]);
  const semanticIds = useAppSelector((s) => s.expenses.semanticIds);
  const searchMode = useAppSelector((s) => s.expenses.searchMode ?? 'keyword');
  const analytics = useAppSelector((s) => s.expenses.analytics);
  /** Scroll vertical: compacta las barras de categorías al hacer scroll. */
  const [scrollY] = useState(() => new Animated.Value(0));
  /** Colapso por filtro/búsqueda: 0 expandido, 1 píldora. Se suma al scroll. */
  const filterAnim = useMemo(() => new Animated.Value(0), []);
  const collapsedFilter = !!filterCategory || searchOpen;
  useEffect(() => {
    Animated.timing(filterAnim, {
      toValue: collapsedFilter ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [collapsedFilter, filterAnim]);
  /** Progreso combinado scroll + filtro (el mayor manda, con tope). */
  const collapseY = useMemo(
    () => Animated.add(scrollY, Animated.multiply(filterAnim, COLLAPSE_D)),
    [scrollY, filterAnim],
  );

  useEffect(() => {
    void dispatch(fetchExpenses(10));
  }, [dispatch]);

  useEffect(() => {
    if (saveError) Alert.alert(t('dashboard_saveError'), saveError);
  }, [saveError, t]);

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
          // Categorías del usuario para que la IA haga match (o caiga a la default).
          const userCats = getAllCategories().map((c) => ({ id: String(c.id), label: c.label, kind: c.kind }));
          const result = await analyzer.analyze(res.filePath, userCats);
          const rawExpenses = result.expenses ?? [];
          console.log('Gastos detectados:', rawExpenses);
          if ((rawExpenses ?? []).length === 0) {
            Alert.alert(t('dashboard_noExpenses'), t('dashboard_noExpensesVoice'));
            return;
          }
          const queue: NewExpense[] = [];
          let unmatchedCategory = false;
          for (const raw of (rawExpenses ?? []).filter(Boolean)) {
            const rawObj = raw as Record<string, unknown>;
            const rawKind = String(rawObj.kind ?? 'EXPENSE');
            const resolved = resolveCategoryId(rawObj.category);
            // Sin match con categorías del usuario (legado o desconocida) → toast no bloqueante.
            if (String(rawObj.category ?? '').trim() !== '' && !isUserCategory(resolved)) {
              unmatchedCategory = true;
            }
            const cmd = {
              action: 'CREATE_EXPENSE',
              expense: {
                amount: Number(rawObj.amount),
                currency: normalizeCurrency(rawObj.currency),
                category: resolved,
                kind: isValidKind(rawKind) ? rawKind : 'EXPENSE',
                description: String(rawObj.description || 'Gasto'),
                date: String(rawObj.date || new Date().toISOString().split('T')[0]),
                // El backend envía paymentMethod (CASH/CARD); default CASH si falta.
                // Editable en el modal antes de guardar.
                paymentMethod: String(rawObj.paymentMethod || 'CASH'),
                confidence: rawObj.confidence as number | undefined,
              },
            };
            const v = validateExpenseCommand(cmd);
            if (v.valid && v.normalized) queue.push(v.normalized);
            else
              queue.push({
                amount: Number(rawObj.amount) || 0,
                currency: normalizeCurrency(rawObj.currency),
                category: resolveCategoryId(rawObj.category) as NewExpense['category'],
                kind: 'EXPENSE',
                description: String(rawObj.description || ''),
                date: String(rawObj.date || new Date().toISOString().split('T')[0]),
                paymentMethod: 'CASH',
              });
          }
          dispatch(setPendingQueue(queue));
          if (unmatchedCategory) setVoiceToast(t('voice_noMatch'));
        } catch (e) {
          Alert.alert(t('dashboard_analyzeError'), (e as Error).message);
        }
      }
    } else {
      analyzer.reset();
      await audio.startRecording();
    }
  }, [audio, analyzer, dispatch, normalizeCurrency, t]);

  // Buscador del inicio: analítica exacta primero, luego IA, luego keyword.
  // Filtra la lista visible (mes + categoría + modo) sin salir de la pantalla.
  const handleHomeSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      dispatch(clearSemanticSearch());
      return;
    }
    void dispatch(answerAnalytics({ query: q, currency: defaultCurrency }))
      .unwrap()
      .then(() => {})
      .catch(() => {
        void dispatch(semanticSearch(q)).unwrap().catch(() => {});
      });
  }, [searchQuery, dispatch, defaultCurrency]);

  // Búsqueda en vivo con debounce corto al escribir en el dock.
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      dispatch(clearSemanticSearch());
      return;
    }
    const t = setTimeout(() => handleHomeSearch(), 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchOpen, handleHomeSearch, dispatch]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    dispatch(clearSemanticSearch());
  }, [dispatch]);

  /** Ámbito de búsqueda: todo el mes visible (sin tope de 30) + filtros activos. */
  const searchScope = useMemo(() => {
    const { from, to } = formatMonthRange(new Date(visibleMonth.year, visibleMonth.month - 1, 1));
    return (allExpenses ?? []).filter(
      (e) =>
        e &&
        (e.date ?? '') >= from &&
        (e.date ?? '') <= to &&
        (!filterCategory || e.category === filterCategory) &&
        (heroMode === 'exp' ? (e.kind ?? 'EXPENSE') === 'EXPENSE' : heroMode === 'inc' ? e.kind === 'INCOME' : true),
    );
  }, [allExpenses, visibleMonth, filterCategory, heroMode]);

  const homeResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    // Respuesta analítica: solo los gastos que la componen, en su orden
    if (analytics) {
      const order = new Map(analytics.expenseIds.map((id, i) => [id, i]));
      return searchScope
        .filter((e) => e && order.has(e.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    if (searchMode === 'semantic' && Array.isArray(semanticIds)) {
      const rank = new Map(semanticIds.map((id, i) => [id, i]));
      return searchScope
        .filter((e) => e && rank.has(e.id))
        .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }
    return searchScope.filter(
      (e) => e && (e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)),
    );
  }, [searchScope, searchQuery, searchMode, semanticIds, analytics]);

  /** Recientes del mes agrupados por fecha (máx. 5 fechas, 30 items). Buscando: resultados. */
  const searching = searchOpen && searchQuery.trim().length >= 2;
  const visibleRecent = useMemo(
    () =>
      (searching
        ? homeResults
        : (filterCategory ? (recent ?? []).filter((e) => e?.category === filterCategory) : (recent ?? []))
      )
        .filter(Boolean)
        .filter((e) => (heroMode === 'exp' ? (e.kind ?? 'EXPENSE') === 'EXPENSE' : heroMode === 'inc' ? e.kind === 'INCOME' : true)),
    [recent, filterCategory, heroMode, searching, homeResults],
  );
  const recentSections = useMemo(() => groupRecent(visibleRecent, undefined, undefined, undefined, lang), [visibleRecent, lang]);

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
        Alert.alert(t('dashboard_saveError'), (err as Error)?.message ?? t('common_unexpected'));
      }
    },
    [dispatch, t],
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
        Alert.alert(t('dashboard_saveError'), (err as Error)?.message ?? t('common_unexpected'));
      }
    },
    [dispatch, t],
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

  // El bubble (swipe → papelera) confirma antes de llamar aquí.
  const handleDelete = useCallback(
    async (id: string) => {
      setSelected(null);
      void dispatch(deleteExpense(id))
        .unwrap()
        .catch((e) => Alert.alert(t('dashboard_deleteError'), typeof e === 'string' ? e : t('common_unexpected')));
    },
    [dispatch, t],
  );

  const safeTotalMonth = totalMonth ?? {};
  const safeIncomeMonth = incomeTotalMonth ?? {};
  /** Moneda del hero: la por defecto si hay datos, si no la primera disponible. */
  const heroCurrency = ((): NewExpense['currency'] => {
    const keys = [...Object.keys(safeTotalMonth), ...Object.keys(safeIncomeMonth), ...budgets.map((b) => b.currency)];
    if (keys.includes(defaultCurrency)) return defaultCurrency;
    return (keys[0] ?? defaultCurrency) as NewExpense['currency'];
  })();
  const heroExp = filterCategory
    ? (summary.find((s) => s.category === filterCategory && s.currency === heroCurrency)?.total
      ?? (recent ?? []).filter((e) => e?.category === filterCategory && (e.kind ?? 'EXPENSE') === 'EXPENSE' && e.currency === heroCurrency).reduce((a, e) => a + (e.amount ?? 0), 0))
    : safeTotalMonth[heroCurrency] ?? 0;
  const heroInc = filterCategory
    ? (recent ?? []).filter((e) => e?.category === filterCategory && e.kind === 'INCOME' && e.currency === heroCurrency).reduce((a, e) => a + (e.amount ?? 0), 0)
    : safeIncomeMonth[heroCurrency] ?? 0;
  const heroNet = heroInc - heroExp;
  /** Restante de presupuestos en la moneda del hero (null si no hay). Con filtro: el de esa categoría. */
  const budgetRemaining = ((): number | null => {
    const inCur = (filterCategory ? budgets.filter((b) => b && b.category === filterCategory) : budgets).filter((b) => b && b.currency === heroCurrency);
    if (inCur.length === 0) return null;
    return inCur.reduce((a, b) => a + (b.limit ?? 0), 0) - inCur.reduce((a, b) => a + (b.spent ?? 0), 0);
  })();
  const heroSymbol = getCurrencySymbol(heroCurrency);
  const fmtShort = (n: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n));
  const giantValue = heroMode === 'exp' ? heroExp : heroMode === 'inc' ? heroInc : heroNet;
  const giantSign = heroMode === 'exp' || (heroMode === 'net' && giantValue < 0) ? '-' : '+';
  const giantColor = giantSign === '+' ? theme.success : '#F0524D';

  const thisMonthLabel = formatMonthLabel(new Date(visibleMonth.year, visibleMonth.month - 1, 1), lang);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
        >
          {/* Header mockup: September + gear */}
          <View style={styles.topBar}>
            <Pressable
              style={styles.monthPicker}
              accessibilityRole="button"
              accessibilityLabel={t('monthstrip_a11yMonth', { label: thisMonthLabel })}
              onPress={() => setShowMonthStrip((v) => !v)}
            >
              <Text variant="smallBold" style={styles.monthText}>{thisMonthLabel}</Text>
              <ChevronDown size={16} color={theme.text} />
            </Pressable>
            <View style={styles.topBarActions}>
              {filterCategory && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard_catFilterClear', { label: getCategoryConfig(filterCategory).label })}
                  onPress={() => setFilterCategory(null)}
                  style={[styles.catFilterChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                  testID="category-filter-chip"
                >
                  <Text style={styles.catFilterEmoji}>{getCategoryConfig(filterCategory).emoji}</Text>
                  <View style={styles.catFilterX}>
                    <X size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </Pressable>
              )}
              <Pressable accessibilityLabel={t('dashboard_a11ySettings')} onPress={() => router.push('/settings' as never)} style={[styles.gearBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <SettingsIcon size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Tira de meses (primer filtro): mes + total, con selector de año. */}
          {showMonthStrip && (
            <MonthStrip
              month={visibleMonth.month}
              year={visibleMonth.year}
              totals={monthlyTotals}
              currency={defaultCurrency}
              minYear={minYear}
              minMonth={minMonth}
              maxYear={nowY}
              maxMonth={nowM}
              onSelectMonth={selectMonth}
              onSelectYear={selectYear}
            />
          )}

          {/* Búsqueda en Android: barra superior en flujo (en iOS es dock inferior). */}
          {searchOpen && Platform.OS === 'android' && (
            <SearchDock
              placement="top"
              query={searchQuery}
              onChangeQuery={(q) => {
                setSearchQuery(q);
                dispatch(clearSemanticSearch());
              }}
              onSubmit={handleHomeSearch}
              onClose={closeSearch}
            />
          )}

          {/* Tarjeta analítica sobre la lista cuando la búsqueda la produce. */}
          {searching && analytics && <AnalyticsAnswerCard answer={analytics} compact />}

          {/* Hero balance: neto + toggle gastos/ingresos + restante presupuesto */}
          <View style={[styles.hero, collapsedFilter && styles.heroCompact]}>
            {budgetRemaining !== null ? (
              budgetRemaining < 0 ? (
                <Text variant="small" style={{ color: '#F0524D' }}>{t('dashboard_budgetOver', { amount: `${heroSymbol} ${fmtShort(Math.abs(budgetRemaining))}` })}</Text>
              ) : (
                <Text variant="small" color="textSecondary">{t('dashboard_budgetRemaining', { amount: `${heroSymbol} ${fmtShort(budgetRemaining)}` })}</Text>
              )
            ) : (
              <Text variant="small" color="textSecondary">{t('dashboard_monthBalance')}</Text>
            )}
            <View
              accessibilityRole="text"
              accessibilityLabel={t('dashboard_a11ySeeExpenses')}
            >
              <View style={styles.giantRow}>
                <View style={[styles.signBadge, { backgroundColor: giantColor }]}>
                  <Text style={styles.signText}>{giantSign}</Text>
                </View>
                <Text style={[styles.giant, { color: theme.text }]}>{loading ? '…' : fmtShort(giantValue)}</Text>
                <Text style={[styles.giantCur, { color: theme.textSecondary }]}>{heroSymbol}</Text>
              </View>
            </View>
            <View style={[styles.togglePill, { backgroundColor: theme.backgroundElement }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('dashboard_a11ySeeMonthExp')}
                onPress={() => setHeroMode((m) => (m === 'exp' ? 'net' : 'exp'))}
                style={[styles.toggleSeg, heroMode === 'exp' && { backgroundColor: theme.backgroundSelected }]}
              >
                <View style={[styles.miniBadge, { backgroundColor: '#F0524D' }]}>
                  <Text style={styles.miniSign}>-</Text>
                </View>
                <Text variant="smallBold">{fmtShort(heroExp)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('dashboard_a11ySeeMonthInc')}
                onPress={() => setHeroMode((m) => (m === 'inc' ? 'net' : 'inc'))}
                style={[styles.toggleSeg, heroMode === 'inc' && { backgroundColor: theme.backgroundSelected }]}
              >
                <View style={[styles.miniBadge, { backgroundColor: theme.success }]}>
                  <Text style={styles.miniSign}>+</Text>
                </View>
                <Text variant="smallBold">{fmtShort(heroInc)}</Text>
              </Pressable>
            </View>
          </View>

          {/* Carrusel de categorías estilo mockup (full-bleed, sin margen lateral) */}
          {!showOnboarding && (
          <View style={styles.carouselBleed}>
            <CategoryCarousel
              loading={loading}
              budgets={budgets}
              summary={summary}
              scrollY={collapseY}
              selectedId={filterCategory}
              onSelect={(category) => setFilterCategory(category)}
              onSeeAll={() => router.push('/budgets' as never)}
            />
          </View>
          )}

          {showOnboarding && (
          <View style={styles.onboarding}>
            <LinearGradient
              colors={['#F2845C', '#9B6B8A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.welcomeCard}
            >
              <Text style={styles.welcomeTitle}>{t('dashboard_hello')}</Text>
              <Text style={styles.welcomeTitle}>{t('dashboard_welcomeTitle')}</Text>
              <Text style={styles.welcomeSub}>{t('dashboard_welcomeSub')}</Text>
            </LinearGradient>

            <View style={styles.onboardingRow}>
              <View style={[styles.onboardingCard, { backgroundColor: theme.backgroundElement }]}>
                <Text variant="smallBold">{t('dashboard_addCategories')}</Text>
                <View style={styles.suggestRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard_a11yCreateCategory')}
                    onPress={() => router.push('/categories' as never)}
                    style={[styles.dashedCircle, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary }]}
                  >
                    <Plus size={20} color={theme.text} />
                  </Pressable>
                  {onboardingSuggestions.map((s) => (
                    <Pressable
                      key={String(s.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('dashboard_a11yAddSuggestion', { label: s.label })}
                      onPress={() => {
                        void dispatch(createCategory({ label: s.label, emoji: s.emoji, color: s.color, kind: s.kind }))
                          .unwrap()
                          .catch(() => {});
                      }}
                      style={[styles.suggestCircle, { backgroundColor: s.color + '33' }]}
                    >
                      <Text style={styles.suggestEmoji}>{s.emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[styles.onboardingCard, { backgroundColor: theme.backgroundElement }]}>
                <Text variant="smallBold">{t('dashboard_addFirstExpense')}</Text>
                <View style={styles.suggestRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard_a11yAddManual')}
                    onPress={() => openManual('EXPENSE')}
                    style={[styles.suggestCircleWhite, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                  >
                    <Plus size={20} color={theme.text} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard_a11yVoiceRecord')}
                    onPress={() => router.push('/voice-text' as never)}
                    style={styles.suggestMic}
                  >
                    <Mic size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>

            {!skipIncome && (
            <View style={[styles.incomeCard, { backgroundColor: theme.backgroundElement }]}>
              <Text variant="small" color="textSecondary">{heroSymbol} <Text variant="h2">{t('dashboard_addIncome')}</Text></Text>
              <View style={styles.incomeRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard_a11yAddIncome')}
                  onPress={() => openManual('INCOME')}
                  style={styles.incomeAdd}
                >
                  <Text variant="smallBold">{t('dashboard_addAction')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard_a11ySkipIncome')}
                  onPress={() => void dispatch(setSkipIncome(true))}
                  style={styles.incomeSkip}
                >
                  <Text variant="smallBold" style={styles.incomeSkipText}>{t('dashboard_skipIncome')}</Text>
                </Pressable>
              </View>
            </View>
            )}
          </View>
          )}

          {/* Limpiar filtro (sin título de sección) */}
          {!showOnboarding && filterCategory && (
          <View style={styles.sectionHeader}>
            <View />
            <View style={styles.sectionHeaderRight}>
              <Pressable onPress={() => setFilterCategory(null)}>
                <Text variant="small" color="textSecondary">{t('dashboard_clear')}</Text>
              </Pressable>
            </View>
          </View>
          )}

          {/* Demo offline banner - hide by default, muestra mockup 9 */}
          {/* <OfflineBanner /> */}

          {!showOnboarding && (
          <>{loading ? (
            <Text color="textSecondary">{t('dashboard_loadingExpenses')}</Text>
          ) : error ? (
            <ThemedView type="backgroundElement" style={[styles.emptyCard, { borderColor: theme.border }]}>
              <Text color="danger">{t('dashboard_loadError')}</Text>
              <Button variant="neutral" size="sm" onPress={() => void refresh().catch(() => {})}>{t('common_retry')}</Button>
            </ThemedView>
          ) : (recent ?? []).length === 0 && !searching ? (
            <EmptyState />
          ) : visibleRecent.length === 0 ? (
            <Text variant="small" color="textSecondary" align="center">
              {heroMode === 'inc' ? t('dashboard_noFilterIncome') : t('dashboard_noFilterExpenses')}
            </Text>
          ) : (
            <View style={styles.list}>
              {recentSections.map((sec) => (
                <View key={sec.date}>
                  <View style={styles.dayHeader}>
                    <View style={[styles.dayPill, { backgroundColor: theme.backgroundElement }]}>
                      <Text variant="small" color="textSecondary">{sec.label}</Text>
                    </View>
                    <View style={[styles.dayPill, { backgroundColor: theme.backgroundElement }]}>
                      <Text variant="small" color="textSecondary">{dayTotal(sec.totals).text}</Text>
                    </View>
                  </View>
                  {sec.items.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      onPress={() => setSelected(e)}
                      onTrashPress={(exp) => setBubbleExpense(exp)}
                      swipeRefs={swipeRefs}
                      onOpen={closeOtherRows}
                    />
                  ))}
                </View>
              ))}
              {filterCategory && visibleRecent.length === 0 && (
                <Text variant="small" color="textSecondary">{t('dashboard_noExpensesIn', { label: getCategoryConfig(filterCategory).label })}</Text>
              )}
            </View>
          )}
          </>)}

          <View style={[styles.footerSpace, { height: 110 + androidLift }]} />
        </Animated.ScrollView>

        {/* Difuminado tras los flotantes (mockup) + acciones */}
        <FrostedDock height={140 + androidLift} />
        <View style={[styles.fabPill, { backgroundColor: theme.backgroundElement, bottom: 16 + androidLift }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard_a11yAddManual')}
            onPress={() => openManual('EXPENSE')}
            style={styles.fabPillButton}
          >
            <Plus size={24} color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard_a11ySearchExpenses')}
            onPress={openSearch}
            style={styles.fabPillButton}
          >
            <Search size={24} color={theme.text} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={audio.isRecording ? t('dashboard_a11yStopRecord') : t('dashboard_a11yVoiceRecord')}
          onPress={() => router.push('/voice-text' as never)}
          disabled={analyzer.isLoading || audio.state === 'processing'}
          style={[styles.fabMic, { bottom: 16 + androidLift }]}
        >
          {audio.isRecording ? (
            <View style={styles.micRecording}>
              <View style={styles.micPulse} />
              <View style={styles.micPulse} />
              <View style={styles.micPulse} />
            </View>
          ) : (
            <Mic size={28} color="#FFFFFF" strokeWidth={2} />
          )}
        </Pressable>

        {/* Búsqueda en iOS: dock inferior flotante sobre el teclado (mockup). */}
        {searchOpen && Platform.OS === 'ios' && (
          <View pointerEvents="box-none" style={styles.searchKav}>
            <SearchDock
              placement="bottom"
              bottomOffset={kbHeight}
              query={searchQuery}
              onChangeQuery={(q) => {
                setSearchQuery(q);
                dispatch(clearSemanticSearch());
              }}
              onSubmit={handleHomeSearch}
              onClose={closeSearch}
            />
          </View>
        )}
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
        initial={{ kind: manualKind }}
        resetKey={manualSession}
      />

      {/* Detail editable con un solo Guardar (borrar vive en el swipe) */}
      <ExpenseDetailModal
        expense={selected}
        visible={!!selected}
        saving={saving}
        onClose={() => setSelected(null)}
        onSave={(patch) => {
          const id = selected?.id;
          if (!id) return;
          void dispatch(updateExpense({ id, patch }))
            .unwrap()
            .then(() => setSelected(null))
            .catch((e) => Alert.alert(t('dashboard_updateError'), typeof e === 'string' ? e : t('common_unexpected')));
        }}
      />
      <DeleteBubble
        visible={bubbleExpense !== null}
        description={bubbleExpense?.description ?? ''}
        onCancel={() => setBubbleExpense(null)}
        onConfirm={() => {
          const id = bubbleExpense?.id;
          setBubbleExpense(null);
          if (id) handleDelete(id);
        }}
      />
      <Toast visible={voiceToast !== null} message={voiceToast ?? ''} tone="info" onDismiss={() => setVoiceToast(null)} />
      <Toast
        visible={budgetToast !== null}
        message={budgetToast ? `${budgetToast.title}: ${budgetToast.body}` : ''}
        tone="info"
        onDismiss={() => setBudgetToast(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 100 },
  carouselBleed: { marginHorizontal: -Spacing.four },
  onboarding: { gap: Spacing.three },
  welcomeCard: { borderRadius: 24, padding: Spacing.four, gap: 2 },
  welcomeTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', fontFamily: Fonts.sans, color: '#FFFFFF' },
  welcomeSub: { fontSize: 15, fontFamily: Fonts.sans, color: 'rgba(255,255,255,0.85)' },
  onboardingRow: { flexDirection: 'row', gap: Spacing.two },
  onboardingCard: { flex: 1, borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dashedCircle: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderStyle: 'dashed',
  },
  suggestCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  suggestEmoji: { fontSize: 24, lineHeight: 30 },
  suggestCircleWhite: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  suggestMic: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0524D' },
  incomeCard: { borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  incomeRow: { flexDirection: 'row', gap: 8 },
  incomeAdd: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: '#D9F19A', alignItems: 'center', justifyContent: 'center' },
  incomeSkip: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#2B2B2B', alignItems: 'center', justifyContent: 'center' },
  incomeSkipText: { color: '#FFFFFF' },
  // Top bar mockup
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.one },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthText: { fontSize: 16, fontFamily: Fonts.sans, textTransform: 'capitalize' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gearBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  // Chip de categoría filtrada (mockup): icono + X para quitar.
  catFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1 },
  catFilterEmoji: { fontSize: 18, fontFamily: Fonts.sans },
  catFilterX: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  
  // Hero balance (mockup: neto gigante + toggle gastos/ingresos)
  hero: { alignItems: 'center', gap: 8, paddingTop: Spacing.one },
  heroCompact: { gap: 2, paddingTop: 0 },
  giantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signText: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '800', fontFamily: Fonts.sans, textAlign: 'center' },
  giant: { fontSize: 56, lineHeight: 64, fontWeight: '800', fontFamily: Fonts.sans, letterSpacing: -1 },
  giantCur: { fontSize: 22, lineHeight: 28, fontFamily: Fonts.sans },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleSeg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  miniBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  miniSign: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '800', fontFamily: Fonts.sans, textAlign: 'center' },
  vsText: { color: '#0EB07B', fontSize: 12, fontWeight: '600', fontFamily: Fonts.sans },
  // Spending
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  sectionHeaderRight: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E4E2DE', backgroundColor: '#fff' },
  filterActive: { backgroundColor: '#2F80FF1A', borderColor: '#2F80FF' },
  currencyRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', justifyContent: 'center' },
  list: { gap: Spacing.two },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two, marginBottom: Spacing.one },
  dayPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  emptyCard: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1 },
  emptyHint: { textAlign: 'center', fontFamily: Fonts.sans },
  error: { color: '#EF4444', fontFamily: Fonts.sans },
  retry: { padding: 8, borderWidth: 1, borderColor: '#E4E2DE', borderRadius: 999, paddingHorizontal: 16, fontFamily: Fonts.sans },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.12)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  analyzingCard: { borderRadius: 16, padding: Spacing.four, gap: Spacing.one, alignItems: 'center', borderWidth: 1, borderColor: '#E4E2DE', backgroundColor: '#FFFFFF', shadowColor: 'rgba(45,125,255,0.12)', shadowRadius: 12, elevation: 4 },
  voiceError: { color: '#EF4444', textAlign: 'center', paddingHorizontal: Spacing.four, fontFamily: Fonts.sans },
  footerSpace: { height: 110 },
  searchKav: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Acciones flotantes estilo mockup (sin tab bar)
  fabPill: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  fabPillButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMic: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0524D',
    shadowColor: '#F0524D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  micRecording: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginVertical: 2,
  },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: Spacing.three },
  detailCard: { borderRadius: 20, padding: Spacing.four, gap: Spacing.two, alignItems: 'center', borderWidth: 1, borderColor: '#E4E2DE', backgroundColor: '#FFFFFF' },
  detailTopBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detailIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  detailTitle: { fontSize: 16, fontFamily: Fonts.sans, color: '#0F172A', marginTop: 4 },
  detailAmount: { fontSize: 24, fontWeight: '800', fontFamily: Fonts.sans, color: '#0F172A' },
  detailBadgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F4F3F1', borderWidth: 1, borderColor: '#E4E2DE', fontFamily: Fonts.sans },
  detailDateRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },
  detailEmoji: { fontSize: 36 },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 8 },
  editBox: { width: '100%', gap: Spacing.two },
  input: { borderWidth: 1, borderColor: '#E4E2DE', borderRadius: 12, padding: 12, backgroundColor: '#fff', fontFamily: Fonts.sans },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E4E2DE', backgroundColor: '#fff', fontFamily: Fonts.sans },
  catActive: { backgroundColor: '#2F80FF1A', borderColor: '#2F80FF' },
  row: { flexDirection: 'row', gap: 8 },
  currChip: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E4E2DE', alignItems: 'center', backgroundColor: '#fff', fontFamily: Fonts.sans },
  detailActions: { flexDirection: 'row', gap: Spacing.three, width: '100%', marginTop: Spacing.two },
  btn: { flex: 1, padding: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1 },
  btnGhost: { backgroundColor: '#fff', borderColor: '#2F80FF' },
  btnDeleteOutline: { backgroundColor: '#fff', borderColor: '#FECACA' },
  btnDanger: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  btnPrimary: { backgroundColor: '#2F80FF', borderColor: '#2F80FF' },
  inputRow: { gap: 6 },
});

export default DashboardScreen;
