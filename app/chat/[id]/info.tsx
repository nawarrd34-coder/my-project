import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { backChevron } from '@/lib/rtl';
import { supabase } from '@/lib/supabase';
import {
  fetchGroupMembers,
  leaveGroup,
  setConversationMuted,
} from '@/services/messaging';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function ChatInfoScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useSession((s) => s.profile?.id);
  const [reporting, setReporting] = useState(false);
  const [muted, setMuted] = useState(false);

  const conversationQuery = useQuery({
    queryKey: queryKeys.conversation(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('conversations').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ['group-members', id],
    queryFn: () => fetchGroupMembers(id!),
    enabled: !!id && conversationQuery.data?.kind === 'group',
  });

  const isGroup = conversationQuery.data?.kind === 'group';

  const toggleMute = async () => {
    if (!id) return;
    try {
      await setConversationMuted(id, !muted);
      setMuted(!muted);
      toast.show(!muted ? t('chats.muteConversation') : t('common.unmute'), 'success');
    } catch (error) {
      toast.show(t(errorTranslationKey(error)), 'error');
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      t('chats.leaveConfirmTitle'),
      t('chats.leaveConfirmBody', { name: conversationQuery.data?.title ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.leave'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await leaveGroup(id!);
                await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
                router.dismissTo('/(tabs)/chats');
              } catch (error) {
                toast.show(t(errorTranslationKey(error)), 'error');
              }
            })();
          },
        },
      ],
    );
  };

  const members = (membersQuery.data ?? []) as unknown as {
    user_id: string;
    is_admin: boolean;
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  }[];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h3">{isGroup ? t('chats.groups') : t('chats.direct')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Avatar
            uri={conversationQuery.data?.avatar_url}
            name={conversationQuery.data?.title}
            size={88}
          />
          <Text variant="h2">{conversationQuery.data?.title ?? ''}</Text>
          {isGroup ? (
            <Text variant="caption" color="secondary">
              {t('chats.members', { count: conversationQuery.data?.member_count ?? 0 })}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={muted ? t('common.unmute') : t('chats.muteConversation')}
            variant="secondary"
            icon={muted ? 'notifications' : 'notifications-off-outline'}
            fullWidth
            onPress={() => void toggleMute()}
          />
          <Button
            label={t('common.report')}
            variant="secondary"
            icon="flag-outline"
            fullWidth
            onPress={() => setReporting(true)}
          />
          {isGroup ? (
            <Button
              label={t('common.leave')}
              variant="danger"
              icon="exit-outline"
              fullWidth
              onPress={confirmLeave}
            />
          ) : null}
        </View>

        {isGroup && members.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="captionStrong" color="secondary">
              {t('chats.members', { count: members.length })}
            </Text>
            {members.map((member) => (
              <Card key={member.user_id} elevation="none">
                <View style={styles.memberRow}>
                  <Avatar
                    uri={member.profiles?.avatar_url}
                    name={member.profiles?.username}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">
                      {member.profiles?.display_name ?? `@${member.profiles?.username ?? ''}`}
                      {member.user_id === myId ? ` (${t('common.you')})` : ''}
                    </Text>
                    {member.is_admin ? (
                      <Text variant="caption" color="accent">
                        {t('chats.admin')}
                      </Text>
                    ) : null}
                  </View>
                  {member.user_id !== myId ? (
                    <IconButton
                      icon="person-outline"
                      accessibilityLabel={t('profile.title')}
                      onPress={() => router.push(`/profile/${member.user_id}`)}
                    />
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <ReportSheet
        visible={reporting}
        target={isGroup ? 'group' : 'user'}
        targetId={id ?? null}
        onClose={() => setReporting(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
