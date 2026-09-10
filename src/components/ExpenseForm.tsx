import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { Chip, Input, Text } from '@/components/ui';
import { CategoryModal } from '@/components/CategoryModal';
import { DatePickerModal, formatDateDisplay } from '@/components/DatePickerModal';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { Spacing } from '@/constants/theme';
import { SUPPORTED_CURRENCIES, type Currency, type NewExpense, type PaymentMethod } from '@/expenses/models/Expense';
import { getPaymentEmoji, getPaymentLabel } from '@/expenses/models/Expense';
import { validateExpenseCommand } from '@/expenses/services/ExpenseService';

const PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CARD'];

type Props = {
  value: NewExpense;
  onChange: (patch: Partial<NewExpense>) => void;
  /** Muestra el primer error de validación (alta manual lo activa tras intentar guardar) */
  showErrors?: boolean;
};

/** null si el borrador es válido, si no el primer mensaje de error. */
export function getExpenseFormError(value: NewExpense): string | null {
  if (!value || typeof value !== 'object') return 'Gasto inválido';
  const res = validateExpenseCommand(value);
  return res.valid ? null : (res.errors[0] ?? 'Revisa los datos');
}

export function isValidExpenseForm(value: NewExpense): boolean {
  return getExpenseFormError(value) === null;
}

export function ExpenseForm({ value, onChange, showErrors = false }: Props) {
  const error = useMemo(() => (showErrors ? getExpenseFormError(value) : null), [value, showErrors]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const cat = getCategoryConfig(value.category ?? 'OTHER');

  return (
    <View style={styles.box}>
      <Text variant="small" color="textSecondary">Monto</Text>
      <View style={styles.amountRow}>
        <View style={styles.amountFlex}>
          <Input
            value={String(value.amount ?? 0)}
            onChangeText={(t) => onChange({ amount: parseFloat(t) || 0 })}
            keyboardType="numeric"
            placeholder="0.00"
            style={styles.amountText}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar moneda"
          onPress={() => setCurrencyOpen((v) => !v)}
          style={styles.currencyButton}
        >
          <Text variant="smallBold">{value.currency}</Text>
          <ChevronDown size={16} color="#64748B" />
        </Pressable>
      </View>
      {currencyOpen && (
        <View style={styles.currencyGrid}>
          {SUPPORTED_CURRENCIES.map((cur) => (
            <Chip
              key={cur}
              label={cur}
              selected={value.currency === cur}
              onPress={() => {
                onChange({ currency: cur as Currency });
                setCurrencyOpen(false);
              }}
              size="sm"
            />
          ))}
        </View>
      )}
      <Text variant="small" color="textSecondary">Categoría</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cambiar categoría"
        onPress={() => setCategoryOpen(true)}
        style={styles.selectRow}
      >
        <View style={[styles.catIcon, { backgroundColor: cat.color + '1A' }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
        </View>
        <Text variant="smallBold" style={styles.selectText}>{cat.label}</Text>
        <ChevronDown size={16} color="#64748B" />
      </Pressable>
      <CategoryModal
        visible={categoryOpen}
        selected={value.category}
        onClose={() => setCategoryOpen(false)}
        onSelect={(id) => {
          onChange({ category: id as NewExpense['category'] });
          setCategoryOpen(false);
        }}
      />
      <Text variant="small" color="textSecondary">Pago</Text>
      <View style={styles.row}>
        {PAYMENT_METHODS.map((m) => (
          <Chip
            key={m}
            label={getPaymentLabel(m)}
            icon={getPaymentEmoji(m)}
            selected={(value.paymentMethod ?? 'CASH') === m}
            onPress={() => onChange({ paymentMethod: m })}
            size="sm"
          />
        ))}
      </View>
      <Input
        label="Descripción"
        value={value.description ?? ''}
        onChangeText={(t) => onChange({ description: t })}
        placeholder="¿En qué gastaste?"
      />
      <Text variant="small" color="textSecondary">Fecha</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cambiar fecha"
        onPress={() => setDateOpen(true)}
        style={styles.dateButton}
      >
        <Calendar size={16} color="#64748B" />
        <Text variant="smallBold" style={styles.dateText}>{formatDateDisplay(value.date)}</Text>
        <ChevronDown size={16} color="#64748B" />
      </Pressable>
      <DatePickerModal
        visible={dateOpen}
        value={value.date}
        onClose={() => setDateOpen(false)}
        onSelect={(d) => {
          onChange({ date: d });
          setDateOpen(false);
        }}
      />
      {error && (
        <Text variant="small" color="danger">{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', gap: Spacing.two },
  amountRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  amountFlex: { flex: 1 },
  amountText: { fontSize: 20, fontWeight: '700' },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E6E9F2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E6E9F2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  dateText: { flex: 1 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E6E9F2',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  catIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catEmoji: { fontSize: 16 },
  selectText: { flex: 1 },
});
