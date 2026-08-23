/**
 * Uni Streak design tokens.
 *
 * This file is the single source of truth for every colour, radius, spacing
 * step and type size in the app. Components must never hardcode a hex value;
 * they read semantic tokens from `useTheme()`.
 *
 * Structure:
 *   palette  - raw brand ramps. Never consumed directly by components.
 *   light/dark - semantic tokens mapping meaning -> palette value.
 */

/** Raw colour ramps. Not for direct use in components. */
export const palette = {
  // Brand: a warm ember orange. Ownable, energetic, reads as "streak".
  ember50: '#FFF3ED',
  ember100: '#FFE1D1',
  ember200: '#FFC2A6',
  ember300: '#FF9C70',
  ember400: '#FF7A42',
  ember500: '#FF5A1F',
  ember600: '#ED3D06',
  ember700: '#C42D06',
  ember800: '#9B270D',
  ember900: '#7C240E',

  // Secondary: an electric violet used for university/community accents.
  violet50: '#F3F1FF',
  violet100: '#E9E5FF',
  violet200: '#D6CEFF',
  violet300: '#B9A9FF',
  violet400: '#987BFF',
  violet500: '#7C4DFF',
  violet600: '#6B2BF5',
  violet700: '#5C1CE1',
  violet800: '#4D18BD',
  violet900: '#41179A',

  // Neutrals, warm-tinted so the light theme reads as off-white not clinical.
  neutral0: '#FFFFFF',
  neutral25: '#FCFCFD',
  neutral50: '#F7F7F9',
  neutral100: '#EFEFF2',
  neutral200: '#E3E3E8',
  neutral300: '#CACAD3',
  neutral400: '#9E9EAB',
  neutral500: '#71717F',
  neutral600: '#52525E',
  neutral700: '#3F3F49',
  neutral800: '#27272E',
  neutral850: '#1C1C22',
  neutral900: '#141419',
  neutral950: '#0B0B0F',

  green500: '#12B76A',
  green600: '#039855',
  green100: '#D1FADF',
  amber500: '#F79009',
  amber600: '#DC6803',
  amber100: '#FEF0C7',
  red500: '#F04438',
  red600: '#D92D20',
  red100: '#FEE4E2',
  blue500: '#2E90FA',
  blue100: '#D1E9FF',

  // Streak fire gradient stops.
  fireFrom: '#FFB020',
  fireTo: '#FF3D00',
} as const;

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

/**
 * Semantic colour tokens. Every key must exist in both themes — the
 * `ThemeColors` type is derived from the light theme, so adding a token to
 * one theme and not the other is a compile error.
 */
const light = {
  background: palette.neutral50,
  backgroundElevated: palette.neutral0,
  surface: palette.neutral0,
  surfaceElevated: palette.neutral0,
  surfaceSunken: palette.neutral100,
  surfacePressed: palette.neutral100,

  textPrimary: palette.neutral900,
  textSecondary: palette.neutral600,
  textMuted: palette.neutral400,
  textInverse: palette.neutral0,
  textOnAccent: palette.neutral0,

  border: palette.neutral200,
  borderStrong: palette.neutral300,
  divider: palette.neutral100,

  accent: palette.ember500,
  accentPressed: palette.ember600,
  accentSubtle: palette.ember50,
  accentText: palette.ember700,

  secondary: palette.violet500,
  secondarySubtle: palette.violet50,
  secondaryText: palette.violet700,

  success: palette.green500,
  successSubtle: palette.green100,
  warning: palette.amber500,
  warningSubtle: palette.amber100,
  error: palette.red500,
  errorSubtle: palette.red100,
  info: palette.blue500,
  infoSubtle: palette.blue100,

  streak: palette.ember500,
  streakFrom: palette.fireFrom,
  streakTo: palette.fireTo,
  streakSubtle: palette.ember50,
  streakPending: palette.neutral400,
  streakExpiring: palette.amber500,

  notification: palette.red500,
  skeleton: palette.neutral100,
  skeletonHighlight: palette.neutral200,
  overlay: 'rgba(11, 11, 15, 0.45)',
  scrim: 'rgba(11, 11, 15, 0.72)',
  shadow: 'rgba(16, 16, 24, 0.10)',

  tabBar: palette.neutral0,
  tabBarActive: palette.ember500,
  tabBarInactive: palette.neutral400,
} as const;

export type ThemeColors = { [K in keyof typeof light]: string };

const dark: ThemeColors = {
  background: palette.neutral950,
  backgroundElevated: palette.neutral900,
  surface: palette.neutral900,
  surfaceElevated: palette.neutral850,
  surfaceSunken: palette.neutral950,
  surfacePressed: palette.neutral800,

  textPrimary: palette.neutral25,
  textSecondary: palette.neutral400,
  textMuted: palette.neutral500,
  textInverse: palette.neutral900,
  textOnAccent: palette.neutral0,

  border: palette.neutral800,
  borderStrong: palette.neutral700,
  divider: palette.neutral850,

  accent: palette.ember500,
  accentPressed: palette.ember400,
  accentSubtle: 'rgba(255, 90, 31, 0.14)',
  accentText: palette.ember300,

  secondary: palette.violet400,
  secondarySubtle: 'rgba(124, 77, 255, 0.16)',
  secondaryText: palette.violet300,

  success: palette.green500,
  successSubtle: 'rgba(18, 183, 106, 0.16)',
  warning: palette.amber500,
  warningSubtle: 'rgba(247, 144, 9, 0.16)',
  error: palette.red500,
  errorSubtle: 'rgba(240, 68, 56, 0.16)',
  info: palette.blue500,
  infoSubtle: 'rgba(46, 144, 250, 0.16)',

  streak: palette.ember400,
  streakFrom: palette.fireFrom,
  streakTo: palette.fireTo,
  streakSubtle: 'rgba(255, 90, 31, 0.16)',
  streakPending: palette.neutral500,
  streakExpiring: palette.amber500,

  notification: palette.red500,
  skeleton: palette.neutral850,
  skeletonHighlight: palette.neutral800,
  overlay: 'rgba(0, 0, 0, 0.60)',
  scrim: 'rgba(0, 0, 0, 0.80)',
  shadow: 'rgba(0, 0, 0, 0.50)',

  tabBar: palette.neutral900,
  tabBarActive: palette.ember400,
  tabBarInactive: palette.neutral500,
};

export const colorSchemes: Record<ThemeMode, ThemeColors> = { light, dark };

/** 4pt base spacing scale. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/**
 * Type ramp. `size` values are scaled at runtime by the OS font-scale setting
 * (see `useTypography`), so these are the unscaled baselines.
 */
export const typography = {
  display: { size: 32, lineHeight: 38, weight: '800' },
  h1: { size: 26, lineHeight: 32, weight: '800' },
  h2: { size: 21, lineHeight: 27, weight: '700' },
  h3: { size: 18, lineHeight: 24, weight: '700' },
  body: { size: 15, lineHeight: 21, weight: '400' },
  bodyStrong: { size: 15, lineHeight: 21, weight: '600' },
  callout: { size: 14, lineHeight: 19, weight: '400' },
  caption: { size: 13, lineHeight: 17, weight: '400' },
  captionStrong: { size: 13, lineHeight: 17, weight: '600' },
  micro: { size: 11, lineHeight: 14, weight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Platform-agnostic elevation presets, mapped to shadow + elevation. */
export const elevation = {
  none: { shadowOpacity: 0, shadowRadius: 0, elevation: 0, shadowOffset: { width: 0, height: 0 } },
  sm: { shadowOpacity: 1, shadowRadius: 6, elevation: 2, shadowOffset: { width: 0, height: 2 } },
  md: { shadowOpacity: 1, shadowRadius: 14, elevation: 5, shadowOffset: { width: 0, height: 6 } },
  lg: { shadowOpacity: 1, shadowRadius: 28, elevation: 12, shadowOffset: { width: 0, height: 12 } },
} as const;

export type ElevationLevel = keyof typeof elevation;

/** Animation durations in ms. Kept short: performance over spectacle (§6). */
export const duration = {
  instant: 90,
  fast: 160,
  normal: 240,
  slow: 380,
  celebration: 1200,
} as const;

/** Minimum touch target, per WCAG 2.5.5 / platform HIG (§42). */
export const MIN_TOUCH_TARGET = 44;
