/**
 * THEME TOKENS — MAESTRO A DOMICILIO
 * Centraliza variables de color y tipografía con base en src/theme/tokens.ts
 */

import { Palette, Typography } from '../src/theme/tokens';

export const Colors = {
  light: {
    text: Palette.light.text,
    background: Palette.light.background,
    tint: Palette.light.primary,
    icon: Palette.light.subtext,
    tabIconDefault: Palette.light.subtext,
    tabIconSelected: Palette.light.primary,
  },
  dark: {
    text: Palette.dark.text,
    background: Palette.dark.background,
    tint: Palette.dark.primary,
    icon: Palette.dark.subtext,
    tabIconDefault: Palette.dark.subtext,
    tabIconSelected: Palette.dark.primary,
  },
};

export const Fonts = {
  sans: Typography.fontFamily.sans,
  mono: Typography.fontFamily.mono,
  serif: 'serif',
  rounded: Typography.fontFamily.sans,
};
