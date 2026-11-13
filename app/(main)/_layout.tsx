import { Tabs } from 'expo-router';
import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { BlurTarget } from '../../src/components/navigation/blur';
import { FloatingTabBar } from '../../src/components/navigation/FloatingTabBar';

/**
 * Pantallas principales de cliente y técnico. Usan Tabs (no Stack) para que cada pantalla se monte
 * una sola vez y se conserve al cambiar de pestaña: sin remontar, sin esqueletos de carga ni tirones.
 * El orden de las pantallas define la dirección de la transición ("shift"): derecha = adelante.
 * La barra es propia y flotante; el desenfoque de Android necesita saber qué vista desenfocar.
 */
export default function MainLayout() {
  const blurTarget = useRef<View | null>(null);
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BlurTarget targetRef={blurTarget} style={{ flex: 1 }}>
        <Tabs
          backBehavior="history"
          tabBar={() => null}
          screenOptions={{
            headerShown: false,
            animation: 'shift',
            lazy: true,
            freezeOnBlur: true,
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          <Tabs.Screen name="client/home" />
          <Tabs.Screen name="client/history" />
          <Tabs.Screen name="provider/home" />
          <Tabs.Screen name="provider/history" />
          <Tabs.Screen name="profile/index" />
        </Tabs>
      </BlurTarget>
      <FloatingTabBar blurTarget={blurTarget} />
    </View>
  );
}
