import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui/IconButton';
import { SettingRow } from '@/components/ui/SettingRow';
import { SettingSection } from '@/components/ui/SettingSection';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGE_LABELS } from '@/locales';
import { backChevron } from '@/lib/rtl';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const signOut = useSession((s) => s.signOut);
  const resetPreferences = usePreferences((s) => s.reset);
  const hapticsEnabled = usePreferences((s) => s.hapticsEnabled);
  const setHapticsEnabled = usePreferences((s) => s.setHapticsEnabled);
  const reducedMotion = usePreferences((s) => s.reducedMotion);
  const setReducedMotion = usePreferences((s) => s.setReducedMotion);
  const themePreference = usePreferences((s) => s.themePreference);

  const themeLabel = {
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
    system: t('settings.themeSystem'),
  }[themePreference];

  const confirmSignOut = () => {
    Alert.alert(t('auth.signOutConfirmTitle'), t('auth.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.signOut'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await signOut();
            // Clear local preferences so the next user on this device does not
            // inherit the previous one's onboarding state.
            resetPreferences();
          })();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: theme.spacing.giant, gap: theme.spacing.md }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 4, paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h2">{t('settings.title')}</Text>
      </View>

      <SettingSection>
        <SettingRow
          kind="navigate"
          icon="person-outline"
          label={t('settings.account')}
          onPress={() => router.push('/settings/account')}
        />
        <SettingRow
          kind="navigate"
          icon="lock-closed-outline"
          label={t('settings.privacy')}
          onPress={() => router.push('/settings/privacy')}
        />
        <SettingRow
          kind="navigate"
          icon="notifications-outline"
          label={t('settings.notifications')}
          onPress={() => router.push('/settings/notifications')}
        />
      </SettingSection>

      <SettingSection title={t('settings.appearance')}>
        <SettingRow
          kind="navigate"
          icon="language-outline"
          label={t('settings.language')}
          value={LANGUAGE_LABELS[language]}
          onPress={() => router.push('/settings/language')}
        />
        <SettingRow
          kind="navigate"
          icon="contrast-outline"
          label={t('settings.appearance')}
          value={themeLabel}
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingRow
          kind="toggle"
          icon="pulse-outline"
          label={t('settings.haptics')}
          value={hapticsEnabled}
          onValueChange={setHapticsEnabled}
        />
        <SettingRow
          kind="toggle"
          icon="accessibility-outline"
          label={t('settings.reducedMotion')}
          value={reducedMotion}
          onValueChange={setReducedMotion}
        />
      </SettingSection>

      <SettingSection title={t('settings.security')}>
        <SettingRow
          kind="navigate"
          icon="ban-outline"
          label={t('settings.blockedUsers')}
          onPress={() => router.push('/settings/blocked')}
        />
      </SettingSection>

      <SettingSection title={t('settings.help')}>
        <SettingRow
          kind="navigate"
          icon="help-circle-outline"
          label={t('settings.reportProblem')}
          onPress={() => router.push('/settings/support')}
        />
        <SettingRow
          kind="navigate"
          icon="document-text-outline"
          label={t('settings.terms')}
          onPress={() => router.push('/settings/legal?doc=terms')}
        />
        <SettingRow
          kind="navigate"
          icon="shield-outline"
          label={t('settings.privacyPolicy')}
          onPress={() => router.push('/settings/legal?doc=privacy')}
        />
      </SettingSection>

      <SettingSection>
        <SettingRow kind="action" icon="log-out-outline" label={t('settings.logOut')} onPress={confirmSignOut} />
        <SettingRow
          kind="action"
          icon="trash-outline"
          label={t('settings.deleteAccount')}
          destructive
          onPress={() => router.push('/settings/delete-account')}
        />
      </SettingSection>

      <Text variant="caption" color="muted" align="center">
        {t('settings.version', {
          version: Constants.expoConfig?.version ?? '1.0.0',
        })}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
});
