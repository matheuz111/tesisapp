import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/** Bloque gris con pulso suave. Respeta el tema y no usa spinners ciegos. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), withTiming(0.55, { duration: 750, easing: Easing.inOut(Easing.quad) })),
      -1,
    );
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.input }, animated, style]} />;
}

/** Silueta de la pantalla de inicio: cabecera, bloque de mapa/estado y grilla de opciones. */
export function HomeSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando tu información"
    >
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width={150} height={12} />
          <Skeleton width={210} height={26} />
          <Skeleton width={130} height={12} />
        </View>
        <Skeleton width={42} height={42} radius={12} />
        <Skeleton width={42} height={42} radius={12} />
      </View>
      <Skeleton height={160} radius={12} style={{ marginTop: 20 }} />
      <View style={[styles.row, { marginTop: 16 }]}>
        <Skeleton width="48.5%" height={64} radius={12} />
        <Skeleton width="48.5%" height={64} radius={12} />
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <Skeleton width="48.5%" height={64} radius={12} />
        <Skeleton width="48.5%" height={64} radius={12} />
      </View>
    </View>
  );
}

/** Lista de tarjetas (historiales). Mantiene el alto para evitar saltos de maquetación. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Cargando historial">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Skeleton width={120} height={12} />
            <Skeleton width={90} height={22} radius={4} />
          </View>
          <Skeleton width="70%" height={16} style={{ marginTop: 12 }} />
          <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  list: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
});
