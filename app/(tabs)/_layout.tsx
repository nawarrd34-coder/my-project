import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryClient';
import { fetchNotifications } from '@/services/notifications';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();

  // Unread count drives the badge on Chats; polled rather than realtime so a
  // background tab does not hold a socket open.
  const { data: notifications } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotifications(50),
    staleTime: 60_000,
  });

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.divider,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // Tab order follows the layout direction automatically, so the bar
        // mirrors correctly in Arabic (§4).
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="streaks"
        options={{
          title: t('tabs.streaks'),
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: t('tabs.chats'),
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.notification },
        }}
      />
      <Tabs.Screen
        name="university"
        options={{
          title: t('tabs.university'),
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
