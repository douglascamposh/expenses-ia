/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Input, Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Fonts, Spacing } from '@/constants/theme';
import type { CategoryConfig, CategoryKind } from '@/expenses/categories/expenseCategories';
import { useAppDispatch } from '@/store/hooks';
import { createCategory, updateCategory } from '@/store/categoriesSlice';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

export const EMOJI_PRESETS = [
  '🍔', '☕', '🍕', '🍩', '🍎', '🥑', '🍺', '🧋',
  '🚕', '🚗', '🚌', '🚲', '✈️', '⛽', '🛵', '🚇',
  '🛍', '👕', '👖', '👟', '💄', '⌚', '🎁', '📷',
  '🧾', '💡', '🏠', '🔧', '📱', '💻', '🐶', '🐱',
  '❤️', '💊', '🏋️', '⚽', '🎮', '🎬', '🎵', '📚',
  '🎨', '👶', '🧸', '💈', '💅', '🌿', '🏖', '🎓',
  '💰', '💼', '🏦', '📈', '🤝', '🎉', '✂️', '🧹',
  '🐾', '🔑', '🧳', '⛺', '🎣', '🍷', '🥐', '💐',
  '🍜', '🍰', '🧁', '🍦', '🍿', '🍫', '🥤', '🌮',
  '🍣', '🥗', '🚂', '🚢', '🏍', '🛺', '🚁', '🏨',
  '👗', '👒', '🕶', '👠', '🎒', '💍', '📺', '🛏',
  '🐰', '🦜', '🐟', '🩺', '🧘', '🎭', '🎸', '🏧',
  '✉️', '🧺',
];
const EMOJI_ROWS = 3;
const COLOR_PRESETS = [
  '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#0ea5e9', '#06b6d4',
  '#10b981', '#84cc16', '#f59e0b', '#eab308', '#14b8a6', '#6366f1', '#78716c',
  '#FBCFE8', '#FED7AA', '#FDE68A', '#A7F3D0', '#BAE6FD', '#DDD6FE',
  '#E9D5FF', '#C7D2FE', '#A5F3FC', '#FECACA',
];

type Props = {
  visible: boolean;
  saving: boolean;
  /** Si viene, edita en vez de crear (el id no cambia). */
  initial?: CategoryConfig | null;
  /** Kind preseleccionado al crear (p. ej. desde el formulario de gasto). */
  kindPreset?: CategoryKind;
  onClose: () => void;
  /** Al crear recibe la etiqueta (para seleccionarla); al editar null. */
  onSaved: (createdLabel: string | null) => void;
};

/**
 * Formulario de nueva categoría (nombre, kind, icono, color).
 * Reutilizable: pantalla /categories y botón + del formulario de gasto.
 */
export function CreateCategoryModal({ visible, saving, initial, kindPreset = 'GASTO', onClose, onSaved }: Props) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const theme = useTheme();
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_PRESETS[0] ?? '📦');
  const [color, setColor] = useState(COLOR_PRESETS[0] ?? '#a1a1aa');
  const [kind, setKind] = useState<CategoryKind>('GASTO');
  const [attempted, setAttempted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Altura del teclado para que la tarjeta quepa en el área visible y el
  // Scroll interno siempre pueda bajar hasta Guardar.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const formMaxHeight = Math.max(
    280,
    Dimensions.get('window').height - kbHeight - 140,
  );

  useEffect(() => {
    if (visible) {
      setLabel(initial?.label ?? '');
      setEmoji(initial?.emoji ?? EMOJI_PRESETS[0] ?? '📦');
      setColor(initial?.color ?? COLOR_PRESETS[0] ?? '#a1a1aa');
      setKind(initial?.kind ?? kindPreset);
      setAttempted(false);
      setLocalError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial?.id]);

  const handleSave = () => {
    setAttempted(true);
    setLocalError(null);
    const input = { label: label.trim(), emoji, color, kind };
    const fail = (e: unknown) => setLocalError(typeof e === 'string' ? e : t('dashboard_saveError'));
    if (initial) {
      void dispatch(updateCategory({ id: String(initial.id), input })).unwrap().then(() => onSaved(null)).catch(fail);
    } else {
      void dispatch(createCategory(input)).unwrap().then(() => onSaved(input.label)).catch(fail);
    }
  };

  // OJO: el ScrollView va inline (no en subcomponente declarado aquí):
  // un componente nuevo en cada render desmonta el TextInput y cierra el teclado.
  const formBody = (
    <ScrollView
      contentContainerStyle={styles.form}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[styles.formScroll, { maxHeight: formMaxHeight }]}
    >
        <View style={styles.topRow}>
          <Text style={styles.giantTitle} numberOfLines={1} adjustsFontSizeToFit>{initial ? t('categories_editTitle') : t('categories_newTitle')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common_close')}
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <X size={22} color={theme.text} />
          </Pressable>
        </View>
        <Input label={t('categories_nameLabel')} value={label} onChangeText={setLabel} placeholder={t('categories_namePlaceholder')} maxLength={24} returnKeyType="done" style={styles.nameText} />
        <View style={styles.kindToggle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('categories_a11yKindExpense')}
            onPress={() => setKind('GASTO')}
            style={[styles.kindHalf, kind === 'GASTO' && { backgroundColor: theme.expense }]}
          >
            <Text variant="smallBold" style={{ color: kind === 'GASTO' ? theme.white : theme.textSecondary }}>{t('categories_kindExpense')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('categories_a11yKindIncome')}
            onPress={() => setKind('INGRESO')}
            style={[styles.kindHalf, kind === 'INGRESO' && { backgroundColor: theme.income }]}
          >
            <Text variant="smallBold" style={{ color: kind === 'INGRESO' ? theme.white : theme.textSecondary }}>{t('categories_kindIncome')}</Text>
          </Pressable>
        </View>
        <Text variant="small" color="textSecondary">{t('categories_iconLabel')}</Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.emojiCarousel}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.emojiCols}>
            {EMOJI_PRESETS.map((e) => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={t('categories_a11yIcon', { emoji: e })}
                accessibilityState={{ selected: emoji === e }}
                onPress={() => setEmoji(e)}
                style={[styles.presetBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, emoji === e && [styles.presetActive, { borderColor: theme.primary }]]}
              >
                <Text style={styles.presetEmoji}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Text variant="small" color="textSecondary">{t('categories_colorLabel')}</Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorCarousel}
          keyboardShouldPersistTaps="handled"
        >
          {COLOR_PRESETS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={t('categories_a11yColor', { hex: c })}
              accessibilityState={{ selected: color === c }}
              onPress={() => setColor(c)}
              style={[styles.colorBox, { backgroundColor: c, borderColor: theme.border }, color === c && [styles.presetActive, { borderColor: theme.primary }]]}
            />
          ))}
        </ScrollView>
        {(attempted && localError) && <Text variant="small" color="danger">{localError}</Text>}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('categories_save')}
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveCircle, { backgroundColor: theme.dark }, saving && { opacity: 0.6 }]}
          >
            <Check size={22} color={theme.white} strokeWidth={3} />
          </Pressable>
          <Text variant="smallBold" style={{ color: theme.text }}>{t('categories_save')}</Text>
        </View>
      </ScrollView>
  );

  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      {/* En Android el Modal base no evita el teclado: KAV propio + scroll */}
      {Platform.OS === 'android' ? (
        <KeyboardAvoidingView behavior="height">
          {formBody}
        </KeyboardAvoidingView>
      ) : (
        formBody
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: Spacing.two },
  formScroll: { width: '100%' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  giantTitle: { flex: 1, fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  nameText: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontFamily: Fonts.sans },
  kindToggle: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#E4E2DE', borderRadius: 999, padding: 3, gap: 2 },
  kindHalf: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  emojiCarousel: { paddingVertical: 4 },
  emojiCols: { flexDirection: 'column', flexWrap: 'wrap', gap: 8, height: EMOJI_ROWS * 52, alignContent: 'flex-start' },
  colorCarousel: { gap: 10, paddingVertical: 4, alignItems: 'center' },
  presetBox: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  presetActive: { borderWidth: 2 },
  presetEmoji: { fontSize: 20 },
  colorBox: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5 },
  footer: { alignItems: 'center', gap: Spacing.one },
  saveCircle: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

export default CreateCategoryModal;
