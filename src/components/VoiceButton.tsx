import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { Text } from '@/components/ui';

type Props = {
  state: 'idle' | 'recording' | 'processing' | 'understanding';
  onPress: () => void;
  disabled?: boolean;
};

export function VoiceButton({ state, onPress, disabled }: Props) {
  const isRecording = state === 'recording';
  const isBusy = state === 'processing' || state === 'understanding';

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={isRecording ? 'Detener grabación' : 'Grabar gasto'}
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled || isBusy}
        style={({ pressed }) => [
          styles.button,
          isRecording && styles.recording,
          isBusy && styles.busy,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color="#fff" />
        ) : isRecording ? (
          <Square size={26} color="#fff" fill="#fff" />
        ) : (
          <Mic size={28} color="#fff" strokeWidth={2.2} />
        )}
      </Pressable>
      <Text variant="small" color="textSecondary" style={styles.label}>
        {state === 'recording' ? 'Escuchando...' : state === 'processing' ? 'Procesando...' : state === 'understanding' ? 'Entendiendo...' : 'Toca para hablar'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2F80FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F80FF',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  recording: { backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.35 },
  busy: { backgroundColor: '#64748B', shadowColor: '#64748B' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.5 },
  label: { textAlign: 'center', fontSize: 12 },
});
