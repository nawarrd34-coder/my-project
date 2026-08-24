import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryClient';
import { registerPushToken } from '@/services/notifications';
import { useSession } from '@/store/session';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register this device for push and route taps to the right screen.
 *
 * Permission is NOT requested here on first launch: the prompt is triggered
 * from `requestPushPermission` at a moment the ask makes sense - after the
 * user's first streak, say - rather than before they know what the app is
 * (§43). This hook only registers a token once permission already exists.
 */
export const usePushNotifications = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession((s) => s.session);
  const profile = useSession((s) => s.profile);
  const registered = useRef(false);

  useEffect(() => {
    if (!session || !profile || registered.current) return;

    const register = async () => {
      // Simulators cannot receive push tokens.
      if (!Device.isDevice) return;

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Uni Streak',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF5A1F',
        });
        // Streak reminders are time-critical, so they get their own channel
        // the user can keep on even if they mute everything else.
        await Notifications.setNotificationChannelAsync('streaks', {
          name: 'Streaks',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#FF5A1F',
        });
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;

      try {
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken({
          token: token.data,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
          deviceId: Device.modelName,
        });
        registered.current = true;
      } catch {
        // A failed registration must never block the app; the user simply
        // does not get push until the next launch.
      }
    };

    void register();
  }, [session, profile]);

  // Tapping a notification deep-links to whatever the server put in `link`.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      if (typeof link === 'string' && link.startsWith('/')) {
        router.push(link as never);
      }
    });
    return () => subscription.remove();
  }, [router, queryClient]);

  // A notification arriving in the foreground should refresh the badge.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    });
    return () => subscription.remove();
  }, [queryClient]);
};

/**
 * Ask for notification permission at a moment the user will understand it.
 * Returns true if permission is now granted.
 */
export const requestPushPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  // Once the OS has recorded a denial, asking again does nothing; the caller
  // should link to system settings instead.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
};
