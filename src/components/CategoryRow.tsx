import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from '@/components/ui';
import { SwipeTrashAction } from './ExpenseRow';
import { Fonts, Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

export type CategoryRowItem = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  kind: 'GASTO' | 'INGRESO';
};

type Props = {
  item: CategoryRowItem;
  /** Sin onTrash = fila bloqueada (sistema): sin swipe. */
  onEdit?: () => void;
  onTrashPress?: (id: string) => void;
  /** Texto fijo bajo el nombre (p. ej. "sistema") en vez de la píldora de kind. */
  hint?: string;
  swipeRefs: { current: Map<string, Swipeable | null> };
  onOpen: (id: string) => void;
};

/**
 * Fila de categoría estilo mockup: nombre + píldora de kind a la izquierda,
 * icono en cuadrado pastel a la derecha. Swipe-left revela papelera.
 */
export function CategoryRow({ item, onEdit, onTrashPress, hint, swipeRefs, onOpen }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const ref = useRef<Swipeable | null>(null);

  useEffect(() => {
    if (!onTrashPress) return;
    swipeRefs.current.set(item.id, ref.current);
    return () => {
      swipeRefs.current.delete(item.id);
    };
  }, [item.id, swipeRefs, onTrashPress]);

  const body = (
    <Pressable
      accessibilityRole={onEdit ? 'button' : undefined}
      accessibilityLabel={onEdit ? t('categories_a11yEdit', { label: item.label }) : item.label}
      onPress={onEdit}
      disabled={!onEdit}
      style={({ pressed }) => [styles.row, pressed && onEdit && { opacity: 0.7 }]}
    >
      <View style={styles.labelCol}>
        <Text variant="smallBold" style={styles.name} numberOfLines={1}>{item.label}</Text>
        {hint ? (
          <Text variant="caption" color="textSecondary">{hint}</Text>
        ) : (
          <View style={[styles.kindPill, { backgroundColor: theme.backgroundSelected }]}>
            <Text variant="caption" color="textSecondary">
              {item.kind === 'INGRESO' ? t('categories_kindIncome') : t('categories_kindExpense')}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.iconBox, { backgroundColor: `${item.color}1A` }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>
    </Pressable>
  );

  if (!onTrashPress) return body;

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeTrashAction
      label={t('categories_a11yDelete', { label: item.label })}
      dragX={dragX}
      onPress={() => {
        ref.current?.close();
        onTrashPress(item.id);
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
      onSwipeableWillOpen={() => onOpen(item.id)}
    >
      {body}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 10 },
  labelCol: { flex: 1, gap: 6, alignItems: 'flex-start' },
  name: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.sans },
  kindPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
});

export default CategoryRow;
