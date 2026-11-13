import React, { useMemo, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
  AccessibilityInfo,
  GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Propiedades que posicionan/dimensionan el control dentro de su padre. Deben vivir en el
 * Pressable exterior; si se aplican solo al Animated.View interno (como antes), width en %
 * y flex se resuelven contra un contenedor que se encoge y las tarjetas se deforman.
 */
const OUTER_LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'height', 'minWidth', 'minHeight',
  'maxWidth', 'maxHeight', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd', 'alignSelf', 'position',
  'top', 'right', 'bottom', 'left', 'zIndex', 'aspectRatio', 'display',
]);

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) (OUTER_LAYOUT_KEYS.has(key) ? outer : inner)[key] = flat[key];
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  children: React.ReactNode;
}

/**
 * AnimatedPressable — Componente táctil con respuesta inmediata
 * Principios Emil Kowalski:
 * - Escala sutil (0.97) en press-in con curva ease-out inmediata (<100ms)
 * - Retorno elástico natural al soltar
 * - Retroalimentación háptica nativa (Haptics.impactAsync)
 * - Respeta 'reducir movimiento' del sistema operativo
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  style,
  scaleTo = 0.97,
  hapticFeedback = 'none',
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}) => {
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handlePressIn = (e: GestureResponderEvent) => {
    if (disabled) return;

    if (hapticFeedback !== 'none') {
      try {
        if (hapticFeedback === 'light') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (hapticFeedback === 'medium') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (hapticFeedback === 'heavy') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (hapticFeedback === 'selection') {
          void Haptics.selectionAsync();
        }
      } catch {
        // Ignorar si haptics no está soportado en la plataforma actual
      }
    }

    if (!reduceMotion) {
      Animated.timing(scaleAnim, {
        toValue: scaleTo,
        duration: 90,
        useNativeDriver: true,
      }).start();
    }

    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (disabled) return;

    if (!reduceMotion) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }

    if (onPressOut) onPressOut(e);
  };

  const { outer, inner } = splitStyle(style);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
      style={outer}
    >
      <Animated.View
        style={[
          inner,
          styles.fill,
          !reduceMotion && {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

// flexBasis auto (no 0): con flex:1 un padre de alto automático colapsaría el contenido.
const styles = StyleSheet.create({ fill: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto' } });
