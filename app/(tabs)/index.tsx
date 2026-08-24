import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListSkeleton } from '@/components/feedback/Skeleton';
import { IconButton } from '@/components/ui/IconButton';
import { CampusPulseHeader } from '@/features/feed/CampusPulseHeader';
import { ChannelStrip } from '@/features/feed/ChannelStrip';
import { PostCard } from '@/features/feed/PostCard';
import { PostActionsSheet } from '@/features/feed/PostActionsSheet';
import { usePostReactions } from '@/features/feed/usePostReactions';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { errorTranslationKey } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { fetchFeed, FEED_PAGE_SIZE } from '@/services/posts';
import { fetchCampusPulse } from '@/services/universities';
import type { FeedPost, ReactionEmoji } from '@/services/types';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const profile = useSession((s) => s.profile);
  const universityId = profile?.university_id ?? null;

  const [channelId, setChannelId] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);

  const pulseQuery = useQuery({
    queryKey: queryKeys.pulse(universityId ?? ''),
    queryFn: () => fetchCampusPulse(universityId ?? undefined),
    enabled: !!universityId,
    staleTime: 60_000,
  });

  const feedQuery = useInfiniteQuery({
    queryKey: queryKeys.feed(universityId ?? '', channelId),
    enabled: !!universityId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchFeed({ universityId: universityId!, channelId, cursor: pageParam, limit: FEED_PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const posts = useMemo(
    () => (feedQuery.data?.pages ?? []).flatMap((page) => page.items),
    [feedQuery.data],
  );

  const postIds = useMemo(
    () => posts.map((p) => p.id).filter((id): id is string => !!id),
    [posts],
  );

  const { summaryFor, react } = usePostReactions(postIds);

  // New posts from anyone in this university appear without a manual refresh
  // (§10). RLS applies to realtime too, so nothing arrives that the reader
  // could not already query.
  useRealtimeChannel(
    {
      channel: `feed:${universityId ?? 'none'}`,
      table: 'posts',
      event: 'INSERT',
      filter: universityId ? `university_id=eq.${universityId}` : undefined,
      enabled: !!universityId,
    },
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed(universityId ?? '', channelId) });
    }, [queryClient, universityId, channelId]),
  );

  const refresh = useCallback(() => {
    void feedQuery.refetch();
    void pulseQuery.refetch();
  }, [feedQuery, pulseQuery]);

  const universityName =
    i18n.language === 'ar' ? (profile?.username ?? '') : (pulseQuery.data?.university_code ?? '');

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
        <PostCard
          post={item}
          reactions={summaryFor(item.id ?? '')}
          onReact={(emoji: ReactionEmoji) => item.id && react(item.id, emoji)}
          onOpenComments={() => item.id && router.push(`/post/${item.id}`)}
          onOpenMenu={() => setMenuPost(item)}
        />
      </View>
    ),
    [theme.spacing.lg, theme.spacing.md, summaryFor, react, router],
  );

  if (!universityId) return null;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.topBar, { paddingHorizontal: theme.spacing.lg }]}>
        <View style={{ flex: 1 }} />
        <IconButton
          icon="search"
          accessibilityLabel={t('search.title')}
          onPress={() => router.push('/search')}
        />
        <IconButton
          icon="notifications-outline"
          accessibilityLabel={t('notifications.title')}
          onPress={() => router.push('/notifications')}
        />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id ?? String(Math.random())}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <CampusPulseHeader
              pulse={pulseQuery.data}
              universityName={pulseQuery.data?.university_code ?? universityName}
              loading={pulseQuery.isLoading}
            />
            <ChannelStrip
              universityId={universityId}
              selectedChannelId={channelId}
              onSelect={setChannelId}
            />
          </>
        }
        ListEmptyComponent={
          feedQuery.isLoading ? (
            <ListSkeleton />
          ) : feedQuery.error ? (
            <ErrorState
              message={t(errorTranslationKey(feedQuery.error))}
              onRetry={() => void feedQuery.refetch()}
            />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={t('empty.feedTitle')}
              body={t('empty.feedBody', { university: pulseQuery.data?.university_code ?? '' })}
              actionLabel={t('post.create')}
              onAction={() => router.push('/compose')}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
            onRefresh={refresh}
            tintColor={theme.colors.accent}
          />
        }
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        ListFooterComponent={
          feedQuery.isFetchingNextPage ? (
            <View style={{ padding: theme.spacing.lg }}>
              <ListSkeleton count={1} />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: theme.spacing.giant }}
        // Windowing keeps a long feed cheap to scroll (§35).
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={9}
        initialNumToRender={6}
      />

      <View style={[styles.fab, { bottom: theme.spacing.xl }]}>
        <IconButton
          icon="add"
          size={26}
          background="accent"
          accessibilityLabel={t('post.create')}
          onPress={() => router.push('/compose')}
          style={{ width: 56, height: 56, ...theme.shadow('md') }}
        />
      </View>

      <PostActionsSheet post={menuPost} onClose={() => setMenuPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', insetInlineEnd: 20 },
});
