import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import { ExpenseCard } from './ExpenseCard';
import type { Expense } from '@/expenses/models/Expense';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  expense: Expense;
  onPress?: () => void;
  /** Papelera revelada por swipe (el padre abre el bubble confirmar). */
  onTrashPress: (expense: Expense) => void;
  /** Registro de filas para cerrar las demás al abrir una. */
  swipeRefs: { current: Map<string, Swipeable | null> };
  onOpen: (id: string) => void;
};

/** Fila con swipe-left → papelera coral (mockup delete). */
export function ExpenseRow({ expense, onPress, onTrashPress, swipeRefs, onOpen }: Props) {
  const { t } = useTranslation();
  const ref = useRef<Swipeable | null>(null);

  useEffect(() => {
    swipeRefs.current.set(expense.id, ref.current);
    return () => {
      swipeRefs.current.delete(expense.id);
    };
  }, [expense.id, swipeRefs]);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeTrashAction
      label={t('expenseRow_delete', { desc: expense.description })}
      dragX={dragX}
      onPress={() => {
        ref.current?.close();
        onTrashPress(expense);
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
      onSwipeableWillOpen={() => onOpen(expense.id)}
    >
      <ExpenseCard expense={expense} onPress={onPress} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  trashWrap: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Papelera coral revelada por swipe (reutilizable en otras listas). */
export function SwipeTrashAction({
  label,
  dragX,
  onPress,
}: {
  label: string;
  dragX: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
}) {
  const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
  const theme = useTheme();
  return (
    <View style={styles.trashWrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [[styles.trashCircle, { backgroundColor: theme.danger }], pressed && { opacity: 0.8 }]}
        >
          <Trash2 size={22} color={theme.white} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
