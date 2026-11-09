import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  AccessibilityInfo,
  GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

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
  hapticFeedback = 'light',
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
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

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View
        style={[
          style,
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
