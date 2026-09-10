import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import { getAllCategories } from '@/expenses/categories/expenseCategories';

/** Categorías visibles antes de "Ver más". */
const VISIBLE_COUNT = 6;

type Props = {
  selected?: string | null;
  onSelect: (id: string) => void;
};

/**
 * Selector de categorías colapsable: muestra las primeras y un botón
 * "Ver más (N)" para el resto, para no ocupar tanto espacio en el UI.
 * La categoría seleccionada siempre queda visible aunque esté fuera
 * de las primeras.
 */
export function CategoryPicker({ selected, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const all = getAllCategories();
  const visible = expanded
    ? all
    : all.filter((c, i) => i < VISIBLE_COUNT || c.id === selected);
  const hidden = all.length - visible.length;

  return (
    <View style={styles.grid}>
      {visible.map((c) => (
        <Chip
          key={c.id}
          label={c.label}
          icon={c.emoji}
          selected={selected === c.id}
          onPress={() => onSelect(c.id)}
          size="sm"
        />
      ))}
      {(hidden > 0 || expanded) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Ver menos categorías' : 'Ver más categorías'}
          onPress={() => setExpanded((v) => !v)}
          style={styles.toggle}
        >
          <Text variant="small" color="primary">
            {expanded ? 'Ver menos' : `Ver más (${hidden})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center' },
});
