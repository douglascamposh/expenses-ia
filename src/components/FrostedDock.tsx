import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Blur progresivo tras los flotantes (mockup): el degradado actúa como
 * máscara — arriba el blur desaparece, abajo es completo. No captura toques.
 * El tint sigue el tema: en claro aclara, en oscuro oscurece (si no, sobre
 * el fondo oscuro el degradado se veía blanquecino).
 */
export function FrostedDock({ height = 140 }: { height?: number }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
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
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
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
