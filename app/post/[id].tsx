import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { PostCard } from '@/features/feed/PostCard';
import { PollCard } from '@/features/feed/PollCard';
import { usePostReactions } from '@/features/feed/usePostReactions';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { backChevron } from '@/lib/rtl';
import { formatRelative } from '@/lib/datetime';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { createComment, fetchComments, fetchPost } from '@/services/posts';
import type { ThreadComment } from '@/services/types';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function PostDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useSession((s) => s.profile);
  const [draft, setDraft] = useState('');

  const postQuery = useQuery({
    queryKey: queryKeys.post(id ?? ''),
    queryFn: () => fetchPost(id!),
    enabled: !!id,
  });

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments(id ?? ''),
    queryFn: () => fetchComments(id!),
    enabled: !!id,
  });

  const { summaryFor, react } = usePostReactions(id ? [id] : []);

  // New comments arrive live while the thread is open (§10).
  useRealtimeChannel(
    {
      channel: `comments:${id ?? 'none'}`,
      table: 'comments',
      event: 'INSERT',
      filter: id ? `post_id=eq.${id}` : undefined,
      enabled: !!id,
    },
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(id ?? '') });
    }, [queryClient, id]),
  );

  const commentMutation = useMutation({
    mutationFn: () =>
      createComment({
        postId: id!,
        body: draft.trim(),
        identityMode: profile?.default_identity ?? 'public',
      }),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(id ?? '') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.post(id ?? '') });
    },
    onError: (error) => toast.show(t(errorTranslationKey(error)), 'error'),
  });

  const renderComment = useCallback(
    ({ item }: { item: ThreadComment }) => {
      const hasIdentity = !!item.author_username;
      return (
        <View style={[styles.comment, { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }]}>
          <Avatar
            uri={item.author_avatar_url}
            name={item.author_username}
            anonymous={!hasIdentity}
            anonTag={item.author_anon_tag}
            size={32}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.commentHeader}>
              <Text variant="captionStrong">
                {hasIdentity
                  ? `@${item.author_username}`
                  : `${t('common.anonymous')} #${item.author_anon_tag ?? '????'}`}
              </Text>
              <Text variant="micro" color="muted">
                {item.created_at ? formatRelative(item.created_at, i18n.language, t) : ''}
              </Text>
            </View>
            <Text variant="callout">
              {item.is_removed ? t('moderation.contentRemoved') : item.body}
            </Text>
          </View>
        </View>
      );
    },
    [theme.spacing.lg, theme.spacing.md, t, i18n.language],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom}
    >
      <View style={[styles.header, { paddingTop: insets.top + 4, paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon={backChevron()} accessibilityLabel={t('a11y.back')} onPress={() => router.back()} />
        <Text variant="h3">{t('post.comments', { count: postQuery.data?.comment_count ?? 0 })}</Text>
      </View>

      {postQuery.isLoading ? (
        <ListSkeleton count={1} />
      ) : postQuery.error ? (
        <ErrorState
          message={t(errorTranslationKey(postQuery.error))}
          onRetry={() => void postQuery.refetch()}
        />
      ) : !postQuery.data ? (
        <EmptyState icon="help-circle-outline" title={t('errors.notFound')} />
      ) : (
        <FlatList
          data={commentsQuery.data ?? []}
          keyExtractor={(item) => item.id ?? String(Math.random())}
          renderItem={renderComment}
          ListHeaderComponent={
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
              <PostCard
                post={postQuery.data}
                reactions={summaryFor(id ?? '')}
                onReact={(emoji) => id && react(id, emoji)}
                onOpenComments={() => undefined}
                onOpenMenu={() => undefined}
              />
              {postQuery.data.kind === 'poll' && id ? <PollCard postId={id} /> : null}
            </View>
          }
          ListEmptyComponent={
            commentsQuery.isLoading ? (
              <ListSkeleton count={2} />
            ) : (
              <EmptyState
                icon="chatbubble-outline"
                title={t('empty.commentsTitle')}
                body={t('empty.commentsBody')}
              />
            )
          }
          contentContainerStyle={{ paddingBottom: theme.spacing.xxxl, gap: theme.spacing.lg }}
        />
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.divider,
          backgroundColor: theme.colors.backgroundElevated,
        }}
      >
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder={t('post.addComment')}
          multiline
          maxLength={1000}
          containerStyle={{ flex: 1 }}
        />
        <IconButton
          icon="send"
          background="accent"
          accessibilityLabel={t('a11y.sendMessage')}
          disabled={!draft.trim() || commentMutation.isPending}
          onPress={() => commentMutation.mutate()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 },
  comment: { flexDirection: 'row' },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
