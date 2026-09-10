/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronLeft, Trash2 } from 'lucide-react-native';
import { Button, Chip, Input, Text } from '@/components/ui';
import { AlertModal, Modal } from '@/components/ui/Modal';
import { CategoryModal } from '@/components/CategoryModal';
import { Spacing } from '@/constants/theme';
import { ExpenseCategory, getCategoryConfig } from '@/expenses/categories/expenseCategories';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, type Currency } from '@/expenses/models/Expense';
import type { NewBudget } from '@/expenses/models/Budget';
import { formatCurrency } from '@/expenses/utils/format';

export type BudgetListItem = Pick<NewBudget, 'category' | 'amount' | 'currency'>;

type Props = {
  visible: boolean;
  saving: boolean;
  budgets: BudgetListItem[];
  onClose: () => void;
  onSave: (budget: NewBudget) => void;
  onDelete: (category: string) => void;
  /** Categoría preseleccionada al abrir (p. ej. "Aumentar presupuesto") */
  initialCategory?: ExpenseCategory;
  /** Moneda por defecto para presupuestos nuevos */
  defaultCurrency?: Currency;
};

/**
 * Presupuesto en modal de pantalla completa (mismo patrón que Editar gasto):
 * dropdowns para categoría y moneda, footer Cancelar/Guardar.
 */
export function BudgetModal({ visible, saving, budgets, onClose, onSave, onDelete, initialCategory, defaultCurrency = DEFAULT_CURRENCY }: Props) {
  const safeBudgets = Array.isArray(budgets) ? budgets.filter(Boolean) : [];
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD);
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [attempted, setAttempted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      const start = initialCategory ?? ExpenseCategory.FOOD;
      setCategory(start);
      const existing = (Array.isArray(budgets) ? budgets.filter(Boolean) : []).find((b) => b.category === start);
      setAmountText(existing ? String(existing.amount) : '');
      setCurrency(existing?.currency ?? defaultCurrency);
      setAttempted(false);
      setConfirmDelete(null);
      setCategoryOpen(false);
      setCurrencyOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Al elegir una categoría con presupuesto, precargar sus valores para editar
  const selectCategory = (id: ExpenseCategory) => {
    setCategory(id);
    const existing = safeBudgets.find((b) => b.category === id);
    if (existing) {
      setAmountText(String(existing.amount));
      setCurrency(existing.currency);
    }
  };

  const amount = parseFloat(amountText) || 0;
  const isEditing = safeBudgets.some((b) => b.category === category);
  const error =
    amount <= 0 ? 'El monto debe ser mayor a 0'
    : !category ? 'Elige una categoría'
    : null;

  const handleSave = () => {
    setAttempted(true);
    if (error) return;
    onSave({ category, amount, currency });
  };

  const cat = getCategoryConfig(category);

  return (
    <>
      <Modal visible={visible} variant="fullscreen" animation="slide" onDismiss={onClose}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onClose} style={styles.backBtn}>
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <Text variant="smallBold" style={styles.title}>{isEditing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {safeBudgets.length > 0 && (
            <View style={styles.list}>
              {safeBudgets.map((b) => {
                const bc = getCategoryConfig(b.category);
                return (
                  <View key={b.category} style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: bc.color + '1A', borderColor: bc.color + '33' }]}>
                      <Text style={styles.emoji}>{bc.emoji}</Text>
                    </View>
                    <View style={styles.meta}>
                      <Text variant="smallBold">{bc.label}</Text>
                      <Text variant="small" color="textSecondary">{formatCurrency(b.amount, b.currency)}</Text>
                    </View>
                    <Button variant="dangerOutline" size="sm" onPress={() => setConfirmDelete(b.category)}>Eliminar</Button>
                  </View>
                );
              })}
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
            selected={category}
            onClose={() => setCategoryOpen(false)}
            onSelect={(id) => {
              selectCategory(id as ExpenseCategory);
              setCategoryOpen(false);
            }}
          />

          <Text variant="small" color="textSecondary">Monto máximo</Text>
          <View style={styles.amountRow}>
            <View style={styles.amountFlex}>
              <Input
                value={amountText}
                onChangeText={setAmountText}
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
              <Text variant="smallBold">{currency}</Text>
              <ChevronDown size={16} color="#64748B" />
            </Pressable>
          </View>
          {currencyOpen && (
            <View style={styles.currencyGrid}>
              {SUPPORTED_CURRENCIES.map((cur) => (
                <Chip
                  key={cur}
                  label={cur}
                  selected={currency === cur}
                  onPress={() => {
                    setCurrency(cur);
                    setCurrencyOpen(false);
                  }}
                  size="sm"
                />
              ))}
            </View>
          )}
          {attempted && error && <Text variant="small" color="danger">{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" style={{ flex: 1 }} loading={saving} disabled={attempted && !!error} onPress={handleSave}>Guardar</Button>
        </View>
      </Modal>

      <AlertModal
        visible={confirmDelete !== null}
        icon={<Trash2 size={20} color="#EF4444" />}
        title="Delete budget?"
        description="This budget will be removed."
        primaryLabel="Delete"
        secondaryLabel="Cancel"
        variant="danger"
        onPrimary={() => {
          if (confirmDelete) onDelete(confirmDelete);
          setConfirmDelete(null);
        }}
        onSecondary={() => setConfirmDelete(null)}
        onDismiss={() => setConfirmDelete(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  headerSpacer: { width: 32 },
  body: { gap: Spacing.two, paddingVertical: Spacing.two },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 18 },
  meta: { flex: 1, gap: 2 },
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
  footer: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderColor: '#E6E9F2' },
});
