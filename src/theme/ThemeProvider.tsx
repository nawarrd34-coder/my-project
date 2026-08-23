import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import {
  colorSchemes,
  duration,
  elevation,
  MIN_TOUCH_TARGET,
  radius,
  spacing,
  typography,
  type ElevationLevel,
  type ThemeColors,
  type ThemeMode,
  type TypographyVariant,
} from './tokens';
import { usePreferences } from '@/store/preferences';

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  duration: typeof duration;
  minTouchTarget: number;
  /** Text style for a type ramp entry, already scaled for accessibility. */
  text: (variant: TypographyVariant) => TextStyle;
  /** Themed shadow for an elevation level. */
  shadow: (level: ElevationLevel) => ViewStyle;
  /** True when the user asked for reduced motion (OS setting or in-app). */
  reducedMotion: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const themePreference = usePreferences((s) => s.themePreference);
  const reducedMotionPref = usePreferences((s) => s.reducedMotion);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setSystemReducedMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const mode: ThemeMode =
    themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;

  const value = useMemo<Theme>(() => {
    const colors = colorSchemes[mode];
    return {
      mode,
      colors,
      spacing,
      radius,
      duration,
      minTouchTarget: MIN_TOUCH_TARGET,
      reducedMotion: reducedMotionPref || systemReducedMotion,
      text: (variant) => {
        const t = typography[variant];
        return {
          fontSize: t.size,
          lineHeight: t.lineHeight,
          fontWeight: t.weight as TextStyle['fontWeight'],
          color: colors.textPrimary,
        };
      },
      shadow: (level) => {
        const e = elevation[level];
        return {
          shadowColor: colors.shadow,
          shadowOffset: e.shadowOffset,
          shadowOpacity: e.shadowOpacity,
          shadowRadius: e.shadowRadius,
          elevation: e.elevation,
        };
      },
    };
  }, [mode, reducedMotionPref, systemReducedMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside a ThemeProvider');
  return theme;
};

/**
 * Build styles that depend on the theme without recreating the object on
 * every render.
 *
 *   const styles = useThemedStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 */
export const useThemedStyles = <T,>(factory: (theme: Theme) => T): T => {
  const theme = useTheme();
  // Intentionally keyed on `theme` alone: callers pass an inline factory whose
  // identity changes every render, which would defeat the memo entirely.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(theme), [theme]);
};
