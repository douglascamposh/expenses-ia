import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/ui';

type Props = {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
};

/** Anillo de progreso (0-100 visual; rojo si pct > 1). */
export function ProgressRing({ pct, size = 88, stroke = 9, color = '#2F80FF', track = '#E4E2DE' }: Props) {
  const normalized = Math.max(0, pct ?? 0);
  const over = normalized > 1;
  const frac = Math.min(normalized, 1);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ringColor = over ? '#EF4444' : color;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - frac)}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text variant="smallBold">{Math.round(normalized * 100)}%</Text>
      </View>
    </View>
  );
}
