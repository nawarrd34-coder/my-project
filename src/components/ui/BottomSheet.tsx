import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}

/**
 * Modal-backed sheet. Uses the platform Modal so it inherits correct focus
 * trapping and the Android back button, rather than reimplementing either.
 */
export const BottomSheet = ({ visible, onClose, title, children, contentStyle }: BottomSheetProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = theme.reducedMotion
      ? (visible ? 1 : 0)
      : withTiming(visible ? 1 : 0, { duration: theme.duration.normal });
  }, [visible, progress, theme.duration.normal, theme.reducedMotion]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 40 }],
    opacity: progress.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        accessibilityLabel={t('a11y.close')}
        accessibilityRole="button"
        onPress={onClose}
      />
      <Animated.View
        style={[
          sheetStyle,
          styles.sheet,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderTopLeftRadius: theme.radius.xxl,
            borderTopRightRadius: theme.radius.xxl,
            paddingBottom: insets.bottom + theme.spacing.lg,
          },
          contentStyle,
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />
        {title ? (
          <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
            <Text variant="h3" style={{ flex: 1 }}>
              {title}
            </Text>
            <IconButton icon="close" accessibilityLabel={t('a11y.close')} onPress={onClose} />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: theme.spacing.lg }}>{children}</View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8, maxHeight: '88%' },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
});
