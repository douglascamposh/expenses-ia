import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import type { Swipeable } from 'react-native-gesture-handler';
import { ThemedView } from '@/components/themed-view';
import { CategoryRow } from '@/components/CategoryRow';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { Button, Text } from '@/components/ui';
import { CreateCategoryModal } from '@/components/CreateCategoryModal';
import { Spacing, Fonts } from '@/constants/theme';
import {
  SYSTEM_CATEGORY,
  getSuggestions,
  type CategoryKind,
} from '@/expenses/categories/expenseCategories';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createCategory, deleteCategory, fetchCategories } from '@/store/categoriesSlice';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/hooks/use-theme';


export default function CategoriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const custom = useAppSelector((s) => s.categories.custom ?? []);
  const saving = useAppSelector((s) => s.expenses.saving);
  const categoriesError = useAppSelector((s) => s.categories.error);
  const [createVisible, setCreateVisible] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const suggestions = useMemo(() => getSuggestions(), [custom]);
  const editing = (custom ?? []).find((c) => String(c.id) === String(editingId)) ?? null;
  /** Filas swipe abiertas: solo una a la vez. */
  const swipeRefs = useRef(new Map<string, Swipeable | null>());
  const closeOtherRows = useCallback((exceptId: string) => {
    swipeRefs.current.forEach((row, id) => {
      if (id !== exceptId) row?.close();
    });
  }, []);

  useEffect(() => {
    void dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (categoriesError) Alert.alert(t('categories_listAlert'), categoriesError);
  }, [categoriesError, t]);

  const confirmDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    void dispatch(deleteCategory(id)).unwrap().catch(() => {});
  };

  const quickAdd = (s: { label: string; emoji: string; color: string; kind: CategoryKind }) => {
    void dispatch(createCategory({ label: s.label, emoji: s.emoji, color: s.color, kind: s.kind }))
      .unwrap()
      .catch((e) => Alert.alert(t('categories_listAlert'), typeof e === 'string' ? e : 'No se pudo crear'));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel={t('categories_a11yBack')} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ChevronLeft size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('categories_title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('categories_a11yNew')}
            onPress={() => setCreateVisible(true)}
            style={({ pressed }) => [styles.addCircle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && { opacity: 0.85 }]}
          >
            <Plus size={20} color={theme.primary} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categories_addNew')}
          onPress={() => setCreateVisible(true)}
        >
          <Text variant="small" color="textSecondary">{t('categories_addNew')}</Text>
        </Pressable>
        {(custom ?? []).length === 0 ? (
          <ThemedView type="backgroundElement" style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text variant="small" color="textSecondary" align="center">{t('categories_emptyHint')}</Text>
            <Button variant="primary" size="md" fullWidth onPress={() => setCreateVisible(true)}>{t('categories_newCategory')}</Button>
          </ThemedView>
        ) : (
          <View style={styles.list}>
            {(custom ?? []).filter(Boolean).map((c) => (
              <CategoryRow
                key={String(c.id)}
                item={{ id: String(c.id), label: c.label, emoji: c.emoji, color: c.color, kind: c.kind }}
                onEdit={() => setEditingId(String(c.id))}
                onTrashPress={(id) => setDeleteId(id)}
                swipeRefs={swipeRefs}
                onOpen={closeOtherRows}
              />
            ))}
            <CategoryRow
              item={{ id: String(SYSTEM_CATEGORY.id), label: SYSTEM_CATEGORY.label, emoji: SYSTEM_CATEGORY.emoji, color: SYSTEM_CATEGORY.color, kind: 'GASTO' }}
              hint={t('categories_systemLocked')}
              swipeRefs={swipeRefs}
              onOpen={closeOtherRows}
            />
          </View>
        )}

        {suggestions.length > 0 && (
          <>
            <Text variant="smallBold">{t('categories_suggestions')}</Text>
            <View style={styles.list}>
              {suggestions.map((s) => (
                <Pressable
                  key={String(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard_a11yAddSuggestion', { label: s.label })}
                  onPress={() => quickAdd(s)}
                  style={({ pressed }) => [styles.suggestRow, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.labelCol}>
                    <Text variant="smallBold" style={styles.suggestName} numberOfLines={1}>{s.label}</Text>
                    <View style={[styles.kindPill, { backgroundColor: theme.backgroundSelected }]}>
                      <Text variant="caption" color="textSecondary">
                        {s.kind === 'INGRESO' ? t('categories_kindIncome') : t('categories_kindExpense')}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.suggestIcon, { backgroundColor: `${s.color}1A` }]}>
                    <Text style={styles.suggestEmoji}>{s.emoji}</Text>
                  </View>
                  <View style={[styles.suggestAdd, { borderColor: theme.border }]}>
                    <Plus size={20} color={theme.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <CreateCategoryModal
        visible={createVisible}
        saving={saving}
        onClose={() => setCreateVisible(false)}
        onSaved={() => setCreateVisible(false)}
      />
      <CreateCategoryModal
        visible={editing !== null}
        saving={saving}
        initial={editing}
        onClose={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
      />
      <DeleteConfirm visible={deleteId !== null} onCancel={() => setDeleteId(null)} onDelete={confirmDelete} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, flex: 1 },
  addCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  list: { gap: Spacing.one },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10 },
  suggestName: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.sans },
  kindPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  suggestIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  suggestEmoji: { fontSize: 24 },
  suggestAdd: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  labelCol: { flex: 1, gap: 6 },
  empty: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two, borderWidth: 1 },
});
