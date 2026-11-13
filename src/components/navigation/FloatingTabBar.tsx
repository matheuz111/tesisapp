import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { memo, useCallback, useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { runWhenIdle } from '../../utils/idle';
import { BlurBackdrop } from './blur';
import { TAB_ORDER, TABS, TAB_ROUTES, tabForPath, type TabId } from './tabs';

const BAR_HEIGHT = 64;
const SIDE_MARGIN = 20;
const TOP_PADDING = 8;
const MIN_BOTTOM_PADDING = 10;
// Texto blanco sobre este azul: 5.9:1 (AA) en claro y oscuro.
const ACTIVE_TILE = '#0369A1';
// Iconos inactivos: AA sobre la píldora de cada tema (oscuro: 5.2:1 sobre navy; claro: 4.8:1 sobre blanco).
const INACTIVE_ICON = { dark: '#94A3B8', light: '#64748B' } as const;

/** Alto que las pantallas con barra deben reservar al final de su contenido para que nada quede tapado. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + TOP_PADDING + Math.max(insets.bottom, MIN_BOTTOM_PADDING) + 8;
}

type Props = {
  /** Vista objetivo del desenfoque en Android (BlurTargetView que envuelve las pantallas). */
  blurTarget: RefObject<View | null>;
};

/**
 * Barra de navegación flotante (Servicio · Historial · Mi Perfil) para cliente y técnico.
 * Una píldora sobre una franja con desenfoque: el contenido que se desplaza por debajo se ve borroso.
 * Se adapta al tema (tinte del desenfoque y colores de la píldora) y se oculta con el teclado abierto.
 */
export function FloatingTabBar({ blurTarget }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { profile } = useSession();
  const keyboardOpen = useKeyboardVisible();

  const role = profile?.role;
  const active = tabForPath(pathname);

  // Monta en segundo plano las otras pestañas del rol: al tocarlas ya están listas y la transición no espera al montaje.
  useEffect(() => {
    if (role !== 'CLIENT' && role !== 'PROVIDER') return;
    return runWhenIdle(() => {
      for (const id of TAB_ORDER) router.prefetch(TAB_ROUTES[role][id] as Href);
    }, 1500);
  }, [role, router]);

  const goTo = useCallback((id: TabId) => {
    if (!role || (role !== 'CLIENT' && role !== 'PROVIDER') || id === active) return;
    router.navigate(TAB_ROUTES[role][id] as Href);
  }, [role, active, router]);

  if ((role !== 'CLIENT' && role !== 'PROVIDER') || !active || keyboardOpen) return null;

  const isDark = theme === 'dark';
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_PADDING);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {/* Franja desenfocada: se nota cuando el contenido pasa por debajo de la barra. */}
      <BlurBackdrop
        pointerEvents="none"
        targetRef={blurTarget}
        isDark={isDark}
        style={[styles.blur, { height: BAR_HEIGHT + TOP_PADDING + bottomPadding, borderTopColor: colors.border }]}
      />
      <View style={{ paddingHorizontal: SIDE_MARGIN, paddingTop: TOP_PADDING, paddingBottom: bottomPadding }}>
        <View
          accessibilityRole="tablist"
          style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.border }, isDark ? styles.barShadowDark : styles.barShadowLight]}
        >
          {TAB_ORDER.map((id) => (
            <TabItem key={id} id={id} active={id === active} inactiveColor={INACTIVE_ICON[isDark ? 'dark' : 'light']} onPress={goTo} />
          ))}
        </View>
      </View>
    </View>
  );
}

type TabItemProps = { id: TabId; active: boolean; inactiveColor: string; onPress: (id: TabId) => void };

const TabItem = memo(function TabItem({ id, active, inactiveColor, onPress }: TabItemProps) {
  const tab = TABS[id];
  return (
    <Animated.View
      layout={LinearTransition.springify().damping(20).stiffness(220)}
      style={[styles.slot, active ? styles.slotActive : styles.slotIdle]}
    >
      <Pressable
        onPress={() => onPress(id)}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: active }}
        hitSlop={{ top: 6, bottom: 6 }}
        style={[styles.item, active && styles.itemActive]}
      >
        <Ionicons name={active ? tab.activeIcon : tab.icon} size={22} color={active ? '#FFFFFF' : inactiveColor} />
        {active ? (
          <Animated.Text entering={FadeIn.duration(160)} exiting={FadeOut.duration(80)} numberOfLines={1} style={styles.label}>
            {tab.label}
          </Animated.Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  blur: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 10,
  },
  barShadowDark: { shadowOpacity: 0.35 },
  barShadowLight: { shadowOpacity: 0.14 },
  slot: { height: '100%' },
  slotActive: { flex: 1.7 },
  slotIdle: { flex: 1 },
  item: {
    flex: 1,
    minHeight: 48,
    borderRadius: (BAR_HEIGHT - 16) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  itemActive: { backgroundColor: ACTIVE_TILE },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
