import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import type { Frequency } from '@/expenses/models/Expense';
import type { StringKey } from '@/i18n/translations';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

export const FREQUENCIES: readonly Frequency[] = [
  'ONCE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'ANNUAL',
];

const LABEL_KEYS: Record<Frequency, StringKey> = {
  ONCE: 'recur_once',
  DAILY: 'recur_daily',
  WEEKLY: 'recur_weekly',
  BIWEEKLY: 'recur_biweekly',
  MONTHLY: 'recur_monthly',
  BIMONTHLY: 'recur_bimonthly',
  QUARTERLY: 'recur_quarterly',
  ANNUAL: 'recur_annual',
};

type Props = {
  visible: boolean;
  selected: Frequency;
  onClose: () => void;
  onSelect: (f: Frequency) => void;
};

/** Selector de recurrencia estilo lista (una fila por frecuencia + check). */
export function RecurrenceModal({ visible, selected, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <Text variant="smallBold" align="center">{t('recur_title')}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {FREQUENCIES.map((f) => {
            const active = f === selected;
            return (
              <Pressable
                key={f}
                accessibilityRole="button"
                accessibilityLabel={t(LABEL_KEYS[f])}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(f)}
                style={[styles.row, active && { backgroundColor: theme.primary + '1A' }]}
              >
                <Text variant="smallBold" style={styles.label}>{t(LABEL_KEYS[f])}</Text>
                {active && <Check size={18} color={theme.primary} />}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  label: { flex: 1 },
});

export default RecurrenceModal;
