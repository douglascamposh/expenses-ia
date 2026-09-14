import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { getCurrencySymbol } from '@/expenses/utils/format';
import type { Currency } from '@/expenses/models/Expense';
import { Fonts, Spacing } from '@/constants/theme';

export type MonthTotal = { month: string; currency: string; total: number };

type Props = {
  /** Mes seleccionado 1-12. */
  month: number;
  year: number;
  /** Totales del año visible (month 'YYYY-MM'). */
  totals: MonthTotal[];
  /** Moneda de visualización. */
  currency: Currency;
  /** Límites: no futuro, no antes del primer gasto. */
  minYear: number;
  minMonth: number;
  maxYear: number;
  maxMonth: number;
  onSelectMonth: (month: number) => void;
  onSelectYear: (year: number) => void;
};

/** Ancho estimado de píldora para el auto-scroll. */
const PILL_W = 96;
const PILL_GAP = 8;

/**
 * Tira de meses estilo mockup (primer filtro del dashboard): cada píldora
 * muestra mes + total; arriba selector de año con flechas.
 */
export function MonthStrip({
  month,
  year,
  totals,
  currency,
  minYear,
  minMonth,
  maxYear,
  maxMonth,
  onSelectMonth,
  onSelectYear,
}: Props) {
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const locale = lang === 'en' ? 'en-US' : 'es-BO';

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    const sums = new Map<string, number>();
    for (const row of totals ?? []) {
      if (!row?.month) continue;
      sums.set(row.month, (sums.get(row.month) ?? 0) + (row.total ?? 0));
      if (row.currency === currency) map.set(row.month, row.total ?? 0);
    }
    // Sin fila en la moneda visible: suma de todas las monedas del mes.
    for (const [k, v] of sums) {
      if (!map.has(k)) map.set(k, v);
    }
    return map;
  }, [totals, currency]);

  const months = useMemo(() => {
    const from = year === minYear ? minMonth : 1;
    const to = year === maxYear ? maxMonth : 12;
    const list: number[] = [];
    for (let m = from; m <= to; m++) list.push(m);
    return list;
  }, [year, minYear, minMonth, maxYear, maxMonth]);

  useEffect(() => {
    const idx = months.indexOf(month);
    if (idx >= 0) {
      scrollRef.current?.scrollTo({ x: Math.max(0, idx * (PILL_W + PILL_GAP) - PILL_W), animated: true });
    }
  }, [month, months]);

  const monthName = (m: number) =>
    new Date(year, m - 1, 1).toLocaleDateString(locale, { month: 'long' });
  const fmt = (n: number) =>
    `${getCurrencySymbol(currency)} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n ?? 0))}`;

  const canPrevYear = year > minYear;
  const canNextYear = year < maxYear;

  return (
    <View style={styles.wrap}>
      <View style={styles.yearRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('monthstrip_prevYear')}
          disabled={!canPrevYear}
          onPress={() => canPrevYear && onSelectYear(year - 1)}
          style={[styles.yearBtn, !canPrevYear && styles.yearBtnDisabled]}
        >
          <ChevronLeft size={18} color={canPrevYear ? theme.text : theme.textSecondary} />
        </Pressable>
        <Text variant="smallBold">{year}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('monthstrip_nextYear')}
          disabled={!canNextYear}
          onPress={() => canNextYear && onSelectYear(year + 1)}
          style={[styles.yearBtn, !canNextYear && styles.yearBtnDisabled]}
        >
          <ChevronRight size={18} color={canNextYear ? theme.text : theme.textSecondary} />
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {months.map((m) => {
          const key = `${year}-${String(m).padStart(2, '0')}`;
          const selected = m === month;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t('monthstrip_a11yMonth', { label: `${monthName(m)} ${year}` })}
              onPress={() => onSelectMonth(m)}
              style={[
                styles.pill,
                { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
              ]}
              testID={`month-pill-${m}`}
            >
              <Text variant="smallBold" color={selected ? undefined : 'textSecondary'}>
                {monthName(m)}
              </Text>
              <Text variant="caption" color="textSecondary">
                {fmt(byMonth.get(key) ?? 0)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  yearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBtnDisabled: {
    opacity: 0.35,
  },
  strip: {
    flexDirection: 'row',
    gap: PILL_GAP,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },
  pill: {
    width: PILL_W,
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    gap: 2,
  },
});

export default MonthStrip;
