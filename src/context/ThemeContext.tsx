import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';


const Colors = {
  light: {
    background: '#F7F8FA',
    card: '#FFFFFF',
    text: '#1A202C',
    subtext: '#5B6B7B',
    primary: '#0F2B46',
    accent: '#DEB11D',
    border: '#E1E5EA',
    input: '#F9F9F9',
    icon: '#0F2B46',
    success: '#1E9E57',
    danger: '#DC2626',
    shadow: '#000000',
  },
  dark: {
    background: '#121212', // Negro suave (Estándar Material Design)
    card: '#1E1E1E',       // Gris oscuro para tarjetas
    text: '#E0E0E0',       // Blanco humo (no blanco puro para no quemar ojos)
    subtext: '#AAAAAA',
    primary: '#7FB2E5',    // Azul claro derivado del primario de marca, legible sobre negro
    accent: '#DEB11D',     // Dorado de marca
    border: '#333333',
    input: '#2C2C2C',
    icon: '#FFFFFF',
    success: '#66bb6a',    // Verde pastel
    danger: '#e57373',     // Rojo pastel
    shadow: '#000000',     // (CRITICAL FIX): Sombras blancas crashean el renderizado de Elevation en Android y causan tirones. Siempre deben ser oscuras.
  },
};

const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light');

  // Cargar preferencia guardada
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('appTheme');
      if (savedTheme) setTheme(savedTheme as any);
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await AsyncStorage.setItem('appTheme', newTheme);
  };

  const colors = Colors[theme];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook para usar los colores fácil
export const useTheme = () => useContext(ThemeContext);
