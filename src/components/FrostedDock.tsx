import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Blur progresivo tras los flotantes (mockup): el degradado actúa como
 * máscara — arriba el blur desaparece, abajo es completo. No captura toques.
 */
export function FrostedDock({ height = 140 }: { height?: number }) {
  return (
    <View style={[styles.dock, { height }]} pointerEvents="none">
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)', 'black']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
