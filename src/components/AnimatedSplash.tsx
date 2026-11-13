import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { runWhenIdle } from '../utils/idle';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const ICON_WIDTH = 200; // igual a imageWidth del splash nativo (app.config.js) para una transición sin saltos
const ICON_HEIGHT = Math.round((ICON_WIDTH * 326) / 338);
const TEXT_WIDTH = 270;
const TEXT_HEIGHT = Math.round((TEXT_WIDTH * 326) / 686);
const ICON_LIFT = 46;
const MIN_VISIBLE_MS = 1700;
const MAX_VISIBLE_MS = 6000;
const FADE_OUT_MS = 380;
const BACKGROUND = '#FFFFFF';

type Props = {
  /** true cuando la sesión ya se resolvió y la app de abajo puede mostrarse. */
  ready: boolean;
};

/**
 * Splash animado de marca. Se dibuja sobre toda la app mientras se resuelve la sesión;
 * la ruta correcta (login u home del rol) ya se está calculando debajo, así que al
 * desvanecerse el usuario cae directo en su destino.
 */
export function AnimatedSplash({ ready }: Props) {
  const [visible, setVisible] = useState(true);
  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);

  const iconScale = useSharedValue(0.9);
  const iconRotate = useSharedValue(-8);
  const iconLift = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textShift = useSharedValue(14);
  const overlayOpacity = useSharedValue(1);

  const hideNative = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    iconScale.value = withSequence(
      withSpring(1.06, { damping: 9, stiffness: 140 }),
      withSpring(1, { damping: 14, stiffness: 160 }),
    );
    iconRotate.value = withSequence(
      withTiming(6, { duration: 320, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 8, stiffness: 120 }),
    );
    iconLift.value = withDelay(700, withTiming(-ICON_LIFT, { duration: 480, easing: Easing.out(Easing.cubic) }));
    textOpacity.value = withDelay(850, withTiming(1, { duration: 520 }));
    textShift.value = withDelay(850, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }));

    const min = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const max = setTimeout(() => setMaxElapsed(true), MAX_VISIBLE_MS);
    return () => { clearTimeout(min); clearTimeout(max); };
  }, [iconScale, iconRotate, iconLift, textOpacity, textShift]);

  // Esperar a que termine el montaje de la pantalla de destino: así el desvanecido no compite con el trabajo de JS.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready) return;
    return runWhenIdle(() => requestAnimationFrame(() => setSettled(true)));
  }, [ready]);

  const canLeave = (ready && settled && minElapsed) || maxElapsed;

  useEffect(() => {
    if (!canLeave) return;
    overlayOpacity.value = withTiming(0, { duration: FADE_OUT_MS, easing: Easing.out(Easing.quad) });
    const done = setTimeout(() => setVisible(false), FADE_OUT_MS + 40);
    return () => clearTimeout(done);
  }, [canLeave, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: iconLift.value },
      { rotate: `${iconRotate.value}deg` },
      { scale: iconScale.value },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textShift.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      pointerEvents="auto"
      onLayout={hideNative}
      accessibilityLabel="Maestro a Domicilio, cargando"
      accessibilityRole="progressbar"
    >
      <Animated.Image
        source={require('../../assets/brand/logo-icon.png')}
        style={[styles.icon, iconStyle]}
        resizeMode="contain"
        accessible={false}
      />
      <Animated.Image
        source={require('../../assets/brand/logo-text.png')}
        style={[styles.text, textStyle]}
        resizeMode="contain"
        accessible={false}
      />
    </Animated.View>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKGROUND,
    zIndex: 1000,
    elevation: 1000,
  },
  icon: {
    position: 'absolute',
    width: ICON_WIDTH,
    height: ICON_HEIGHT,
    left: '50%',
    marginLeft: -ICON_WIDTH / 2,
    top: SCREEN_HEIGHT / 2 - ICON_HEIGHT / 2,
  },
  text: {
    position: 'absolute',
    width: TEXT_WIDTH,
    height: TEXT_HEIGHT,
    left: '50%',
    marginLeft: -TEXT_WIDTH / 2,
    top: SCREEN_HEIGHT / 2 + ICON_HEIGHT / 2 - ICON_LIFT - 20,
  },
});
