import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, TextInput, UIManager, View } from 'react-native';
import { Banknote, Check, ChevronDown, CreditCard, Plus, X } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { CreateCategoryModal } from '@/components/CreateCategoryModal';
import { RecurrenceModal } from '@/components/RecurrenceModal';
import { DatePickerModal, formatDateDisplay } from '@/components/DatePickerModal';
import { Toast } from '@/components/Toast';
import { Fonts, Spacing } from '@/constants/theme';
import { SYSTEM_CATEGORY, getAllCategories, getCategoryConfig, isUserCategory } from '@/expenses/categories/expenseCategories';
import { getCurrencySymbol, todayLocalISO } from '@/expenses/utils/format';
import type { Currency, EntryKind, Frequency, NewExpense } from '@/expenses/models/Expense';
import type { StringKey } from '@/i18n/translations';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';

// LayoutAnimation en Android requiere flag experimental.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Alto de fila y gap de la grilla de 2 filas de categorías. */
const ROW_H = 44;
const GRID_GAP = 8;

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
  /** Versión compacta para tarjetas de revisión (desc/monto más pequeños). */
  compact?: boolean;
  /** Si se pasa, muestra X al final de la fila fecha/recurrencia (quitar borrador). */
  onDeletePress?: () => void;
  /** Label accesible de la X (default: "Eliminar {desc}"). */
  deleteA11yLabel?: string;
};

/** Formulario rápido estilo mockup: descripción/monto gigantes, carrusel, pago, fecha. */
export function QuickExpenseForm({ value, onChange, defaultCurrency, onSave, initialTag = '', allowCategory = null, expandBottom = false, compact = false, onDeletePress, deleteA11yLabel }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [dateOpen, setDateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [recurOpen, setRecurOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'error' | 'info' } | null>(null);
  const gridRef = useRef<ScrollView | null>(null);

  /** Seleccionar categoría con transición fluida (la pill se mueve al frente). */
  const selectCategory = (id: NewExpense['category']) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange({ category: id });
  };

  const kind: EntryKind = value.kind ?? 'EXPENSE';
  const recurrence: Frequency = value.recurrence ?? 'ONCE';
  const kindColor = kind === 'INCOME' ? theme.income : theme.expense;
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
  // La seleccionada va primera, junto al +: siempre visible sin scroll inicial.
  const orderedCategories = [
    ...visibleCategories.filter((c) => String(c.id) === selectedId),
    ...visibleCategories.filter((c) => String(c.id) !== selectedId),
  ];
  // La seleccionada salta al frente (x=0): llevar el scroll ahí para que
  // siempre se vea (al crear o tocar una píldora fuera de pantalla).
  useEffect(() => {
    try {
      gridRef.current?.scrollTo?.({ x: 0, animated: true });
    } catch {
      // Sin scroll nativo (tests): no-op.
    }
  }, [selectedId]);
  const todayStr = todayLocalISO();
  const isToday = value.date === todayStr;

  const showToast = (message: string, tone: 'error' | 'info' = 'error') => setToast({ message, tone });

  const handleSave = () => {
    if (!(Number(value.amount) > 0)) {
      showToast(t('quick_needAmount'));
      return;
    }
    const categoryOk =
      isUserCategory(selectedId) || (!!allowCategory && selectedId === allowCategory);
    if (!categoryOk) {
      showToast(t('quick_needCategory'), 'info');
      return;
    }
    // Sin descripción: se guarda la categoría como descripción.
    const typed = (value.description ?? '').trim();
    const baseDesc = typed.length >= 2 ? typed : getCategoryConfig(selectedId).label;
    const cleanTag = (initialTag ?? '').trim().replace(/^#+/, '');
    onSave({
      ...value,
      kind,
      currency: defaultCurrency,
      description: `${baseDesc}${cleanTag ? ` #${cleanTag}` : ''}`,
    });
  };

  /* Pago + guardar: dentro del scroll en compacto, fijo abajo con expandBottom. */
  const payRow = (
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
        style={[styles.saveCircle, { backgroundColor: theme.dark }]}
      >
        <Check size={22} color="#FFFFFF" strokeWidth={3} />
      </Pressable>
    </View>
  );

  /* Nodos del carrusel: + primero, seleccionada al frente; mitad arriba. */
  const catNodes: ReactNode[] = [
    <Pressable
      key="__add__"
      accessibilityRole="button"
      accessibilityLabel={t('quick_a11yAddCategory')}
      onPress={() => setCreateOpen(true)}
      style={[styles.addCircle, { borderColor: theme.border }]}
    >
      <Plus size={20} color={theme.text} />
    </Pressable>,
    ...orderedCategories.map((c) => {
      const active = String(c.id) === selectedId;
      return (
        <Pressable
          key={String(c.id)}
          accessibilityRole="button"
          accessibilityLabel={c.label}
          accessibilityState={{ selected: active }}
          onPress={() => selectCategory(c.id as NewExpense['category'])}
          style={[
            styles.catPill,
            { borderColor: active ? theme.text : theme.border, backgroundColor: theme.backgroundElement },
          ]}
        >
          <Text style={styles.catEmoji}>{c.emoji}</Text>
          <Text variant="smallBold" numberOfLines={1}>{c.label}</Text>
        </Pressable>
      );
    }),
  ];
  const half = Math.ceil(catNodes.length / 2);
  const row0 = catNodes.slice(0, half);
  const row1 = catNodes.slice(half);

  return (
    <View style={[styles.box, expandBottom && styles.boxTall]}>
      <ScrollView
        scrollEnabled={expandBottom}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={expandBottom ? styles.scrollFill : undefined}
        contentContainerStyle={styles.scrollContent}
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
          {onDeletePress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={deleteA11yLabel ?? ((value.description ?? '').trim() ? t('expenseRow_delete', { desc: (value.description ?? '').trim() }) : t('common_delete'))}
              onPress={onDeletePress}
              style={[styles.deleteCircle, { marginLeft: 'auto', borderColor: '#FECACA', backgroundColor: theme.backgroundElement }]}
            >
              <X size={18} color={theme.danger} />
            </Pressable>
          )}
        </View>

        {/* Monto con el switch ingreso/egreso pegado a la derecha */}
        <View style={styles.amountRow}>
          <Text style={[styles.symbol, compact && styles.symbolCompact, { color: (value.amount ?? 0) > 0 ? kindColor : '#B0B0B0' }]}>{symbol}</Text>
          <TextInput
            value={(value.amount ?? 0) > 0 ? String(value.amount) : ''}
            onChangeText={(raw) => onChange({ amount: parseFloat(raw.replace(',', '.')) || 0 })}
            placeholder={t('quick_amountPh')}
            placeholderTextColor="#B0B0B0"
            keyboardType="numeric"
            style={[styles.amount, compact && styles.amountCompact, { color: (value.amount ?? 0) > 0 ? kindColor : '#B0B0B0' }]}
          />
          <View style={[styles.kindToggle, { borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('quick_a11yKindExpense')}
              onPress={() => onChange({ kind: 'EXPENSE' })}
              style={[styles.kindHalf, kind === 'EXPENSE' && { backgroundColor: theme.expense }]}
            >
              <Text style={[styles.kindSign, { color: kind === 'EXPENSE' ? '#FFFFFF' : theme.text }]}>-</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('quick_a11yKindIncome')}
              onPress={() => onChange({ kind: 'INCOME' })}
              style={[styles.kindHalf, kind === 'INCOME' && { backgroundColor: theme.income }]}
            >
              <Text style={[styles.kindSign, { color: kind === 'INCOME' ? '#FFFFFF' : theme.text }]}>+</Text>
            </Pressable>
          </View>
        </View>

      {/* 2 filas que fluyen: el + y la seleccionada van lado a lado en la
          primera fila; cada fila se compacta sin huecos muertos y ambas hacen
          scroll horizontal juntas. */}
      <ScrollView
        ref={gridRef}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.carouselCol2}>
          <View style={styles.carouselRow}>{row0}</View>
          {row1.length > 0 && <View style={styles.carouselRow}>{row1}</View>}
        </View>
      </ScrollView>

      {/* Descripción debajo de la categoría, con espaciado compacto */}
      <TextInput
        value={value.description ?? ''}
        onChangeText={(description) => onChange({ description })}
        placeholder={kind === 'INCOME' ? t('quick_descPhIncome') : t('quick_descPh')}
        placeholderTextColor="#B0B0B0"
        style={[styles.ghost, compact && styles.ghostCompact, { color: theme.text }]}
        maxLength={60}
        returnKeyType="next"
      />

      {/* Sin expandBottom el pago va dentro del scroll (tarjetas compactas). */}
      {!expandBottom && payRow}
      </ScrollView>
      {/* Con expandBottom el pago queda fijo abajo, fuera del scroll. */}
      {expandBottom && payRow}

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
        onSaved={(created) => {
          // TODO-DEBUG: log temporal para bug "categoría no aparece" (quitar).
          // eslint-disable-next-line no-console
          console.log('[DBG-cat] onSaved', JSON.stringify(created));
          setCreateOpen(false);
          if (created) {
            // La categoría nueva manda: queda seleccionada y el form adopta
            // su kind para que siempre se muestre (sin depender del registro).
            const nextKind: EntryKind = created.kind === 'INGRESO' ? 'INCOME' : 'EXPENSE';
            onChange({ category: created.id as NewExpense['category'], kind: nextKind });
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
  box: { width: '100%', gap: 14 },
  boxTall: { flex: 1 },
  scrollFill: { flex: 1 },
  scrollContent: { paddingBottom: 14 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  deleteCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  ghost: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, paddingVertical: 0, marginBottom: 14 },
  ghostCompact: { fontSize: 20, lineHeight: 26 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  kindToggle: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 999, padding: 3, gap: 2 },
  kindHalf: { minWidth: 40, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  kindSign: { fontSize: 16, fontWeight: '800', fontFamily: Fonts.sans, lineHeight: 20 },
  symbol: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans },
  symbolCompact: { fontSize: 20, lineHeight: 26 },
  amount: { flex: 1, minWidth: 0, fontSize: 34, lineHeight: 42, fontWeight: '800', fontFamily: Fonts.sans, paddingVertical: 0 },
  amountCompact: { fontSize: 22, lineHeight: 28 },
  carouselCol2: {
    flexDirection: 'column',
    gap: GRID_GAP,
  },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID_GAP,
  },
  addCircle: { width: 44, height: ROW_H, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: ROW_H, borderRadius: 999, borderWidth: 1.5, maxWidth: 220 },
  catEmoji: { fontSize: 18 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  saveCircle: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
