import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import type { ThemeMode } from '../types';
import { loadJson, saveJson } from '../services/localData';

type ResolvedTheme = 'light' | 'dark';

export interface ThemePalette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  accent: string;
  accentSoft: string;
  tabBg: string;
  cardBg: string;
}

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  palette: ThemePalette;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const THEME_STORAGE_KEY = 'chaudhary_mobile_theme_mode';

const lightPalette: ThemePalette = {
  bg: '#f5efe7',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: '#ea580c',
  primarySoft: '#fff7ed',
  danger: '#b91c1c',
  dangerSoft: '#fef2f2',
  accent: '#334155',
  accentSoft: '#f1f5f9',
  tabBg: '#ffffff',
  cardBg: '#ffffff',
};

const darkPalette: ThemePalette = {
  bg: '#0b1220',
  surface: '#111827',
  text: '#e5e7eb',
  muted: '#94a3b8',
  border: '#1f2937',
  primary: '#fb923c',
  primarySoft: '#3a2313',
  danger: '#f87171',
  dangerSoft: '#3f1717',
  accent: '#cbd5e1',
  accentSoft: '#1b2433',
  tabBg: '#111827',
  cardBg: '#111827',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  }
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const saved = await loadJson<ThemeMode>(THEME_STORAGE_KEY, 'light');
      if (!mounted) {
        return;
      }
      setThemeModeState(saved);
      setResolvedTheme(resolveTheme(saved));
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setResolvedTheme(resolveTheme(themeMode));
  }, [themeMode]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(() => {
      if (themeMode === 'system') {
        setResolvedTheme(resolveTheme('system'));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [themeMode]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await saveJson<ThemeMode>(THEME_STORAGE_KEY, mode);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      palette: resolvedTheme === 'dark' ? darkPalette : lightPalette,
      setThemeMode,
    }),
    [themeMode, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}
