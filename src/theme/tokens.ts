/**
 * DESIGN TOKENS OFICIALES — MAESTRO A DOMICILIO (MÓVIL)
 * 
 * Cumplimiento estricto de WCAG 2.1 Nivel AA:
 * - Botón primario: #0369A1 (5.93:1 sobre blanco). #0284C7 reservado para foco e iconos grandes.
 * - Estados con tokens emparejados fg (texto/icono) y bg (fondo).
 * - Modos Claro y Oscuro calibrados.
 * - Objetivos táctiles mínimos: 48px estándar, 72px para teclas de PIN.
 * - Tipografía unificada: IBM Plex Sans + IBM Plex Mono con fallback a system-ui.
 */

import { Platform } from 'react-native';

export const BrandColors = {
  // Acción Primaria (WCAG AA Aprobado: 5.93:1 con texto blanco)
  primary: '#0369A1',
  primaryHover: '#075985',
  primaryActive: '#0c4a6e',

  // Resalte visual, anillo de foco y glifos grandes (NO usar como fondo con texto blanco)
  focusRing: '#0284C7',
  brandNavy: '#0F172A',
  brandWhite: '#FFFFFF',
};

export const StatusTokens = {
  light: {
    // Pendiente (PENDING_ASSIGNMENT, PENDING)
    pending: {
      fg: '#92400E',
      bg: '#FEF3C7',
      border: '#FDE68A',
      icon: 'time-outline' as const,
    },
    // Cotizado (QUOTED)
    quoted: {
      fg: '#0369A1',
      bg: '#E0F2FE',
      border: '#BAE6FD',
      icon: 'receipt-outline' as const,
    },
    // En camino (ACCEPTED)
    inTransit: {
      fg: '#1E40AF',
      bg: '#DBEAFE',
      border: '#BFDBFE',
      icon: 'navigate-outline' as const,
    },
    // En ejecución (IN_PROGRESS)
    inProgress: {
      fg: '#5B21B6',
      bg: '#EDE9FE',
      border: '#DDD6FE',
      icon: 'construct-outline' as const,
    },
    // Completado / Validado (COMPLETED, VALIDATED, ARCHIVED)
    completed: {
      fg: '#166534',
      bg: '#DCFCE7',
      border: '#BBF7D0',
      icon: 'checkmark-circle-outline' as const,
    },
    // Urgente / Requiere Reasignación / Cancelado
    danger: {
      fg: '#991B1B',
      bg: '#FEE2E2',
      border: '#FECACA',
      icon: 'alert-circle-outline' as const,
    },
  },
  dark: {
    // Fondo de tarjeta oscura en admin/móvil: #131D38
    pending: {
      fg: '#FBBF24', // Ámbar accesible sobre #131D38
      bg: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.35)',
      icon: 'time-outline' as const,
    },
    quoted: {
      fg: '#38BDF8', // Sky
      bg: 'rgba(56, 189, 248, 0.15)',
      border: 'rgba(56, 189, 248, 0.35)',
      icon: 'receipt-outline' as const,
    },
    inTransit: {
      fg: '#60A5FA', // Azul
      bg: 'rgba(96, 165, 250, 0.15)',
      border: 'rgba(96, 165, 250, 0.35)',
      icon: 'navigate-outline' as const,
    },
    inProgress: {
      fg: '#A78BFA', // Violeta
      bg: 'rgba(167, 139, 250, 0.15)',
      border: 'rgba(167, 139, 250, 0.35)',
      icon: 'construct-outline' as const,
    },
    completed: {
      fg: '#4ADE80', // Verde
      bg: 'rgba(74, 222, 128, 0.15)',
      border: 'rgba(74, 222, 128, 0.35)',
      icon: 'checkmark-circle-outline' as const,
    },
    danger: {
      fg: '#F87171', // Rojo
      bg: 'rgba(248, 113, 113, 0.15)',
      border: 'rgba(248, 113, 113, 0.35)',
      icon: 'alert-circle-outline' as const,
    },
  },
};

export const Palette = {
  light: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',         // Slate 900 (Contraste 15.8:1 sobre blanco)
    subtext: '#475569',      // Slate 600 (Contraste 5.5:1 sobre blanco)
    textMuted: '#64748B',    // Solo sobre fondo blanco
    primary: BrandColors.primary,
    border: '#E2E8F0',
    input: '#F1F5F9',
    primarySoft: '#F0F9FF',    // Fondo de selección / banner informativo
    primaryStrong: '#E0F2FE',  // Fondo de icono seleccionado
    onPrimary: '#FFFFFF',      // Texto sobre botón primario
    focusRing: BrandColors.focusRing,
    shadow: '#000000',
    states: StatusTokens.light,
  },
  dark: {
    background: '#0B1329',   // Deep navy frame
    card: '#131D38',         // Elevated sheet
    text: '#F8FAFC',         // Slate 50 (Contraste alto sobre oscuro)
    subtext: '#94A3B8',      // Slate 400 (Contraste 5.2:1 sobre #131D38)
    textMuted: '#94A3B8',    // WCAG AA garantizado sobre #131D38 (evita el 3.5:1 previo)
    primary: '#38BDF8',      // Sky claro para contraste en tema oscuro
    border: '#233055',
    input: '#1C294D',
    primarySoft: 'rgba(56, 189, 248, 0.12)',
    primaryStrong: 'rgba(56, 189, 248, 0.24)',
    onPrimary: '#0B1329',
    focusRing: '#38BDF8',
    shadow: '#000000',
    states: StatusTokens.dark,
  },
};

export const Spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space6: 24,
  space8: 32,
  space12: 48,
};

export const Radii = {
  sm: 4,   // Badges, micro-etiquetas
  md: 8,   // Botones de acción, inputs
  lg: 12,  // Tarjetas principales, modales
  full: 9999, // Píldoras
};

export const TouchTargets = {
  min: 48,     // Altura y ancho mínimo táctil móvil (48x48 px)
  pinKey: 72,  // Tecla numérica de PIN en pantalla para técnico (72x72 px)
};

export const TouchTarget = {
  mobileMin: 48,
  pinKeySize: 72,
};

export const SemanticColors = {
  primary: {
    main: BrandColors.primary,
    hover: BrandColors.primaryHover,
    active: BrandColors.primaryActive,
  },
};

export const DisplayPin = {
  mobile: {
    fontSize: 40,
    lineHeight: 48,
  },
  web: {
    fontSize: 32,
    lineHeight: 40,
  },
};

export const Typography = {
  fontFamily: Platform.select({
    ios: {
      sans: 'IBM Plex Sans, -apple-system, BlinkMacSystemFont, System',
      mono: 'IBM Plex Mono, SFMono-Regular, ui-monospace, Menlo, monospace',
    },
    android: {
      sans: 'sans-serif',
      mono: 'monospace',
    },
    default: {
      sans: 'IBM Plex Sans, system-ui, sans-serif',
      mono: 'IBM Plex Mono, monospace',
    },
  }),
  weights: {
    regular: '400' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
  // Cuerpo móvil mínimo 16 px; 12 px reservado para badges
  sizes: {
    badge: 12,
    caption: 14,
    body: 16,       // Mínimo para textos de lectura continua
    headingSm: 18,
    headingMd: 20,
    headingLg: 24,
    displayPin: 40, // Token display-pin para móvil (40px en texto, 48px con espaciado)
  },
  lineHeights: {
    badge: 16,
    caption: 20,
    body: 24,
    headingSm: 24,
    headingMd: 28,
    headingLg: 32,
    displayPin: 48,
  },
};
