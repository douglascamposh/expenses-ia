import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Banknote, Check, ChevronDown, CreditCard, Plus } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { CreateCategoryModal } from '@/components/CreateCategoryModal';
import { RecurrenceModal } from '@/components/RecurrenceModal';
import { DatePickerModal, formatDateDisplay } from '@/components/DatePickerModal';
import { Toast } from '@/components/Toast';
import { Fonts, Spacing } from '@/constants/theme';
import { SYSTEM_CATEGORY, getAllCategories, getCategoryConfig, isUserCategory } from '@/expenses/categories/expenseCategories';
import { getCurrencySymbol } from '@/expenses/utils/format';
import type { Currency, EntryKind, Frequency, NewExpense } from '@/expenses/models/Expense';
import type { StringKey } from '@/i18n/translations';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

const INCOME_GREEN = '#5A9E4B';
const EXPENSE_RED = '#F0524D';

/** Etiqueta del chip según recurrencia del borrador. */
export const RECUR_LABEL_KEYS: Record<Frequency, StringKey> = {
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
  value: NewExpense;
  onChange: (patch: Partial<NewExpense>) => void;
  /** Moneda fija desde settings (sin selector). */
  defaultCurrency: Currency;
  onSave: (draft: NewExpense) => void;
  /** Tag inicial (al editar una descripción con #tag): se conserva al guardar. */
  initialTag?: string;
  /** Categoría aceptada aunque no sea del usuario (historial legado al editar). */
  allowCategory?: string | null;
  /** Estira el form y empuja la fila de pago al fondo (detalle estilo mockup). */
  expandBottom?: boolean;
};

/** Formulario rápido estilo mockup: descripción/monto gigantes, carrusel, pago, fecha. */
export function QuickExpenseForm({ value, onChange, defaultCurrency, onSave, initialTag = '', allowCategory = null, expandBottom = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [dateOpen, setDateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [recurOpen, setRecurOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'error' | 'info' } | null>(null);

  const kind: EntryKind = value.kind ?? 'EXPENSE';
  const recurrence: Frequency = value.recurrence ?? 'ONCE';
  const kindColor = kind === 'INCOME' ? INCOME_GREEN : EXPENSE_RED;
  const symbol = getCurrencySymbol(defaultCurrency);
  const categories = getAllCategories().filter(
    (c) => (kind === 'INCOME' ? c.kind === 'INGRESO' : c.kind === 'GASTO') || String(c.id) === String(SYSTEM_CATEGORY.id),
  );
  // Al editar historial legado, la categoría original también se muestra.
  const allowedExtra =
    allowCategory && !categories.some((c) => String(c.id) === String(allowCategory))
      ? [getCategoryConfig(allowCategory)]
      : [];
  const visibleCategories = [...categories, ...allowedExtra];
  const selectedId = String(value.category ?? '');
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = value.date === todayStr;

  const showToast = (message: string, tone: 'error' | 'info' = 'error') => setToast({ message, tone });

  const handleSave = () => {
    if (!(Number(value.amount) > 0)) {
      showToast(t('quick_needAmount'));
      return;
    }
    if ((value.description ?? '').trim().length < 2) {
      showToast(t('quick_needDesc'));
      return;
    }
    const categoryOk =
      isUserCategory(selectedId) || (!!allowCategory && selectedId === allowCategory);
    if (!categoryOk) {
      showToast(t('quick_needCategory'), 'info');
      return;
    }
    const cleanTag = (initialTag ?? '').trim().replace(/^#+/, '');
    onSave({
      ...value,
      kind,
      currency: defaultCurrency,
      description: `${value.description.trim()}${cleanTag ? ` #${cleanTag}` : ''}`,
    });
  };

  return (
    <View style={[styles.box, expandBottom && styles.boxTall]}>
      <ScrollView
        scrollEnabled={expandBottom}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={expandBottom ? styles.scrollFill : undefined}
        contentContainerStyle={[styles.scrollContent, expandBottom && styles.scrollGrow]}
      >
        <View style={styles.chipsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick_a11yChangeDate')}
          onPress={() => setDateOpen(true)}
          style={[styles.miniChip, { backgroundColor: theme.backgroundSelected }]}
        >
          <Text variant="smallBold">{isToday ? t('quick_today') : formatDateDisplay(value.date)}</Text>
          <ChevronDown size={14} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick_a11yRecurrence')}
          onPress={() => setRecurOpen(true)}
          style={[styles.miniChip, { backgroundColor: theme.backgroundSelected }]}
        >
          <Text variant="smallBold" style={{ color: theme.textSecondary }}>{t(RECUR_LABEL_KEYS[recurrence])}</Text>
          <ChevronDown size={14} color={theme.textSecondary} />
        </Pressable>
      </View>

      <TextInput
        value={value.description ?? ''}
        onChangeText={(description) => onChange({ description })}
        placeholder={t('quick_descPh')}
        placeholderTextColor="#B0B0B0"
        style={[styles.ghost, { color: theme.text }]}
        maxLength={60}
        returnKeyType="next"
      />
      <View style={styles.amountRow}>
        <View style={[styles.kindToggle, { borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('quick_a11yKindExpense')}
            onPress={() => onChange({ kind: 'EXPENSE' })}
            style={[styles.kindHalf, kind === 'EXPENSE' && { backgroundColor: EXPENSE_RED }]}
          >
            <Text style={[styles.kindSign, { color: kind === 'EXPENSE' ? '#FFFFFF' : theme.text }]}>-</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('quick_a11yKindIncome')}
            onPress={() => onChange({ kind: 'INCOME' })}
            style={[styles.kindHalf, kind === 'INCOME' && { backgroundColor: INCOME_GREEN }]}
          >
            <Text style={[styles.kindSign, { color: kind === 'INCOME' ? '#FFFFFF' : theme.text }]}>+</Text>
          </Pressable>
        </View>
        <Text style={[styles.symbol, { color: (value.amount ?? 0) > 0 ? kindColor : '#B0B0B0' }]}>{symbol}</Text>
        <TextInput
          value={(value.amount ?? 0) > 0 ? String(value.amount) : ''}
          onChangeText={(raw) => onChange({ amount: parseFloat(raw.replace(',', '.')) || 0 })}
          placeholder={t('quick_amountPh')}
          placeholderTextColor="#B0B0B0"
          keyboardType="numeric"
          style={[styles.amount, { color: (value.amount ?? 0) > 0 ? kindColor : '#B0B0B0' }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick_a11yAddCategory')}
          onPress={() => setCreateOpen(true)}
          style={[styles.addCircle, { borderColor: theme.border }]}
        >
          <Plus size={22} color={theme.text} />
        </Pressable>
        {visibleCategories.map((c) => {
          const active = String(c.id) === selectedId;
          return (
            <Pressable
              key={String(c.id)}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityState={{ selected: active }}
              onPress={() => onChange({ category: c.id as NewExpense['category'] })}
              style={[
                styles.catPill,
                { borderColor: active ? theme.text : theme.border, backgroundColor: theme.backgroundElement },
              ]}
            >
              <Text style={styles.catEmoji}>{c.emoji}</Text>
              <Text variant="smallBold" numberOfLines={1}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Spacer colapsable: con espacio lleva el pago al fondo; apretado colapsa. */}
      {expandBottom && <View style={styles.spacer} />}

      {/* Pago + guardar dentro del scroll: siempre alcanzable, nunca se pierde. */}
      <View style={styles.payRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick_a11yTogglePay')}
          onPress={() => onChange({ paymentMethod: (value.paymentMethod ?? 'CASH') === 'CASH' ? 'CARD' : 'CASH' })}
          style={[styles.payBtn, { borderColor: theme.text }]}
        >
          {(value.paymentMethod ?? 'CASH') === 'CASH'
            ? <Banknote size={18} color={theme.text} />
            : <CreditCard size={18} color={theme.text} />}
          <Text variant="smallBold">{((value.paymentMethod ?? 'CASH') === 'CASH' ? t('quick_cashTag') : t('quick_cardTag')).replace(/^#+/, '')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick_a11ySave')}
          onPress={handleSave}
          style={styles.saveCircle}
        >
          <Check size={22} color="#FFFFFF" strokeWidth={3} />
        </Pressable>
      </View>
      </ScrollView>

      <DatePickerModal
        visible={dateOpen}
        value={value.date}
        onClose={() => setDateOpen(false)}
        onSelect={(date) => {
          onChange({ date });
          setDateOpen(false);
        }}
      />
      <RecurrenceModal
        visible={recurOpen}
        selected={recurrence}
        onClose={() => setRecurOpen(false)}
        onSelect={(f) => {
          onChange({ recurrence: f });
          setRecurOpen(false);
        }}
      />
      {/* + abre directo el formulario de nueva categoría (sin lista intermedia). */}
      {createOpen && (
      <CreateCategoryModal
        visible={createOpen}
        saving={false}
        kindPreset={kind === 'INCOME' ? 'INGRESO' : 'GASTO'}
        onClose={() => setCreateOpen(false)}
        onSaved={(createdLabel) => {
          setCreateOpen(false);
          if (createdLabel) {
            const found = getAllCategories().find((c) => c.label === createdLabel);
            if (found) onChange({ category: found.id as NewExpense['category'] });
          }
        }}
      />
      )}
      <Toast
        visible={toast !== null}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'error'}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', gap: Spacing.three },
  boxTall: { flex: 1 },
  scrollFill: { flex: 1 },
  spacer: { flex: 1, minHeight: 0 },
  scrollGrow: { flexGrow: 1, paddingBottom: Spacing.two },
  scrollContent: { gap: Spacing.three },
  chipsRow: { flexDirection: 'row', gap: 8 },
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  ghost: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, paddingVertical: 0 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindToggle: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 999, padding: 3, gap: 2 },
  kindHalf: { minWidth: 40, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  kindSign: { fontSize: 16, fontWeight: '800', fontFamily: Fonts.sans, lineHeight: 20 },
  symbol: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans },
  amount: { flex: 1, minWidth: 0, fontSize: 34, lineHeight: 42, fontWeight: '800', fontFamily: Fonts.sans, paddingVertical: 0 },
  carousel: { gap: 10, paddingVertical: 4, alignItems: 'center' },
  addCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, maxWidth: 220 },
  catEmoji: { fontSize: 20 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  saveCircle: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#2B2B2B', alignItems: 'center', justifyContent: 'center' },
});
