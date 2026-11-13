import { useTheme } from '../../context/ThemeContext';
import { BaseColors } from './BaseTokens';

/**
 * Misma forma que BaseColors, pero con valores del tema activo.
 * Los componentes base hacen `const BaseColors = useBaseColors()` para que el modo
 * oscuro funcione sin tocar cada estilo. Las claves `white` y `gray*` son *superficies y
 * tonos de texto*: en oscuro se invierten. Para texto sobre un fondo sólido (botón
 * primario, badge de notificación) usa `onSolid`, que nunca se invierte a ciegas.
 */
export type BaseColorSet = Omit<typeof BaseColors, never> & {
  /** Texto/icono sobre fondos sólidos de acento, positivo, negativo o advertencia. */
  onSolid: string;
  /** Texto/icono sobre el fondo sólido de acento. */
  onAccent: string;
  /** Fondo de pantalla (detrás de las tarjetas). */
  screen: string;
  /** Fondo suave de acento (selección, banner informativo). */
  accentSoft: string;
  accentBorder: string;
  isDark: boolean;
};

const light: BaseColorSet = {
  ...BaseColors,
  onSolid: '#FFFFFF',
  onAccent: '#FFFFFF',
  screen: '#F8FAFC',
  accentSoft: '#F0F9FF',
  accentBorder: '#BAE6FD',
  isDark: false,
};

const dark: BaseColorSet = {
  ...BaseColors,
  white: '#131D38', // superficie de tarjeta (Palette.dark.card)
  black: '#000000',
  accent: '#38BDF8',
  accentHover: '#7DD3FC',
  accentLight: 'rgba(56, 189, 248, 0.16)',
  accentDark: '#BAE6FD',
  gray50: '#0F1830',
  gray100: '#1C294D',
  gray200: '#233055',
  gray300: '#33426B',
  gray400: '#8B98B8',
  gray500: '#94A3B8',
  gray600: '#B4C0D4',
  gray700: '#CBD5E1',
  gray800: '#E2E8F0',
  gray900: '#F8FAFC',
  positive: '#4ADE80',
  positiveLight: 'rgba(74, 222, 128, 0.15)',
  positiveBorder: 'rgba(74, 222, 128, 0.35)',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.15)',
  warningBorder: 'rgba(251, 191, 36, 0.35)',
  negative: '#F87171',
  negativeLight: 'rgba(248, 113, 113, 0.15)',
  negativeBorder: 'rgba(248, 113, 113, 0.35)',
  scrim: 'rgba(2, 6, 23, 0.75)',
  sheetGrabber: '#33426B',
  onSolid: '#0B1329', // texto oscuro sobre acentos claros del tema oscuro (contraste AA)
  onAccent: '#0B1329',
  screen: '#0B1329',
  accentSoft: 'rgba(56, 189, 248, 0.12)',
  accentBorder: 'rgba(56, 189, 248, 0.4)',
  isDark: true,
};

export function useBaseColors(): BaseColorSet {
  const { theme } = useTheme();
  return theme === 'dark' ? dark : light;
}
