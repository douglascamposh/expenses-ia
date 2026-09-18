import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Fonts, Spacing } from '@/constants/theme';
import { SUPPORTED_CURRENCIES, type Currency } from '@/expenses/models/Expense';
import { currencyCountry, currencyName } from '@/expenses/utils/currencies';
import { getCurrencySymbol } from '@/expenses/utils/format';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  selected: Currency;
  onClose: () => void;
  onSelect: (currency: Currency) => void;
};

/**
 * Selector de moneda estilo mockup: sheet con título gigante, X,
 * buscador por código/símbolo/nombre/país y filas con píldora + nombre.
 */
export function CurrencyModal({ visible, selected, onClose, onSelect }: Props) {
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(query.trim());
  const filtered = SUPPORTED_CURRENCIES.filter((cur) => {
    if (q.length === 0) return true;
    const hay = [
      cur.toLowerCase(),
      getCurrencySymbol(cur).toLowerCase(),
      norm(currencyName(cur, 'es')),
      norm(currencyName(cur, 'en')),
      norm(currencyCountry(cur, 'es')),
      norm(currencyCountry(cur, 'en')),
    ];
    return hay.some((h) => h.includes(q));
  });

  return (
    <Modal visible={visible} variant="bottomSheet" animation="slide" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.giantTitle} numberOfLines={1} adjustsFontSizeToFit>{t('currencyModal_title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common_close')}
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <X size={22} color={theme.text} />
          </Pressable>
        </View>
        <View style={[styles.searchBox, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('currencyModal_searchPh')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            testID="currency-search-input"
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dashboard_a11yClearSearch')}
              onPress={() => setQuery('')}
            >
              <X size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((cur) => {
            const active = cur === selected;
            return (
              <Pressable
                key={cur}
                accessibilityRole="button"
                accessibilityLabel={t('currencyModal_use', { cur })}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(cur)}
                style={[styles.row, active && { backgroundColor: theme.primary + '1A' }]}
              >
                <View style={[styles.symbolPill, { backgroundColor: theme.backgroundSelected }]}>
                  <Text variant="smallBold">{getCurrencySymbol(cur)}</Text>
                </View>
                <View style={styles.meta}>
                  <Text variant="smallBold" numberOfLines={1}>{currencyName(cur, lang)}</Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {currencyCountry(cur, lang)} · {cur}
                  </Text>
                </View>
                {active && <Check size={18} color={theme.primary} />}
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <Text variant="small" color="textSecondary" align="center">{t('currencyModal_empty')}</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: Spacing.three },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  giantTitle: { flex: 1, fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: Fonts.sans, paddingVertical: 2 },
  list: { maxHeight: 360, width: '100%' },
  listContent: { gap: 4, paddingBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  symbolPill: { minWidth: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 2 },
});

export default CurrencyModal;
