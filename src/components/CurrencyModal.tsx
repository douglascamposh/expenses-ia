import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { SUPPORTED_CURRENCIES, type Currency } from '@/expenses/models/Expense';
import { getCurrencySymbol } from '@/expenses/utils/format';

type Props = {
  visible: boolean;
  selected: Currency;
  onClose: () => void;
  onSelect: (currency: Currency) => void;
};

/** Selector de moneda por defecto (multi-país). */
export function CurrencyModal({ visible, selected, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Text variant="smallBold" align="center">Moneda por defecto</Text>
        <Text variant="small" color="textSecondary" align="center">Se usará al crear gastos y presupuestos</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {SUPPORTED_CURRENCIES.map((cur) => {
            const active = cur === selected;
            return (
              <Pressable
                key={cur}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${cur}`}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(cur)}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={styles.symbolBox}>
                  <Text variant="smallBold" color="primary">{getCurrencySymbol(cur)}</Text>
                </View>
                <Text variant="smallBold" style={styles.code}>{cur}</Text>
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
  list: { maxHeight: 320, width: '100%' },
  listContent: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  rowActive: { backgroundColor: '#2F80FF1A' },
  symbolBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  code: { flex: 1 },
});
