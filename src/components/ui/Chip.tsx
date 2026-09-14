import { Pressable, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Radius } from '@/constants/theme';
import { Text } from './Text';

type Props = {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
};

export function Chip({ label, icon, selected, onPress, size = 'md' }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const isSm = size === 'sm';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          paddingHorizontal: isSm ? 12 : 14,
          paddingVertical: isSm ? 6 : 8,
          borderRadius: isSm ? Radius.lg : Radius.full,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary + '1A' : '#FFFFFF',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text variant="small" color={selected ? 'primary' : 'textSecondary'}>{icon ? `${icon} ${label}` : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
