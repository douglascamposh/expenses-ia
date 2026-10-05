import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { gradientPair, pastel, resolveColor } from '@/expenses/utils/colors';
import { useAppSelector } from '@/store/hooks';
import { Fonts, Spacing } from '@/constants/theme';
import type { CategorySummary } from '@/store/expensesSlice';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  budgets: { category: string; currency: string; limit: number; spent: number; pct: number }[];
  summary: CategorySummary[];
  onPressCategory?: (category: string) => void;
  onSeeAll?: () => void;
  loading?: boolean;
  /** Selección controlada (filtro inline): si se pasa, el tap alterna vía onSelect. */
  selectedId?: string | null;
  onSelect?: (category: string | null) => void;
  /** Mantener presionado abre el modal de presupuesto de esa categoría. */
  onLongPressCategory?: (category: string) => void;
};

/**
 * Carrusel en píldora: por defecto todo compacto (emoji + monto + %).
 * Al seleccionar, la píldora crece en horizontal con animación suave
 * mostrando el detalle; con budget asignado muestra el dash.
 * Fondo con degradado del color de la categoría (claro u oscuro según
 * el tema, como el resto de la app). El scroll ya no colapsa nada.
 */
const PILL_H = 64;
/** Ancho base; con onLayout se recalcula para que siempre entren 4 sin corte. */
const BASE_BAR_WIDTH = 70;
const BAR_GAP = 8;
const VISIBLE_COUNT = 4;
/** Cuánto se ensancha la barra seleccionada (relativo al ancho base). */
const EXPAND_FACTOR = 2.1;
/** Inset izquierdo igual al margen de página: el carrusel no arranca al borde. */
const EDGE_INSET = Spacing.four;
/** Duración de la expansión/colapso al seleccionar (misma curva suave del scroll anterior). */
const EXPAND_MS = 250;

/** Cuánto mantener presionado para abrir el presupuesto (sin chocar con el scroll). */
export const LONG_PRESS_MS = 600;

export function CategoryCarousel({
  budgets,
  summary,
  onPressCategory,
  loading = false,
  selectedId: controlledId,
  onSelect,
  onLongPressCategory,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Degradado y texto siguen al tema (claro/oscuro) como el resto de la app.
  const isDark = (useColorScheme() ?? 'light') === 'dark';
  const ink = isDark ? '#FFFFFF' : theme.text;
  const inkSoft = isDark ? 'rgba(255,255,255,0.85)' : theme.textSecondary;
  const inkFaint = isDark ? 'rgba(255,255,255,0.92)' : theme.income;
  // RN dispara onPress al soltar aunque haya habido long-press: se ignora ese tap.
  const longPressedRef = useRef(false);
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
  const expandedBarW = barW * EXPAND_FACTOR;
  const slotGrow = expandedBarW - barW;

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

  // Total gastado: base del % de participación por categoría.
  const totalSpent = useMemo(
    () => categoryData.reduce((a, c) => a + (c.spent ?? 0), 0),
    [categoryData],
  );

  const internalId = selected ?? categoryData[0]?.category ?? null;
  // Controlado (filtro inline): null = sin filtro, sin resaltar por defecto.
  const selectedId = controlledId !== undefined ? controlledId : internalId;

  // Un Animated.Value por categoría: 0 píldora, 1 expandida. Persisten entre renders.
  const animsRef = useRef(new Map<string, Animated.Value>());
  const anims = useMemo(() => {
    const map = animsRef.current;
    categoryData.forEach((c) => {
      if (!map.has(c.category)) {
        map.set(c.category, new Animated.Value(c.category === selectedId ? 1 : 0));
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryData]);

  // Al cambiar la selección: la nueva crece, la anterior se encoge.
  useEffect(() => {
    categoryData.forEach((c) => {
      const v = anims.get(c.category);
      if (v) {
        Animated.timing(v, {
          toValue: c.category === selectedId ? 1 : 0,
          duration: EXPAND_MS,
          useNativeDriver: false,
        }).start();
      }
    });
  }, [selectedId, categoryData, anims]);

  if (loading) {
    return (
      <View style={styles.container} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
        <View style={styles.barsRow}>
          {[MIN_H_PLACEHOLDER, MIN_H_PLACEHOLDER, MIN_H_PLACEHOLDER].map((h, i) => (
            <View key={i} style={[styles.placeholder, { height: h, width: barW, backgroundColor: theme.backgroundSelected }]} />
          ))}
        </View>
      </View>
    );
  }

  if (categoryData.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categoryData.map((cat) => {
          const expand = anims.get(cat.category) ?? new Animated.Value(cat.category === selectedId ? 1 : 0);
          const isSelected = cat.category === selectedId;
          const share = totalSpent > 0 ? (cat.spent / totalSpent) * 100 : 0;
          // Con budget: % del budget. Sin budget: % del total (igual que antes en grande).
          const pctText = `${Math.round(cat.hasBudget ? cat.pct : share)}%`;
          const barWidth = expand.interpolate({ inputRange: [0, 1], outputRange: [barW, expandedBarW] });
          const slotWidth = expand.interpolate({ inputRange: [0, 1], outputRange: [slotW, slotW + slotGrow] });
          const detailOpacity = expand;
          const compactOpacity = expand.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
          // Degradado propio de la categoría (la animación de tamaño es la misma de antes).
          const [gradFrom, gradTo] = gradientPair(cat.color, cat.category, isDark ? 'dark' : 'light');
          // Relleno proporcional de la expandida con budget (lo que falta se ve como pista).
          const fillPct = Math.min(Math.max(cat.pct, 0), 100);
          return (
            <Animated.View key={cat.category} style={[styles.slot, { width: slotWidth, height: SLOT_H }]}>
              {/* Relleno en Animated.View estático (sin style-función: en nativo
                  el Pressable animado con función se tragaba el backgroundColor).
                  El Pressable interno solo maneja el tap + feedback de opacidad. */}
                <Animated.View
                  testID={`bar-${cat.category}`}
                  style={[
                    styles.bar,
                    {
                      height: PILL_H,
                      width: barWidth,
                      borderRadius: 22,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected
                        ? (isDark ? '#FFFFFF' : resolveColor(cat.color, cat.category))
                        : 'transparent',
                    },
                  ]}
                >
                  <LinearGradient
                    testID={`grad-${cat.category}`}
                    colors={[gradFrom, gradTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                {/* Relleno = % gastado del budget (la pista muestra lo que falta).
                    Solo con budget: sin budget un % chico se vería como una rayita. */}
                {cat.hasBudget && (
                  <Animated.View
                    pointerEvents="none"
                    testID={`fill-${cat.category}`}
                    style={[styles.fill, { width: `${fillPct}%`, backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : pastel(cat.color, 0.55, cat.category), opacity: expand }]}
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard_a11ySeeExpense', { desc: cat.label })}
                  accessibilityHint={onLongPressCategory ? t('dashboard_a11yLongPressBudget') : undefined}
                  onPress={() => {
                    if (longPressedRef.current) {
                      longPressedRef.current = false;
                      return;
                    }
                    if (controlledId !== undefined) {
                      onSelect?.(controlledId === cat.category ? null : cat.category);
                    } else {
                      setSelected(cat.category);
                    }
                    onPressCategory?.(cat.category);
                  }}
                  onLongPress={() => {
                    if (!onLongPressCategory) return;
                    longPressedRef.current = true;
                    onLongPressCategory(cat.category);
                  }}
                  delayLongPress={LONG_PRESS_MS}
                  style={({ pressed }) => [styles.pressFill, { opacity: pressed ? 0.8 : 1 }]}
                >
                  {/* Píldora: emoji + monto + % */}
                  <Animated.View
                    pointerEvents="none"
                    testID={`compact-${cat.category}`}
                    style={[styles.compact, { opacity: compactOpacity }]}
                  >
                    <View style={styles.compactRow}>
                      <Text style={styles.compactEmoji}>{cat.emoji}</Text>
                      <Text style={[styles.compactAmount, { color: ink }, isDark && styles.darkInk]}>{Math.round(cat.spent)}</Text>
                    </View>
                    <Text style={[styles.compactPct, { color: inkSoft }, isDark && styles.darkInk]}>{pctText}</Text>
                  </Animated.View>
                  {/* Expandida: emoji + columna centrada (monto, %, y debajo lo que falta) */}
                  <Animated.View
                    pointerEvents="none"
                    testID={`detail-${cat.category}`}
                    style={[styles.detail, { opacity: detailOpacity }]}
                  >
                    <Text style={styles.detailEmoji}>{cat.emoji}</Text>
                    <View style={styles.detailTexts}>
                      <Text style={[styles.amount, { color: ink }, isDark && styles.darkInk]}>{Math.round(cat.spent)}</Text>
                      <Text style={[styles.pct, { color: inkSoft }, isDark && styles.darkInk]}>{pctText}</Text>
                      {cat.hasBudget && (
                        <Text style={[styles.remaining, { color: inkFaint }, isDark && styles.darkInk]}>
                          {cat.pct > 100
                            ? t('carousel_over', { n: Math.round(cat.pct) - 100 })
                            : t('carousel_remaining', { n: Math.max(0, 100 - Math.round(cat.pct)) })}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                </Pressable>
              </Animated.View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Altura del slot: píldora + aire. */
const SLOT_H = PILL_H + 20;
/** Altura de los placeholders de carga. */
const MIN_H_PLACEHOLDER = PILL_H;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scrollContent: {
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingLeft: EDGE_INSET,
    paddingRight: 0,
    paddingTop: 8,
    paddingBottom: 4,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    alignItems: 'center',
    justifyContent: 'center',
    // Recorta el degradado y el relleno al borde redondeado (sin esto se salen en nativo).
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 22,
  },
  pressFill: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  compact: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactEmoji: { fontSize: 16, fontFamily: Fonts.sans },
  compactAmount: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
  compactPct: { fontSize: 11, fontWeight: '500', fontFamily: Fonts.sans },
  detailEmoji: { fontSize: 20, fontFamily: Fonts.sans },
  detailTexts: { alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '700', fontFamily: Fonts.sans, textAlign: 'center' },
  pct: { fontSize: 12, fontWeight: '500', fontFamily: Fonts.sans, textAlign: 'center' },
  remaining: { fontSize: 10, fontWeight: '700', fontFamily: Fonts.sans, textAlign: 'center' },
  // Sombra sutil para texto blanco sobre el degradado en modo oscuro.
  darkInk: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingLeft: EDGE_INSET,
    paddingRight: 0,
    paddingTop: 8,
  },
  placeholder: {
    borderRadius: 22,
  },
});
