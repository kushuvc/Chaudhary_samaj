export const colors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: '#0f766e',
  primarySoft: '#ecfeff',
  danger: '#b91c1c',
  dangerSoft: '#fef2f2',
  accent: '#1d4ed8',
  accentSoft: '#eff6ff',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const type = {
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: '#334155',
  },
  caption: {
    fontSize: 12,
    color: colors.muted,
  },
};