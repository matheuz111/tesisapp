import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. DEFINIR PALETAS DE COLORES
const Colors = {
  light: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#333333',
    subtext: '#666666',
    primary: '#007bff',
    border: '#EEEEEE',
    input: '#F9F9F9',
    icon: '#333333',
    success: '#28a745',
    danger: '#dc3545',
    shadow: '#000000',
  },
  dark: {
    background: '#121212', // Negro suave (Estándar Material Design)
    card: '#1E1E1E',       // Gris oscuro para tarjetas
    text: '#E0E0E0',       // Blanco humo (no blanco puro para no quemar ojos)
    subtext: '#AAAAAA',
    primary: '#4dabf5',    // Azul más claro para que resalte en negro
    border: '#333333',
    input: '#2C2C2C',
    icon: '#FFFFFF',
    success: '#66bb6a',    // Verde pastel
    danger: '#e57373',     // Rojo pastel
    shadow: '#ffffff',     // Sombras sutiles
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