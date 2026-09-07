import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Mic, Square, X } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Spacing } from '@/constants/theme';

export function RecordingModal({ visible, onStop, onClose }: { visible: boolean; onStop: () => void; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <Modal visible={visible} variant="fullscreen" animation="fade" onDismiss={onClose}>
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <X size={22} color="#0F172A" strokeWidth={2} />
        </Pressable>

        <View style={styles.pulseWrap}>
          <View style={styles.pulseOuter} />
          <View style={styles.pulseMid} />
          <View style={styles.micCircle}>
            <Mic size={42} color="#fff" strokeWidth={2} />
          </View>
        </View>

        <Text variant="smallBold" style={styles.listening}>Listening...</Text>
        <Text variant="small" color="textSecondary">Tell me what you spent</Text>

        <View style={styles.waveform}>
          {Array.from({ length: 32 }).map((_, i) => {
            const phase = tick * 0.45 + i * 0.7;
            const base = Math.abs(Math.sin(phase)) * 26 + Math.abs(Math.cos(phase * 0.6)) * 10;
            const h = 10 + base + (i % 4 === 0 ? 6 : 0);
            const clamped = Math.max(10, Math.min(42, h));
            return <View key={i} style={[styles.bar, { height: clamped, opacity: 0.45 + (clamped / 42) * 0.55 }]} />;
          })}
        </View>

        <Pressable onPress={onStop} style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.85 }]}>
          <Square size={12} color="#2F80FF" fill="#2F80FF" />
          <Text variant="smallBold" style={styles.stopText}>Stop</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  closeBtn: { position: 'absolute', top: 50, left: Spacing.four, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E9F2' },
  pulseWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.four },
  pulseOuter: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#D9E1FF', opacity: 0.25 },
  pulseMid: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#C7D6FF', opacity: 0.35 },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#2F80FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#2F80FF', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, borderWidth: 4, borderColor: '#FFFFFF' },
  listening: { marginTop: Spacing.three },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 48, marginTop: Spacing.four },
  bar: { width: 3, backgroundColor: '#2F80FF', borderRadius: 2 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.four, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#2F80FF', alignSelf: 'center' },
  stopText: { color: '#2F80FF' },
});
