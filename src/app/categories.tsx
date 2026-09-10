/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { Button, Input, Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';
import { EXPENSE_CATEGORIES } from '@/expenses/categories/expenseCategories';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createCategory, deleteCategory, fetchCategories } from '@/store/categoriesSlice';

const EMOJI_PRESETS = ['🐶', '🐱', '🐾', '👶', '🧸', '⚽', '🎮', '🎬', '🎵', '📚', '💊', '🏋️', '🎁', '💈', '💅', '🌿', '🔧', '🎨', '📷', '☕', '🍺', '🚲', '🚌', '✈️'];
const COLOR_PRESETS = ['#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#84cc16', '#f59e0b'];

export default function CategoriesScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const custom = useAppSelector((s) => s.categories.custom ?? []);
  const saving = useAppSelector((s) => s.expenses.saving);
  const categoriesError = useAppSelector((s) => s.categories.error);
  const [createVisible, setCreateVisible] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (categoriesError) Alert.alert('Categorías', categoriesError);
  }, [categoriesError]);

  const confirmDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    void dispatch(deleteCategory(id)).unwrap().catch(() => {});
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <Text variant="h2" style={styles.title}>Categorías</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nueva categoría"
            onPress={() => setCreateVisible(true)}
            style={({ pressed }) => [styles.addCircle, pressed && { opacity: 0.85 }]}
          >
            <Plus size={20} color="#2F80FF" />
          </Pressable>
        </View>

        <Text variant="smallBold">Del sistema</Text>
        <ThemedView type="backgroundElement" style={styles.listCard}>
          {EXPENSE_CATEGORIES.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: c.color + '1A', borderColor: c.color + '33' }]}>
                <Text style={styles.emoji}>{c.emoji}</Text>
              </View>
              <Text variant="smallBold" style={styles.label}>{c.label}</Text>
            </View>
          ))}
        </ThemedView>

        <Text variant="smallBold">Mis categorías{(custom ?? []).length > 0 ? ` (${(custom ?? []).length})` : ''}</Text>
        {(custom ?? []).length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.empty}>
            <Text variant="small" color="textSecondary" align="center">Crea categorías con tu icono y color: aparecen en formularios, barras y presupuestos</Text>
            <Button variant="primary" size="md" fullWidth onPress={() => setCreateVisible(true)}>+ Nueva categoría</Button>
          </ThemedView>
        ) : (
          <ThemedView type="backgroundElement" style={styles.listCard}>
            {(custom ?? []).filter(Boolean).map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: c.color + '1A', borderColor: c.color + '33' }]}>
                  <Text style={styles.emoji}>{c.emoji}</Text>
                </View>
                <Text variant="smallBold" style={styles.label}>{c.label}</Text>
                <Button variant="dangerOutline" size="sm" onPress={() => setDeleteId(String(c.id))}>Eliminar</Button>
              </View>
            ))}
          </ThemedView>
        )}
      </ScrollView>

      <CreateCategoryModal
        visible={createVisible}
        saving={saving}
        onClose={() => setCreateVisible(false)}
        onSaved={() => setCreateVisible(false)}
      />
      <DeleteConfirm visible={deleteId !== null} onCancel={() => setDeleteId(null)} onDelete={confirmDelete} />
    </ThemedView>
  );
}

function CreateCategoryModal({ visible, saving, onClose, onSaved }: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_PRESETS[0] ?? '📦');
  const [color, setColor] = useState(COLOR_PRESETS[0] ?? '#a1a1aa');
  const [attempted, setAttempted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLabel('');
      setEmoji(EMOJI_PRESETS[0] ?? '📦');
      setColor(COLOR_PRESETS[0] ?? '#a1a1aa');
      setAttempted(false);
      setLocalError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    setAttempted(true);
    setLocalError(null);
    void dispatch(createCategory({ label: label.trim(), emoji, color }))
      .unwrap()
      .then(() => onSaved())
      .catch((e) => setLocalError(typeof e === 'string' ? e : 'No se pudo crear'));
  };

  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.form}>
        <Text variant="smallBold" align="center">Nueva categoría</Text>
        <Input label="Nombre" value={label} onChangeText={setLabel} placeholder="Mascotas" maxLength={24} />
        <Text variant="small" color="textSecondary">Icono</Text>
        <View style={styles.presetGrid}>
          {EMOJI_PRESETS.map((e) => (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={`Icono ${e}`}
              accessibilityState={{ selected: emoji === e }}
              onPress={() => setEmoji(e)}
              style={[styles.presetBox, emoji === e && styles.presetActive]}
            >
              <Text style={styles.presetEmoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <Text variant="small" color="textSecondary">Color</Text>
        <View style={styles.presetGrid}>
          {COLOR_PRESETS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: color === c }}
              onPress={() => setColor(c)}
              style={[styles.colorBox, { backgroundColor: c }, color === c && styles.presetActive]}
            />
          ))}
        </View>
        {(attempted && localError) && <Text variant="small" color="danger">{localError}</Text>}
        <View style={styles.footer}>
          <Button variant="primary" size="md" style={{ flex: 1 }} loading={saving} onPress={handleSave}>Guardar</Button>
          <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onClose}>Cancelar</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', flex: 1 },
  addCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  listCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 20 },
  label: { flex: 1 },
  empty: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  form: { width: '100%', gap: Spacing.two },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6E9F2', backgroundColor: '#FFFFFF' },
  presetActive: { borderColor: '#2F80FF', borderWidth: 2 },
  presetEmoji: { fontSize: 20 },
  colorBox: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E6E9F2' },
  footer: { flexDirection: 'row', gap: Spacing.two },
});
