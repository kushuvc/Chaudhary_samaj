import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import type { ThemeMode } from '../types';
import { loadJson, saveJson } from '../services/localData';

type ResolvedTheme = 'light' | 'dark';

export interface ThemePalette {
  bg: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textSoft: string;
  muted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  violet: string;
  danger: string;
  dangerSoft: string;
  accent: string;
  accentSoft: string;
  onPrimary: string;
  tabBg: string;
  cardBg: string;
  /** Gradient ramp for hero surfaces and primary CTAs. */
  gradient: readonly [string, string];
}

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  palette: ThemePalette;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const THEME_STORAGE_KEY = 'chaudhary_mobile_theme_mode';

const lightPalette: ThemePalette = {
  bg: '#F5F6FC',
  surface: '#FFFFFF',
  surfaceSunken: '#EEF0F9',
  text: '#0F1222',
  textSoft: '#3F4460',
  muted: '#7A80A0',
  border: '#E4E7F2',
  borderStrong: '#CDD2E6',
  primary: '#5B5BD6',
  primaryDeep: '#4442B8',
  primarySoft: '#EDEDFC',
  violet: '#8B5CF6',
  danger: '#E1355B',
  dangerSoft: '#FDECF0',
  accent: '#00B8A9',
  accentSoft: '#E3F8F6',
  onPrimary: '#FFFFFF',
  tabBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  gradient: ['#5B5BD6', '#8B5CF6'],
};

const darkPalette: ThemePalette = {
  bg: '#0A0B14',
  surface: '#141625',
  surfaceSunken: '#1C1F31',
  text: '#ECEDF5',
  textSoft: '#B9BDD4',
  muted: '#8085A3',
  border: '#242840',
  borderStrong: '#343957',
  primary: '#8B8BFF',
  primaryDeep: '#6C6CF0',
  primarySoft: '#1E2040',
  violet: '#A78BFA',
  danger: '#FF6285',
  dangerSoft: '#3A1622',
  accent: '#2DD4BF',
  accentSoft: '#0E2E2C',
  onPrimary: '#0A0B14',
  tabBg: '#141625',
  cardBg: '#141625',
  gradient: ['#6C6CF0', '#A78BFA'],
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
