import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'system' | 'dark' | 'light';
type ResolvedTheme = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  colors: typeof darkColors;
}

const darkColors = {
  background: '#000',
  card: '#1F2937',
  text: '#fff',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  accent: '#38BDF8',
  border: '#374151',
  tabBar: '#111',
  danger: '#EF4444',
};

const lightColors = {
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#0EA5E9',
  border: '#E5E7EB',
  tabBar: '#FFFFFF',
  danger: '#DC2626',
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  theme: 'dark',
  setMode: () => {},
  colors: darkColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then(stored => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem('theme_mode', newMode);
  };

  const theme: ResolvedTheme =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
