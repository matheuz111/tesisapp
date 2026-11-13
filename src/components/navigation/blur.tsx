import { BlurTargetView, BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import React, { type RefObject } from 'react';
import { Platform, View, type ViewProps } from 'react-native';

/**
 * expo-blur es un módulo nativo: un build de desarrollo instalado antes de agregarlo no lo contiene y
 * usar sus vistas provoca un cierre nativo (IllegalViewOperationException). Se comprueba una vez y,
 * si falta, se usan vistas simples con fondo semitransparente.
 */
const BLUR_AVAILABLE = Platform.OS === 'web' || requireOptionalNativeModule('ExpoBlur') != null;

type TargetProps = ViewProps & { targetRef: RefObject<View | null> };

/** Envuelve el contenido que se desenfoca en Android. Sin módulo nativo es un View normal. */
export function BlurTarget({ targetRef, ...props }: TargetProps) {
  return BLUR_AVAILABLE ? <BlurTargetView ref={targetRef} {...props} /> : <View ref={targetRef} {...props} />;
}

type BackdropProps = ViewProps & {
  targetRef: RefObject<View | null>;
  isDark: boolean;
};

/** Franja desenfocada (o, sin módulo nativo, un fondo casi opaco del color del tema). */
export function BlurBackdrop({ targetRef, isDark, style, ...props }: BackdropProps) {
  if (!BLUR_AVAILABLE) {
    return <View {...props} style={[style, { backgroundColor: isDark ? 'rgba(11, 19, 41, 0.94)' : 'rgba(248, 250, 252, 0.94)' }]} />;
  }
  return (
    <BlurView
      {...props}
      blurTarget={targetRef}
      blurMethod="dimezisBlurViewSdk31Plus"
      tint={isDark ? 'dark' : 'light'}
      intensity={Platform.OS === 'ios' ? 55 : 70}
      style={style}
    />
  );
}
