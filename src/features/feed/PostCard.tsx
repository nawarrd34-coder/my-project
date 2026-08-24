import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ReactionBar } from '@/components/ui/ReactionBar';
import { Text } from '@/components/ui/Text';
import { formatRelative } from '@/lib/datetime';
import { publicUrlFor, BUCKETS } from '@/services/storage';
import type { FeedPost, ReactionEmoji } from '@/services/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface PostCardProps {
  post: FeedPost;
  reactions: { counts: Record<string, number>; mine: string | null };
  onReact: (emoji: ReactionEmoji) => void;
  onOpenComments: () => void;
  onOpenMenu: () => void;
  mediaPaths?: string[];
}

/**
 * One post in the feed.
 *
 * Anonymity is already resolved by the `feed_posts` view: an anonymous post
 * arrives with a null author and a stable `author_anon_tag`, so this component
 * cannot leak an identity even by accident (§24).
 */
export const PostCard = memo(function PostCard({
  post,
  reactions,
  onReact,
  onOpenComments,
  onOpenMenu,
  mediaPaths = [],
}: PostCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const isAnonymous = post.identity_mode === 'anonymous';
  const hasIdentity = !!post.author_username;

  const displayName = hasIdentity
    ? (post.author_display_name ?? `@${post.author_username}`)
    : `${t('common.anonymous')} #${post.author_anon_tag ?? '????'}`;

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <View style={styles.header}>
          <Avatar
            uri={post.author_avatar_url}
            name={post.author_username}
            anonymous={isAnonymous && !hasIdentity}
            anonTag={post.author_anon_tag}
            size={40}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {displayName}
            </Text>
            <Text variant="caption" color="muted">
              {post.created_at ? formatRelative(post.created_at, i18n.language, t) : ''}
              {post.edited_at ? ` · ${t('post.edited')}` : ''}
            </Text>
          </View>
          <IconButton
            icon="ellipsis-horizontal"
            accessibilityLabel={t('common.more')}
            onPress={onOpenMenu}
          />
        </View>

        {post.is_removed ? (
          <View
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.warningSubtle,
            }}
          >
            <Text variant="caption" color="secondary">
              {t('moderation.contentRemoved')}
            </Text>
          </View>
        ) : post.body ? (
          <Text variant="body">{post.body}</Text>
        ) : null}
      </View>

      {mediaPaths.length > 0 && !post.is_removed ? (
        <Image
          source={{ uri: publicUrlFor(BUCKETS.posts, mediaPaths[0]!) }}
          style={styles.media}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <ReactionBar
          counts={reactions.counts}
          mine={reactions.mine}
          onReact={onReact}
          readOnly={!!post.is_removed}
        />

        <View style={styles.footer}>
          <IconButton
            icon="chatbubble-outline"
            size={18}
            accessibilityLabel={t('post.comments', { count: post.comment_count ?? 0 })}
            onPress={onOpenComments}
          />
          <Text variant="caption" color="secondary">
            {t('post.comments', { count: post.comment_count ?? 0 })}
          </Text>
          <View style={{ flex: 1 }} />
          <IconButton
            icon="open-outline"
            size={18}
            accessibilityLabel={t('common.seeAll')}
            onPress={() => router.push(`/post/${post.id}`)}
          />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  media: { width: '100%', aspectRatio: 4 / 3 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
