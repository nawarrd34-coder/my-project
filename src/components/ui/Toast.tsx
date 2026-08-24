import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 2800;

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const show = useCallback((text: string, tone: ToastTone = 'info') => {
    setMessage({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message ? <ToastView key={message.id} message={message} /> : null}
    </ToastContext.Provider>
  );
};

const ToastView = ({ message }: { message: ToastMessage }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const tone = {
    info: { bg: theme.colors.surfaceElevated, fg: theme.colors.textPrimary, icon: 'information-circle' as const },
    success: { bg: theme.colors.successSubtle, fg: theme.colors.success, icon: 'checkmark-circle' as const },
    error: { bg: theme.colors.errorSubtle, fg: theme.colors.error, icon: 'alert-circle' as const },
  }[message.tone];

  return (
    <Animated.View
      entering={theme.reducedMotion ? undefined : FadeInUp.duration(theme.duration.fast)}
      exiting={theme.reducedMotion ? undefined : FadeOutUp.duration(theme.duration.fast)}
      pointerEvents="none"
      // Announced by screen readers without stealing focus.
      accessibilityLiveRegion="polite"
      accessible
      style={[
        styles.toast,
        {
          top: insets.top + theme.spacing.sm,
          backgroundColor: tone.bg,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          ...theme.shadow('md'),
        },
      ]}
    >
      <Ionicons name={tone.icon} size={18} color={tone.fg} />
      <Text variant="callout" style={{ color: tone.fg, flex: 1 }}>
        {message.text}
      </Text>
    </Animated.View>
  );
};

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    insetInlineStart: 16,
    insetInlineEnd: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
