import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Palette, StatusTokens, Spacing, Radii, TouchTargets, Typography } from '../theme/tokens';

export type ThemeColors = typeof Palette.light & {
  icon: string;
  success: string;
  danger: string;
};

export interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  colors: ThemeColors;
  spacing: typeof Spacing;
  radii: typeof Radii;
  touchTargets: typeof TouchTargets;
  typography: typeof Typography;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('appTheme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    };
    void loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await AsyncStorage.setItem('appTheme', newTheme);
  };

  const activePalette = Palette[theme];

  const colors = useMemo(() => ({
    ...activePalette,
    // Compatibilidad backward para componentes existentes
    icon: activePalette.text,
    success: theme === 'light' ? StatusTokens.light.completed.fg : StatusTokens.dark.completed.fg,
    danger: theme === 'light' ? StatusTokens.light.danger.fg : StatusTokens.dark.danger.fg,
  }), [activePalette, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        colors,
        spacing: Spacing,
        radii: Radii,
        touchTargets: TouchTargets,
        typography: Typography,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback defensivo si se usa fuera del provider
    const fallbackPalette = Palette.light;
    return {
      theme: 'light' as const,
      toggleTheme: () => {},
      colors: {
        ...fallbackPalette,
        icon: fallbackPalette.text,
        success: StatusTokens.light.completed.fg,
        danger: StatusTokens.light.danger.fg,
      },
      spacing: Spacing,
      radii: Radii,
      touchTargets: TouchTargets,
      typography: Typography,
    };
  }
  return context;
};
