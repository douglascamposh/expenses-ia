import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { getAllCategories } from '@/expenses/categories/expenseCategories';

type Props = {
  visible: boolean;
  selected?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
};

/** Selector de categoría estilo lista (círculo emoji + check), como el mockup. */
export function CategoryModal({ visible, selected, onClose, onSelect }: Props) {
  const all = getAllCategories();
  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Text variant="smallBold" align="center">Categoría</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {all.map((c) => {
            const active = c.id === selected;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Elegir ${c.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(c.id)}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.color + '1A' }]}>
                  <Text style={styles.emoji}>{c.emoji}</Text>
                </View>
                <Text variant="smallBold" style={styles.label}>{c.label}</Text>
                {active && <Check size={18} color="#2F80FF" />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: Spacing.two },
  list: { maxHeight: 360, width: '100%' },
  listContent: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  rowActive: { backgroundColor: '#2F80FF1A' },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  label: { flex: 1 },
});
