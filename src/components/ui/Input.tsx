import { TextInput, type TextInputProps, View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Radius } from '@/constants/theme';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...rest }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.wrap}>
      {label && <Text variant="small" color="textSecondary">{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.backgroundElement, color: colors.text },
          style,
        ]}
        {...rest}
      />
      {error && <Text variant="caption" color="danger">{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: 12 },
});
