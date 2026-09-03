/**
 * Design system: "Aurora".
 *
 * Deliberately distinct from the previous warm-cream / orange treatment:
 * cool neutral grounds, an indigo -> violet primary ramp, a teal accent for
 * confirmation states, and softer, larger radii.
 */

export const colors = {
  bg: '#F5F6FC',
  bgElevated: '#FFFFFF',
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
  accent: '#00B8A9',
  accentSoft: '#E3F8F6',
  danger: '#E1355B',
  dangerSoft: '#FDECF0',
  onPrimary: '#FFFFFF',
};

/** Start/end pairs for gradient fills (LinearGradient `colors` prop). */
export const gradients = {
  primary: ['#5B5BD6', '#8B5CF6'] as const,
  primaryDim: ['#4442B8', '#6D46D4'] as const,
  hero: ['#3D3B9E', '#6D46D4', '#00B8A9'] as const,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
};

export const type = {
  display: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    color: colors.text,
  },
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
    color: colors.text,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
    color: colors.textSoft,
  },
  body: {
    fontSize: 15,
    color: colors.textSoft,
  },
  caption: {
    fontSize: 12.5,
    color: colors.muted,
  },
};

export const shadow = {
  card: {
    shadowColor: '#1A1B4B',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cta: {
    shadowColor: '#4442B8',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
