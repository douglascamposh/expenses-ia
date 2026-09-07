import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronRight, CircleDollarSign, FileText, Info, Layers, Palette, Shield, Cpu } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const R = { lg: 16 } as const;

export default function SettingsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.title}>Settings</Text>

        <ThemedView type="backgroundElement" style={styles.card}>
          <SettingRow icon={Palette} label="Appearance" value="Light mode" />
          <View style={styles.divider} />
          <SettingRow icon={CircleDollarSign} label="Currency" value="BOB" />
          <View style={styles.divider} />
          <SettingRow icon={Layers} label="Categories" />
          <View style={styles.divider} />
          <SettingRow icon={Cpu} label="AI Diagnostics" />
        </ThemedView>

        <Text variant="smallBold" style={styles.aboutLabel}>About</Text>
        <ThemedView type="backgroundElement" style={styles.card}>
          <SettingRow icon={Info} label="App version" value="1.0.0" chevron={false} />
          <View style={styles.divider} />
          <SettingRow icon={Shield} label="Privacy Policy" />
          <View style={styles.divider} />
          <SettingRow icon={FileText} label="Terms of Service" />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

function SettingRow({ icon: Icon, label, value, chevron = true }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value?: string; chevron?: boolean }) {
  return (
    <Pressable style={styles.row} accessibilityRole="button">
      <View style={styles.iconBox}>
        <Icon size={16} color="#2F80FF" />
      </View>
      <Text variant="smallBold" style={styles.rowLabel}>{label}</Text>
      {value && <Text variant="small" color="textSecondary">{value}</Text>}
      {chevron && <ChevronRight size={16} color="#64748B" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: R.lg, paddingVertical: 4, paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: '#E6E9F2', gap: 0 },
  divider: { height: 1, backgroundColor: '#E6E9F2' },
  aboutLabel: { marginTop: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1 },
  chevron: { fontSize: 18, marginLeft: 4 },
});


