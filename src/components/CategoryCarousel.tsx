import { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { pastel, resolveColor } from '@/expenses/utils/colors';
import { useAppSelector } from '@/store/hooks';
import { Fonts, Spacing } from '@/constants/theme';
import type { CategorySummary } from '@/store/expensesSlice';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  budgets: { category: string; currency: string; limit: number; spent: number; pct: number }[];
  summary: CategorySummary[];
  onPressCategory?: (category: string) => void;
  onSeeAll?: () => void;
  loading?: boolean;
  /** Scroll vertical del padre: colapsa las 4 barras a la vez hasta píldora. */
  scrollY?: Animated.Value | Animated.AnimatedInterpolation<number | string>;
  /** Selección controlada (filtro inline): si se pasa, el tap alterna vía onSelect. */
  selectedId?: string | null;
  onSelect?: (category: string | null) => void;
};

/** Alturas estilo mockup: píldora mínima 64, columna máxima 220. */
const MIN_H = 64;
const MAX_H = 220;
/** Ancho base; con onLayout se recalcula para que siempre entren 4 sin corte. */
const BASE_BAR_WIDTH = 70;
const BAR_GAP = 8;
const VISIBLE_COUNT = 4;
const TALL_THRESHOLD = 140;
/** Inset izquierdo igual al margen de página: el carrusel no arranca al borde. */
const EDGE_INSET = Spacing.four;
/** Recorrido de scroll que compacta las barras por completo (reutilizable para colapso por filtro). */
export const COLLAPSE_D = 180;
/** Altura del slot: cabe la barra/dashed más alta + aire. */
const SLOT_H = MAX_H + 20;

export function CategoryCarousel({
  budgets,
  summary,
  onPressCategory,
  loading = false,
  scrollY,
  selectedId: controlledId,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [containerW, setContainerW] = useState(0);
  // Suscripción al registro: si las customs llegan después que budgets/summary,
  // los colores/emojis se recalculan (si no, quedan congelados en el fallback).
  const registryTick = useAppSelector((s) => (s.categories.custom ?? []).length);
  // 4 elementos siempre visibles: el slot se deriva del ancho medido menos el inset.
  const slotW = containerW > 0
    ? (containerW - EDGE_INSET - BAR_GAP * (VISIBLE_COUNT - 1)) / VISIBLE_COUNT
    : BASE_BAR_WIDTH + 8;
  const barW = Math.max(52, slotW - 8);

  const categoryData = useMemo(() => {
    const budgetMap = new Map();
    budgets?.filter(Boolean).forEach((b) => {
      budgetMap.set(b.category, { limit: b.limit, spent: b.spent, pct: b.pct, currency: b.currency });
    });

    const summaryMap = new Map();
    summary?.filter(Boolean).forEach((s) => {
      summaryMap.set(s.category, { total: s.total, currency: s.currency });
    });

    const allCategories = [...new Set([
      ...budgets?.filter(Boolean).map((b) => b.category) ?? [],
      ...summary?.filter(Boolean).map((s) => s.category) ?? [],
    ])];

    return allCategories
      .map((catId) => {
        const config = getCategoryConfig(catId);
        const budget = budgetMap.get(catId);
        const summ = summaryMap.get(catId);
        const hasBudget = !!budget;
        const spent = summ?.total ?? budget?.spent ?? 0;
        const limit = budget?.limit ?? 0;
        const pct = hasBudget && limit > 0 ? (spent / limit) * 100 : 0;
        const currency = budget?.currency ?? summ?.currency ?? 'BOB';

        return {
          category: catId,
          label: config.label,
          emoji: config.emoji,
          color: config.color,
          hasBudget,
          spent,
          limit,
          pct,
          currency,
        };
      })
      .filter((c) => c.spent > 0 || c.hasBudget)
      .sort((a, b) => {
        if (a.hasBudget && !b.hasBudget) return -1;
        if (!a.hasBudget && b.hasBudget) return 1;
        if (a.hasBudget && b.hasBudget) return b.pct - a.pct;
        return b.spent - a.spent;
      });
  // registryTick es trigger reactivo a propósito (el registro es módulo mutable).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, summary, registryTick]);

  // Escala única: el 100% es el monto mayor entre límites y gastados.
  const scaleMax = useMemo(
    () => Math.max(1, ...categoryData.map((c) => c.limit), ...categoryData.map((c) => c.spent)),
    [categoryData],
  );
  // Total gastado: base del % de participación por categoría.
  const totalSpent = useMemo(
    () => categoryData.reduce((a, c) => a + (c.spent ?? 0), 0),
    [categoryData],
  );
  const toH = (amount: number) => MIN_H + (amount / scaleMax) * (MAX_H - MIN_H);

  // Alturas base (frame inicial): sólida = gastado, dashed = 100% del budget.
  const baseHeights = useMemo(
    () =>
      categoryData.map((cat) => {
        const fullH = cat.hasBudget ? Math.max(toH(cat.spent), 116) : Math.max(toH(cat.spent), 104);
        const fullDashedH = cat.hasBudget
          ? cat.pct > 100
            ? toH(cat.limit)
            : Math.max(toH(cat.limit), fullH + 14)
          : 0;
        const share = totalSpent > 0 ? (cat.spent / totalSpent) * 100 : 0;
        return { fullH, fullDashedH, share };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryData, scaleMax, totalSpent],
  );

  // Interpolaciones de colapso simultáneo (mismo progreso para las 4).
  const anims = useMemo(() => {
    if (!scrollY) return null;
    return baseHeights.map(({ fullH, fullDashedH }) => ({
      barH: scrollY.interpolate({
        inputRange: [0, COLLAPSE_D],
        outputRange: [fullH, MIN_H],
        extrapolate: 'clamp',
      }),
      // El slot también se encoge: si no, queda un hueco grande sobre las píldoras.
      slotH: scrollY.interpolate({
        inputRange: [0, COLLAPSE_D],
        outputRange: [SLOT_H, MIN_H + 20],
        extrapolate: 'clamp',
      }),
      dashedH: scrollY.interpolate({
        inputRange: [0, COLLAPSE_D],
        outputRange: [Math.max(fullDashedH, MIN_H), MIN_H],
        extrapolate: 'clamp',
      }),
      dashedOpacity: scrollY.interpolate({
        inputRange: [COLLAPSE_D * 0.45, COLLAPSE_D * 0.85],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
      detailOpacity: scrollY.interpolate({
        inputRange: [0, COLLAPSE_D * 0.5],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
      compactOpacity: scrollY.interpolate({
        inputRange: [COLLAPSE_D * 0.5, COLLAPSE_D],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    }));
  }, [scrollY, baseHeights]);

  if (loading) {
    return (
      <View style={styles.container} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
        <View style={styles.barsRow}>
          {[150, 90, MIN_H].map((h, i) => (
            <View key={i} style={[styles.placeholder, { height: h, width: barW, backgroundColor: theme.backgroundSelected }]} />
          ))}
        </View>
      </View>
    );
  }

  if (categoryData.length === 0) {
    return null;
  }

  const internalId = selected ?? categoryData[0]?.category ?? null;
  // Controlado (filtro inline): null = sin filtro, sin resaltar por defecto.
  const selectedId = controlledId !== undefined ? controlledId : internalId;

  return (
    <View style={styles.container} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categoryData.map((cat, index) => {
          const { fullH, fullDashedH, share } = baseHeights[index];
          const anim = anims?.[index] ?? null;
          const isSelected = cat.category === selectedId;
          const isTall = fullH > TALL_THRESHOLD;
          return (
            <Animated.View key={cat.category} style={[styles.slot, { width: slotW, height: anim?.slotH ?? SLOT_H }]}>
              {cat.hasBudget && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.dashedOutline,
                    {
                      width: slotW,
                      borderRadius: 22,
                      height: anim?.dashedH ?? fullDashedH,
                      opacity: anim?.dashedOpacity ?? 1,
                      borderColor: theme.border,
                    },
                  ]}
                />
              )}
              {/* Relleno en Animated.View estático (sin style-función: en nativo
                  el Pressable animado con función se tragaba el backgroundColor).
                  El Pressable interno solo maneja el tap + feedback de opacidad. */}
              <Animated.View
                testID={`bar-${cat.category}`}
                style={[
                  styles.bar,
                  {
                    height: anim?.barH ?? fullH,
                    width: barW,
                    // Color elegido de la categoría (con fallback fijo si viene vacío).
                    backgroundColor: pastel(cat.color, isSelected ? 0.55 : 0.45, cat.category),
                    borderRadius: 16,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: resolveColor(cat.color, cat.category),
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard_a11ySeeExpense', { desc: cat.label })}
                  onPress={() => {
                    if (controlledId !== undefined) {
                      onSelect?.(controlledId === cat.category ? null : cat.category);
                    } else {
                      setSelected(cat.category);
                    }
                    onPressCategory?.(cat.category);
                  }}
                  style={({ pressed }) => [styles.pressFill, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Animated.View style={[styles.detail, { opacity: anim?.detailOpacity ?? 1 }]}>
                    <Text style={isTall ? styles.emojiLarge : styles.emoji}>{cat.emoji}</Text>
                    <Text style={[styles.amount, { color: theme.text }]}>{Math.round(cat.spent)}</Text>
                    {/* Con budget: % del budget (igual que el detalle y el dashed). Sin budget: % del total. */}
                    <Text style={[styles.pct, { color: theme.textSecondary }]}>
                      {cat.hasBudget ? Math.round(cat.pct) : Math.round(share)}%
                    </Text>
                    {cat.hasBudget && (
                      <Text style={[styles.remaining, { color: theme.income }]}>
                        {cat.pct > 100
                          ? t('carousel_over', { n: Math.round(cat.pct) - 100 })
                          : t('carousel_remaining', { n: Math.max(0, 100 - Math.round(cat.pct)) })}
                      </Text>
                    )}
                  </Animated.View>
                  {anim && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.compact, { opacity: anim.compactOpacity }]}
                    >
                      <Text style={styles.compactEmoji}>{cat.emoji}</Text>
                      <Text style={[styles.compactAmount, { color: theme.text }]}>{Math.round(cat.spent)}</Text>
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scrollContent: {
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingLeft: EDGE_INSET,
    paddingRight: 0,
    paddingTop: 18,
    paddingBottom: 4,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dashedOutline: {
    position: 'absolute',
    bottom: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  bar: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    paddingTop: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  pressFill: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  detail: {
    alignItems: 'center',
    gap: 2,
  },
  compact: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactEmoji: { fontSize: 16, fontFamily: Fonts.sans },
  compactAmount: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
  emoji: { fontSize: 18, lineHeight: 22, fontFamily: Fonts.sans },
  emojiLarge: { fontSize: 24, lineHeight: 30, fontFamily: Fonts.sans },
  amount: { fontSize: 16, fontWeight: '700', fontFamily: Fonts.sans },
  pct: { fontSize: 12, fontWeight: '500', fontFamily: Fonts.sans },
  remaining: { fontSize: 10, fontWeight: '700', fontFamily: Fonts.sans },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingLeft: EDGE_INSET,
    paddingRight: 0,
    paddingTop: 18,
  },
  placeholder: {
    borderRadius: 16,
  },
});

export default CategoryCarousel;
