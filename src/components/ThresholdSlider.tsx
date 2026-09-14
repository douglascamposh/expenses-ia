import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const THRESHOLD_MIN = 50;
export const THRESHOLD_MAX = 100;
export const THRESHOLD_STEP = 5;

type Props = {
  value: number;
  /** Solo al soltar (evita escribir en SQLite en cada frame). */
  onCommit: (value: number) => void;
  /** Para desactivar el scroll padre mientras se arrastra. */
  onSlidingChange?: (sliding: boolean) => void;
};

/**
 * Slider 50-100 estilo mockup (track rojo + thumb blanco) sin
 * dependencias nativas: PanResponder sobre la pista (tap y arrastre).
 */
export function ThresholdSlider({ value, onCommit, onSlidingChange }: Props) {
  const theme = useTheme();
  const [trackW, setTrackW] = useState(0);
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const localRef = useRef(local);
  localRef.current = local;
  const apply = (x: number) => {
    const v = xToValue(x);
    localRef.current = v;
    setLocal(v);
  };

  const valueToX = (v: number) => (trackW <= 0 ? 0 : ((v - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN)) * trackW);
  const xToValue = (x: number) => {
    if (trackW <= 0) return value;
    const pct = Math.min(1, Math.max(0, x / trackW));
    return Math.round((THRESHOLD_MIN + pct * (THRESHOLD_MAX - THRESHOLD_MIN)) / THRESHOLD_STEP) * THRESHOLD_STEP;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Solo gestos horizontales: el scroll vertical del padre no compite.
      onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onSlidingChange?.(true);
        apply(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => {
        apply(e.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onSlidingChange?.(false);
        commitRef.current(localRef.current);
      },
      onPanResponderTerminate: () => {
        onSlidingChange?.(false);
      },
    }),
  ).current;

  return (
    <View
      style={styles.hitArea}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      testID="budget-alerts-slider"
      accessibilityRole="adjustable"
      accessibilityValue={{ min: THRESHOLD_MIN, max: THRESHOLD_MAX, now: local }}
    >
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: valueToX(local) }]} />
      </View>
      <View style={[styles.thumb, { left: Math.max(0, valueToX(local) - 14) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Área táctil alta: la pista visual de 8px es casi imposible de agarrar.
  hitArea: { paddingVertical: 14, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#F0524D' },
  thumb: {
    position: 'absolute',
    top: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
});

export default ThresholdSlider;
