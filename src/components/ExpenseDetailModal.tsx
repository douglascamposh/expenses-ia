/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Calendar, ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { Text, Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { Spacing } from '@/constants/theme';
import { getCategoryConfig } from '@/expenses/categories/expenseCategories';
import type { Expense } from '@/expenses/models/Expense';
import { formatCurrency } from '@/expenses/utils/format';

export function ExpenseDetailModal({ expense, visible, onClose, onDelete, onEdit, saving }: { expense: Expense | null | undefined; visible: boolean; onClose: () => void; onDelete: (id: string) => void; onEdit: (patch: Partial<Expense>) => void; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Expense | null>(expense ?? null);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (expense) setDraft(expense);
    setEditing(false);
  }, [expense]);

  if (!expense || !draft) return null;
  const cat = getCategoryConfig(draft.category);

  return (
    <>
      <Modal visible={visible} variant="center" animation="fade" onDismiss={onClose}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onClose} style={styles.backBtn}>
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <View style={styles.headerIcon}>
            <MoreHorizontal size={20} color="#64748B" />
          </View>
        </View>

        <View style={[styles.iconWrap, { backgroundColor: cat.color + '1A', borderColor: cat.color + '33' }]}>
          <Text style={styles.emoji}>{cat.emoji}</Text>
        </View>
        <Text variant="smallBold" align="center">{expense.description}</Text>
        <Text variant="h1" align="center">{formatCurrency(expense.amount, expense.currency)}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text variant="small" color="textSecondary">◉ {cat.label}</Text>
          </View>
        </View>
        <View style={styles.dateRow}>
          <Calendar size={16} color="#64748B" />
          <Text variant="small" color="textSecondary">{new Date(expense.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        </View>

        <View style={styles.actions}>
          <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={() => setEditing(true)}>Edit</Button>
          <Button variant="dangerOutline" size="md" style={{ flex: 1 }} onPress={() => setShowDelete(true)}>Delete</Button>
        </View>
      </Modal>
      <EditExpenseModal
        visible={editing}
        expense={draft}
        saving={saving}
        onClose={() => setEditing(false)}
        onSave={(patch) => { setEditing(false); onEdit(patch); }}
      />
      <DeleteConfirm visible={showDelete} onCancel={() => setShowDelete(false)} onDelete={() => { setShowDelete(false); onDelete(expense.id); }} />
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 36 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E6E9F2' },
  dateRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },
  actions: { flexDirection: 'row', gap: Spacing.three, width: '100%', marginTop: Spacing.two },
});
