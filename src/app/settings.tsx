import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, CircleDollarSign, FileText, Globe, Info, Layers, Moon, PiggyBank, Repeat, Shield, Cpu, TrendingUp } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { CurrencyModal } from '@/components/CurrencyModal';
import { Modal } from '@/components/ui/Modal';
import { Text } from '@/components/ui';
import { Spacing, Fonts } from '@/constants/theme';
import type { Currency } from '@/expenses/models/Expense';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/use-theme';
import { fetchExpenses } from '@/store/expensesSlice';
import { setDefaultCurrency, setLanguage, setSkipIncome, setThemeMode, type LanguageSetting, type ThemeModeSetting } from '@/store/settingsSlice';
import { useTranslation } from '@/i18n/useTranslation';
import { currencyName } from '@/expenses/utils/currencies';

export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const budgets = useAppSelector((s) => s.expenses.budgets ?? []);
  const recurringCount = useAppSelector((s) => s.recurring?.rules?.length ?? 0);
  const defaultCurrency = useAppSelector((s) => s.settings.defaultCurrency);
  const skipIncome = useAppSelector((s) => s.settings.skipIncome ?? false);
  const language = useAppSelector((s) => s.settings.language ?? 'system');
  const themeMode = useAppSelector((s) => s.settings.themeMode ?? 'system');
  const { t, lang } = useTranslation();
  const theme = useTheme();
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [selectVisible, setSelectVisible] = useState<'language' | 'theme' | null>(null);

  const languageLabel =
    language === 'es' ? t('settings_languageEs') : language === 'en' ? t('settings_languageEn') : t('settings_languageSystem');
  const currencySubtitle = `${currencyName(defaultCurrency, lang)} · ${defaultCurrency}`;
  const themeLabel =
    themeMode === 'light' ? t('settings_appearanceLight') : themeMode === 'dark' ? t('settings_appearanceDark') : t('settings_appearanceSystem');

  useEffect(() => {
    void dispatch(fetchExpenses(10));
  }, [dispatch]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel={t('settings_a11yBack')} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ChevronLeft size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('settings_title')}</Text>
        </View>

        <Text variant="small" color="textSecondary" style={styles.sectionLabel}>{t('settings_content')}</Text>
        <View style={styles.list}>
          <SettingRow icon={Moon} label={t('settings_appearance')} subtitle={themeLabel} onPress={() => setSelectVisible('theme')} />
          <SettingRow icon={Globe} label={t('settings_language')} subtitle={languageLabel} onPress={() => setSelectVisible('language')} />
          <SettingRow icon={CircleDollarSign} label={t('settings_currency')} subtitle={currencySubtitle} onPress={() => setCurrencyVisible(true)} />
          <SettingRow icon={Layers} label={t('settings_categories')} onPress={() => router.push('/categories' as never)} />
          <SettingRow icon={PiggyBank} label={t('settings_budgets')} subtitle={budgets.length > 0 ? t('settings_budgetsValue', { n: budgets.length }) : t('settings_noBudgets')} onPress={() => router.push('/budgets' as never)} />
          <SettingRow icon={Repeat} label={t('settings_recurring')} subtitle={recurringCount > 0 ? t('settings_recurringValue', { n: recurringCount }) : t('settings_noRecurring')} onPress={() => router.push('/recurring' as never)} />
          <SettingRow
            icon={TrendingUp}
            label={t('settings_trackIncome')}
            subtitle={skipIncome ? t('settings_no') : t('settings_yes')}
            onPress={() => void dispatch(setSkipIncome(!skipIncome)).unwrap().catch(() => {})}
          />
          <SettingRow icon={Cpu} label={t('settings_aiDiagnostics')} />
        </View>

        <Text variant="small" color="textSecondary" style={styles.sectionLabel}>{t('settings_about')}</Text>
        <View style={styles.list}>
          <SettingRow icon={Info} label={t('settings_appVersion')} subtitle="1.0.0" chevron={false} />
          <SettingRow icon={Shield} label={t('settings_privacy')} />
          <SettingRow icon={FileText} label={t('settings_terms')} />
        </View>
      </ScrollView>

      <SelectModal
        visible={selectVisible === 'language'}
        title={t('settings_selectLanguage')}
        options={[
          { id: 'system', label: t('settings_languageSystem') },
          { id: 'es', label: t('settings_languageEs') },
          { id: 'en', label: t('settings_languageEn') },
        ]}
        selected={language}
        onClose={() => setSelectVisible(null)}
        onSelect={(id) => {
          setSelectVisible(null);
          void dispatch(setLanguage(id as LanguageSetting)).unwrap().catch(() => {});
        }}
      />
      <SelectModal
        visible={selectVisible === 'theme'}
        title={t('settings_selectAppearance')}
        options={[
          { id: 'system', label: t('settings_appearanceSystem') },
          { id: 'light', label: t('settings_appearanceLight') },
          { id: 'dark', label: t('settings_appearanceDark') },
        ]}
        selected={themeMode}
        onClose={() => setSelectVisible(null)}
        onSelect={(id) => {
          setSelectVisible(null);
          void dispatch(setThemeMode(id as ThemeModeSetting)).unwrap().catch(() => {});
        }}
      />

      <CurrencyModal
        visible={currencyVisible}
        selected={defaultCurrency}
        onClose={() => setCurrencyVisible(false)}
        onSelect={(cur: Currency) => {
          setCurrencyVisible(false);
          void dispatch(setDefaultCurrency(cur)).unwrap().catch(() => {});
        }}
      />
    </ThemedView>
  );
}

function SettingRow({ icon: Icon, label, subtitle, chevron = true, onPress }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; subtitle?: string; chevron?: boolean; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable style={styles.row} accessibilityRole="button" onPress={onPress}>
      <View style={[styles.iconBox, { backgroundColor: theme.backgroundSelected }]}>
        <Icon size={24} color={theme.primary} />
      </View>
      <View style={styles.labelCol}>
        <Text variant="smallBold" style={styles.rowLabel}>{label}</Text>
        {!!subtitle && <Text variant="caption" color="textSecondary" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {chevron && <ChevronRight size={16} color={theme.textSecondary} />}
    </Pressable>
  );
}

function SelectModal({ visible, title, options, selected, onClose, onSelect }: {
  visible: boolean;
  title: string;
  options: { id: string; label: string }[];
  selected: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} variant="center" animation="fade" overlayOpacity={0.45} onDismiss={onClose}>
      <View style={styles.selectBox}>
        <Text variant="smallBold" align="center">{title}</Text>
        {options.map((o) => {
          const active = o.id === selected;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(o.id)}
              style={[styles.selectRow, active && { backgroundColor: theme.primary + '1A' }]}
            >
              <Text variant="smallBold" style={styles.selectLabel}>{o.label}</Text>
              {active && <Check size={18} color={theme.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontFamily: Fonts.sans, flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E2DE' },
  sectionLabel: { fontFamily: Fonts.sans },
  list: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 14 },
  iconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F4F3F1', alignItems: 'center', justifyContent: 'center' },
  labelCol: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: Fonts.sans },
  selectBox: { width: '100%', gap: Spacing.two },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  selectRowActive: { backgroundColor: '#2F80FF1A' },
  selectLabel: { flex: 1 },
  chevron: { fontSize: 18, fontFamily: Fonts.sans },
});


