import type { Ionicons } from '@expo/vector-icons';

/** Definición única de las pestañas principales: etiquetas, iconos, orden y rutas por rol. */
export type TabId = 'service' | 'history' | 'profile';
export type TabRole = 'CLIENT' | 'PROVIDER';

export type TabDef = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

export const TAB_ORDER: TabId[] = ['service', 'history', 'profile'];

export const TABS: Record<TabId, TabDef> = {
  service: { label: 'Servicio', icon: 'construct-outline', activeIcon: 'construct' },
  history: { label: 'Historial', icon: 'receipt-outline', activeIcon: 'receipt' },
  profile: { label: 'Mi Perfil', icon: 'person-outline', activeIcon: 'person' },
};

export const TAB_ROUTES: Record<TabRole, Record<TabId, string>> = {
  CLIENT: { service: '/client/home', history: '/client/history', profile: '/profile' },
  PROVIDER: { service: '/provider/home', history: '/provider/history', profile: '/profile' },
};

const PATH_TO_TAB: Record<string, TabId> = {
  '/client/home': 'service',
  '/provider/home': 'service',
  '/client/history': 'history',
  '/provider/history': 'history',
  '/profile': 'profile',
  '/profile/index': 'profile',
};

export function tabForPath(pathname: string): TabId | null {
  return PATH_TO_TAB[pathname] ?? null;
}
