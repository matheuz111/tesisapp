import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleProp,
  ViewStyle,
  AccessibilityInfo,
  Easing,
} from 'react-native';

interface AnimatedFadeInProps {
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  translateDistance?: number;
  children: React.ReactNode;
}

/**
 * AnimatedFadeIn — Transición de entrada suave para tarjetas y modales
 * Principios Emil Kowalski:
 * - Duración corta (200-240ms)
 * - Curva de desaceleración (ease-out cubic / Easing.out(Easing.cubic))
 * - Desplazamiento mínimo (8px a 12px) para evitar saltos bruscos
 * - Desactivado automáticamente si el usuario tiene "reducir movimiento" activo
 */
export const AnimatedFadeIn: React.FC<AnimatedFadeInProps> = ({
  style,
  delay = 0,
  duration = 220,
  translateDistance = 8,
  children,
}) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(translateDistance)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotion(enabled);
          if (enabled) {
            opacityAnim.setValue(1);
            translateAnim.setValue(0);
          } else {
            Animated.parallel([
              Animated.timing(opacityAnim, {
                toValue: 1,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(translateAnim, {
                toValue: 0,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
      })
      .catch(() => {
        // Fallback standard
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateAnim, {
            toValue: 0,
            duration,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });

    return () => {
      mounted = false;
    };
  }, [delay, duration, translateDistance]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: opacityAnim,
          transform: [{ translateY: translateAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
