import { QueryClient } from '@tanstack/react-query';

import { isRetryable } from './errors';

/**
 * Shared cache configuration.
 *
 * Retries are gated on `isRetryable`, so a request that row level security
 * refused is not re-sent three times before failing (§35/§36).
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => isRetryable(error) && failureCount < 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (failureCount, error) => isRetryable(error) && failureCount < 1,
      },
    },
  });

/**
 * Query key factory. Centralising keys keeps invalidation honest: a screen
 * cannot invalidate "posts" with a slightly different key shape and silently
 * fail to refresh.
 */
export const queryKeys = {
  session: ['session'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  myProfile: ['profile', 'me'] as const,
  universities: ['universities'] as const,
  university: (id: string) => ['university', id] as const,
  channels: (universityId: string) => ['channels', universityId] as const,
  pulse: (universityId: string) => ['pulse', universityId] as const,
  feed: (universityId: string, channelId: string | null) =>
    ['feed', universityId, channelId ?? 'all'] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  myReactions: (postIds: string[]) => ['reactions', 'mine', ...postIds] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  streaks: ['streaks'] as const,
  streak: (id: string) => ['streak', id] as const,
  badges: (userId: string) => ['badges', userId] as const,
  notifications: ['notifications'] as const,
  notificationSettings: ['notificationSettings'] as const,
  blockedUsers: ['blockedUsers'] as const,
  leaderboardUniversities: ['leaderboard', 'universities'] as const,
  leaderboardStudents: ['leaderboard', 'students'] as const,
  search: (term: string) => ['search', term] as const,
  reports: (status: string) => ['reports', status] as const,
  adminStats: (universityId: string) => ['admin', 'stats', universityId] as const,
} as const;
