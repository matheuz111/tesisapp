import { BrandColors } from '../../theme/tokens';

/**
 * BASE GALLERY DESIGN SYSTEM TOKENS
 * Inspirado en "Base Gallery UI Kit for Figma"
 * Adaptado a Maestro a Domicilio (Mobile / React Native)
 */

export const BaseColors = {
  // Brand & Accent (Base Gallery)
  black: '#000000',
  white: '#FFFFFF',
  accent: BrandColors.primary,         // Una sola fuente de verdad: theme/tokens.ts
  accentHover: BrandColors.primaryHover,
  accentLight: '#E0F2FE',
  accentDark: BrandColors.primaryActive,

  // Grayscale (Base Gallery scale)
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Semantics (Base Gallery System states)
  positive: '#059669',       // Éxito / Culminado
  positiveLight: '#ECFDF5',
  positiveBorder: '#A7F3D0',

  warning: '#D97706',        // Ámbar / Pendiente / Alerta
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',

  negative: '#DC2626',       // Error / Reasignar / Cancelado
  negativeLight: '#FEF2F2',
  negativeBorder: '#FECACA',

  // Scrim & Overlays
  scrim: 'rgba(15, 23, 42, 0.65)',
  sheetGrabber: '#CBD5E1',
};

export const BaseRadii = {
  none: 0,
  sm: 4,     // Tags, badges
  md: 8,     // Botones estándar, inputs
  lg: 12,    // Tiles, cards
  xl: 16,    // Modal sheet top corners, dialogs
  full: 9999, // Pills, circular buttons
};

export const BaseTypography = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 28,
  },
  lineHeights: {
    xs: 15,
    sm: 18,
    base: 22,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};

export const BaseElevation = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const BaseSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

