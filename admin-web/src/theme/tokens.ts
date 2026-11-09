/**
 * DESIGN TOKENS OFICIALES — MAESTRO A DOMICILIO (ADMIN WEB)
 * Dirección Visual: Opción 1 «Herramienta Técnica Industrial»
 * 
 * Cumplimiento estricto WCAG 2.1 AA:
 * - Botón primario: fondo #0369A1 con texto blanco (Ratio 5.93:1, cumple AA).
 *   Prohibido #0284C7 con texto blanco (4.1:1, falla AA). #0284C7 solo para anillos de foco.
 * - Estados operativos con par fg (texto/icono) y bg (fondo) calibrado.
 * - Modo oscuro calibrado sobre fondo #131D38 con text-muted en #94A3B8 (5.38:1).
 * - Tipografía: IBM Plex Sans (texto) + IBM Plex Mono (datos, Soles, PIN, correlativos).
 * - Números tabulares obligatorios en cifras: font-variant-numeric: tabular-nums.
 * - Escala espacial matemática de 4 / 8 px.
 */

export const WebTokens = {
  colors: {
    brand: {
      primary: '#0369A1',         // Botón primario y enlaces activos (5.93:1 sobre blanco)
      primaryHover: '#075985',
      primaryActive: '#0c4a6e',
      focusRing: '#0284C7',       // Anillo de foco accesible de 2px
      brandNavy: '#0F172A',
      brandWhite: '#FFFFFF',
    },
    status: {
      light: {
        pending: {
          fg: '#92400E',          // Ratio 6.37:1 sobre #FEF3C7
          bg: '#FEF3C7',
          border: '#FDE68A',
        },
        quoted: {
          fg: '#0369A1',          // Ratio 5.27:1 sobre #E0F2FE
          bg: '#E0F2FE',
          border: '#BAE6FD',
        },
        inTransit: {
          fg: '#1E40AF',          // Ratio 7.15:1 sobre #DBEAFE
          bg: '#DBEAFE',
          border: '#BFDBFE',
        },
        inProgress: {
          fg: '#5B21B6',          // Ratio 7.57:1 sobre #EDE9FE
          bg: '#EDE9FE',
          border: '#DDD6FE',
        },
        completed: {
          fg: '#166534',          // Ratio 6.49:1 sobre #DCFCE7
          bg: '#DCFCE7',
          border: '#BBF7D0',
        },
        danger: {
          fg: '#991B1B',          // Ratio 6.80:1 sobre #FEE2E2
          bg: '#FEE2E2',
          border: '#FECACA',
        },
      },
      dark: {
        pending: {
          fg: '#FBBF24',          // Ratio 8.20:1 sobre #131D38
          bg: 'rgba(251, 191, 36, 0.16)',
          border: 'rgba(251, 191, 36, 0.35)',
        },
        quoted: {
          fg: '#38BDF8',          // Ratio 8.91:1 sobre #131D38
          bg: 'rgba(56, 189, 248, 0.16)',
          border: 'rgba(56, 189, 248, 0.35)',
        },
        inTransit: {
          fg: '#60A5FA',          // Ratio 7.43:1 sobre #131D38
          bg: 'rgba(96, 165, 250, 0.16)',
          border: 'rgba(96, 165, 250, 0.35)',
        },
        inProgress: {
          fg: '#A78BFA',          // Ratio 6.84:1 sobre #131D38
          bg: 'rgba(167, 139, 250, 0.16)',
          border: 'rgba(167, 139, 250, 0.35)',
        },
        completed: {
          fg: '#4ADE80',          // Ratio 10.51:1 sobre #131D38
          bg: 'rgba(74, 222, 128, 0.16)',
          border: 'rgba(74, 222, 128, 0.35)',
        },
        danger: {
          fg: '#F87171',          // Ratio 6.52:1 sobre #131D38
          bg: 'rgba(248, 113, 113, 0.16)',
          border: 'rgba(248, 113, 113, 0.35)',
        },
      },
    },
    surfaces: {
      light: {
        ground: '#F8FAFC',        // Slate 50
        sheet: '#FFFFFF',         // Tarjetas y modales blancos
        subtle: '#F1F5F9',        // Slate 100
        border: '#E2E8F0',        // Slate 200
        textPrimary: '#0F172A',   // Slate 900 (15.8:1)
        textSecondary: '#475569', // Slate 600 (7.00:1)
        textMuted: '#64748B',     // Slate 500 (4.65:1 sobre blanco)
      },
      dark: {
        ground: '#0B0F19',        // Fondo noche pizarra
        sheet: '#131D38',         // Tarjetas y modales oscuros
        subtle: '#1C294D',
        border: '#233055',
        textPrimary: '#F8FAFC',   // 14.2:1 sobre #131D38
        textSecondary: '#94A3B8', // 5.38:1 sobre #131D38
        textMuted: '#94A3B8',     // 5.38:1 sobre #131D38 (cumple AA)
      },
    },
  },
  typography: {
    fontBody: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'IBM Plex Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace",
    displayPin: {
      fontSize: '32px',
      lineHeight: '40px',
      fontWeight: '700',
    },
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
  },
  radii: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  layout: {
    maxContentWidth: '1440px',
    drawerWidth: '560px',
    drawerWidthWide: '640px',
  },
};
