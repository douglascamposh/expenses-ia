import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { Spacing } from '@/constants/theme';

type Props = {
  query: string;
  onChangeQuery: (q: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** 'bottom' = flotante estilo mockup (iOS); 'top' = barra en flujo (Android). */
  placement: 'top' | 'bottom';
  /** Offset inferior extra (p. ej. barra virtual de Android; en iOS lo da el KAV). */
  bottomOffset?: number;
};

/**
 * Barra de búsqueda del inicio: en iOS dock inferior flotante sobre el
 * teclado (mockup); en Android barra superior en flujo. La X limpia y cierra.
 */
export function SearchDock({ query, onChangeQuery, onSubmit, onClose, placement, bottomOffset = 0 }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const bar = (
    <View style={[styles.row, placement === 'bottom' && styles.rowBottom]}>
      <View style={[styles.inputPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {placement === 'top' && <Search size={18} color={theme.textSecondary} />}
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmit}
          placeholder={t('dashboard_searchPh')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="search"
          autoFocus
          testID="home-search-input"
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard_a11yClearSearch')}
            onPress={() => onChangeQuery('')}
          >
            <X size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('dashboard_a11yCloseSearch')}
        onPress={onClose}
        style={[styles.closeBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        testID="home-search-close"
      >
        <X size={22} color={theme.text} />
      </Pressable>
    </View>
  );
  if (placement === 'top') return <View style={styles.topWrap}>{bar}</View>;
  return (
    <View style={[styles.dock, { bottom: 16 + bottomOffset }]} pointerEvents="box-none">
      {bar}
    </View>
  );
}

const styles = StyleSheet.create({
  topWrap: {
    paddingHorizontal: 0,
    paddingBottom: Spacing.two,
  },
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowBottom: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  closeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SearchDock;
