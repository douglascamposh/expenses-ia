import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { getAllCategories, SYSTEM_CATEGORY, type CategoryKind } from '@/expenses/categories/expenseCategories';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  selected?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  /** Si viene, muestra solo las de ese kind (+ la del sistema como respaldo). */
  kindFilter?: CategoryKind;
  /** Fila extra al final (p. ej. "Nueva categoría"). */
  footer?: React.ReactNode;
};

/** Selector de categoría estilo lista (círculo emoji + check), como el mockup. */
export function CategoryModal({ visible, selected, onClose, onSelect, kindFilter, footer }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const all = getAllCategories().filter(
    (c) => !kindFilter || c.kind === kindFilter || String(c.id) === String(SYSTEM_CATEGORY.id),
  );
  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Text variant="smallBold" align="center">{t('categoryModal_title')}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {all.map((c) => {
            const active = c.id === selected;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={t('categoryModal_choose', { label: c.label })}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(c.id)}
                style={[styles.row, active && { backgroundColor: theme.primary + '1A' }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.color + '1A' }]}>
                  <Text style={styles.emoji}>{c.emoji}</Text>
                </View>
                <Text variant="smallBold" style={styles.label}>{c.label}</Text>
                {active && <Check size={18} color={theme.primary} />}
              </Pressable>
            );
          })}
          {footer}
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
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  label: { flex: 1 },
});
