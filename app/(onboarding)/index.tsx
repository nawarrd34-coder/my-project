import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[theme.colors.streakFrom, theme.colors.streakTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + theme.spacing.giant }]}
      >
        <Text style={styles.flame}>🔥</Text>
        <Text variant="display" style={{ color: '#FFFFFF' }}>
          {t('common.appName')}
        </Text>
      </LinearGradient>

      <View
        style={{
          flex: 1,
          padding: theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xl,
          gap: theme.spacing.md,
          justifyContent: 'flex-end',
        }}
      >
        <Text variant="h1">{t('onboarding.welcomeTitle')}</Text>
        <Text variant="body" color="secondary">
          {t('onboarding.welcomeBody')}
        </Text>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button
            label={t('onboarding.getStarted')}
            size="lg"
            fullWidth
            onPress={() => router.push('/(onboarding)/language')}
          />
          <Button
            label={t('onboarding.haveAccount')}
            variant="ghost"
            fullWidth
            onPress={() => router.push({ pathname: '/(onboarding)/account', params: { mode: 'signin' } })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { height: '46%', alignItems: 'center', justifyContent: 'center', gap: 12 },
  flame: { fontSize: 64 },
});
