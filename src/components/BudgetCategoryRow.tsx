/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Check, ChevronDown, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { SwipeTrashAction } from './ExpenseRow';
import { Fonts, Spacing } from '@/constants/theme';
import type { CategoryConfig } from '@/expenses/categories/expenseCategories';
import type { BudgetProgress } from '@/expenses/models/Budget';
import type { Currency } from '@/expenses/models/Expense';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  config: CategoryConfig;
  /** Null = sin presupuesto asignado (sin swipe, subtítulo gris). */
  progress: BudgetProgress | null;
  /** Moneda del sistema para presupuestos nuevos (badge visual). */
  currency: Currency;
  expanded: boolean;
  onToggle: () => void;
  onSave: (amount: number) => void;
  onTrashPress: (category: string) => void;
  swipeRefs: { current: Map<string, Swipeable | null> };
  onOpen: (id: string) => void;
};

/**
 * Fila de presupuesto estilo mockup: icono pastel + nombre + monto o
 * "sin presupuesto". Tap expande monto inline; swipe (solo con budget)
 * revela papelera.
 */
export function BudgetCategoryRow({
  config,
  progress,
  currency,
  expanded,
  onToggle,
  onSave,
  onTrashPress,
  swipeRefs,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const ref = useRef<Swipeable | null>(null);
  const [amountText, setAmountText] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (expanded) {
      setAmountText(progress ? String(progress.limit) : '');
      setAttempted(false);
    }
  }, [expanded, progress]);

  useEffect(() => {
    if (!progress) return;
    swipeRefs.current.set(config.id, ref.current);
    return () => {
      swipeRefs.current.delete(config.id);
    };
  }, [config.id, swipeRefs, progress]);

  const amount = parseFloat((amountText ?? '').replace(',', '.')) || 0;
  const invalid = amount <= 0;

  const handleSave = () => {
    setAttempted(true);
    if (invalid) return;
    onSave(amount);
  };

  const body = (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('budgets_a11yRow', { label: config.label })}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.iconBox, { backgroundColor: `${config.color}1A` }]}>
          <Text style={styles.emoji}>{config.emoji}</Text>
        </View>
        <View style={styles.meta}>
          <Text variant="smallBold" style={styles.name} numberOfLines={1}>{config.label}</Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {progress ? `${progress.currency} ${Math.round(progress.limit)}` : t('budgets_noBudgetSet')}
          </Text>
        </View>
        {expanded
          ? <ChevronDown size={18} color={theme.textSecondary} />
          : <ChevronRight size={18} color={theme.textSecondary} />}
      </Pressable>
      {expanded && (
        <View style={styles.editor}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            style={[styles.amountInput, { borderColor: theme.border, color: theme.text }]}
            testID={`budget-amount-${config.id}`}
          />
          <View style={[styles.currencyBadge, { borderColor: theme.border }]}>
            <Text variant="smallBold">{currency}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('budgets_a11ySave')}
            onPress={handleSave}
            style={styles.saveCircle}
          >
            <Check size={22} color="#FFFFFF" strokeWidth={3} />
          </Pressable>
        </View>
      )}
      {expanded && attempted && invalid && (
        <Text variant="small" color="danger">{t('budgetModal_amountError')}</Text>
      )}
    </View>
  );

  if (!progress) return body;

  const renderRightActions = (
    _progressAnim: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeTrashAction
      label={t('budgets_a11yDelete', { label: config.label })}
      dragX={dragX}
      onPress={() => {
        ref.current?.close();
        onTrashPress(config.id);
      }}
    />
  );

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => onOpen(config.id)}
    >
      {body}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  meta: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.sans },
  editor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', fontFamily: Fonts.sans },
  currencyBadge: { borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  saveCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#2B2B2B', alignItems: 'center', justifyContent: 'center' },
});

export default BudgetCategoryRow;
