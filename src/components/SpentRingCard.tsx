import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Minus, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { Fonts, Spacing } from '@/constants/theme';

export type SpentFilterMode = 'net' | 'exp' | 'inc';

type Props = {
  expense: number;
  /** Ingreso del ámbito visible (montos, % y título usan este valor). */
  income: number;
  /**
   * Hay ingreso global (sin filtrar por categoría): las dos píldoras
   * siempre se muestran. Al filtrar una categoría sin ingreso, la
   * píldora se queda en 0 Bs y el anillo se desvanece con animación.
   */
  hasIncome?: boolean;
  currencySymbol: string;
  loading?: boolean;
  mode?: SpentFilterMode;
  onSelectMode?: (mode: 'exp' | 'inc') => void;
};

const RING_SIZE = 120;
const RING_STROKE = 10;
const EXPENSE_RED = '#F0524D';
const FADE_MS = 300;
/** Alto total del bloque del anillo (ring + padding vertical): se anima para que el layout no salte. */
const RING_BOX_H = RING_SIZE + 8;

/** % gastado = gasto / ingreso. Sin ingreso: círculo rojo completo si hay gasto, 0% si no. */
export function spentFraction(expense: number, income: number): number {
  if (!(income > 0)) return expense > 0 ? 1 : 0;
  return Math.max(0, expense / income);
}

/** 8.9% · 100% · 125.5% (un decimal, sin ".0"). */
export function formatSpentPct(frac: number): string {
  const v = frac * 100;
  return `${Number(v.toFixed(1))}%`;
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n));
}

type PillProps = {
  kind: 'inc' | 'exp';
  amountText: string;
  active: boolean;
  onPress: () => void;
};

/**
 * Píldora Ingreso/Gasto (mockup): fondo gris redondeado, icono en
 * círculo relleno (+ verde / − rojo) y label + monto. Es el filtro
 * de la lista: tocar alterna entre ver solo ese tipo y ver todo.
 */
function ModePill({ kind, amountText, active, onPress }: PillProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const fill = kind === 'inc' ? theme.income : EXPENSE_RED;
  const Icon = kind === 'inc' ? Plus : Minus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kind === 'inc' ? t('dashboard_a11ySeeMonthInc') : t('dashboard_a11ySeeMonthExp')}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      testID={kind === 'inc' ? 'spent-income-pill' : 'spent-expense-pill'}
      style={[
        styles.pill,
        { backgroundColor: theme.backgroundSelected, borderColor: active ? fill : 'transparent' },
      ]}
    >
      <View style={[styles.iconFilled, { backgroundColor: fill }]}>
        <Icon size={18} color="#FFFFFF" strokeWidth={3} />
      </View>
      <View style={styles.pillTexts}>
        <Text variant="small" color="textSecondary">
          {kind === 'inc' ? t('dashboard_income') : t('dashboard_expense')}
        </Text>
        <Text variant="smallBold" style={styles.pillAmount}>
          {amountText}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Balance del mes: título + anillo rojo con el % gastado y píldoras
 * Ingreso/Gasto debajo (filtran la lista). Sin ahorro ni card.
 * Con ingreso el título muestra lo que queda para gastar; sin ingreso
 * muestra el balance (monto gastado) en una sola píldora.
 */
export function SpentRingCard({
  expense,
  income,
  hasIncome: hasIncomeProp,
  currencySymbol,
  loading,
  mode = 'net',
  onSelectMode,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  // Sin el prop, se deduce del ingreso visible (nunca ocultar por omisión).
  const hasIncome = hasIncomeProp ?? income > 0;
  const showRing = income > 0;
  const frac = spentFraction(expense, income);
  const clamped = Math.min(frac, 1);
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const amount = (n: number) => (loading ? '…' : `${formatAmount(n)} ${currencySymbol}`);
  const title = showRing
    ? t('dashboard_remainingToSpend', { amount: `${formatAmount(Math.max(0, income - expense))} ${currencySymbol}` })
    : t('dashboard_expenseBalance', { amount: amount(expense) });

  // El anillo entra/sale animando altura + opacidad + escala a la vez:
  // el espacio se abre/cierra suave y nada salta de golpe.
  const [ringMounted, setRingMounted] = useState(showRing);
  const progress = useRef(new Animated.Value(showRing ? 1 : 0));
  const ringAnim = useRef<Animated.CompositeAnimation | null>(null);
  // stop defensivo: en tests el mock de timing puede no traerlo.
  const stopRing = () => {
    (ringAnim.current as unknown as { stop?: () => void } | null)?.stop?.();
  };
  useEffect(() => {
    stopRing();
    ringAnim.current = Animated.timing(progress.current, {
      toValue: showRing ? 1 : 0,
      duration: FADE_MS,
      // Altura no va por driver nativo; una sola vista por 300ms va fluido.
      useNativeDriver: false,
    });
    if (showRing) {
      setRingMounted(true);
      ringAnim.current.start();
    } else {
      ringAnim.current.start((result) => {
        if (!result || result.finished) setRingMounted(false);
      });
    }
    return () => stopRing();
  }, [showRing]);

  return (
    <View testID="spent-ring-card" accessibilityRole="text" accessibilityLabel={title} style={styles.bare}>
      <Text variant="smallBold" align="center">
        {title}
      </Text>

      {ringMounted && (
        <Animated.View
          testID="spent-ring"
          style={[
            styles.ringClip,
            {
              opacity: progress.current,
              height: progress.current.interpolate({ inputRange: [0, 1], outputRange: [0, RING_BOX_H] }),
              transform: [
                { scale: progress.current.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={r}
              stroke={theme.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={r}
              stroke={EXPENSE_RED}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c}`}
              strokeDashoffset={c * (1 - clamped)}
              rotation={-90}
              originX={RING_SIZE / 2}
              originY={RING_SIZE / 2}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={[styles.pct, { color: theme.text }]}>
              {loading ? '…' : formatSpentPct(frac)}
            </Text>
            <Text variant="small" color="textSecondary">
              {t('dashboard_spent')}
            </Text>
          </View>
          </View>
        </Animated.View>
      )}

      {hasIncome ? (
        <View style={styles.pillsRow}>
          <View style={styles.pillHalf}>
            <ModePill
              kind="inc"
              amountText={amount(income)}
              active={mode === 'inc'}
              onPress={() => onSelectMode?.('inc')}
            />
          </View>
          <View style={styles.pillHalf}>
            <ModePill
              kind="exp"
              amountText={amount(expense)}
              active={mode === 'exp'}
              onPress={() => onSelectMode?.('exp')}
            />
          </View>
        </View>
      ) : (
        <View style={styles.singlePill}>
          <ModePill
            kind="exp"
            amountText={amount(expense)}
            active={mode === 'exp'}
            onPress={() => onSelectMode?.('exp')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bare: { gap: Spacing.three },
  pillsRow: { flexDirection: 'row', gap: Spacing.two },
  pillHalf: { flex: 1 },
  singlePill: { alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 2,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 12,
  },
  iconFilled: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTexts: { flex: 1, gap: 0 },
  pillAmount: { fontSize: 17, lineHeight: 22 },
  ringClip: { overflow: 'hidden' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  ringCenter: { position: 'absolute', alignItems: 'center', gap: 0 },
  pct: { fontSize: 30, lineHeight: 34, fontWeight: '800', fontFamily: Fonts.sans, letterSpacing: -0.5 },
});
