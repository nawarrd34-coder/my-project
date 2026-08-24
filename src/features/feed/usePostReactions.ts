import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryClient';
import { fetchReactionSummaries, togglePostReaction, type ReactionSummary } from '@/services/posts';
import type { ReactionEmoji } from '@/services/types';

const EMPTY: ReactionSummary = { counts: {}, mine: null };

/**
 * Reaction state for a page of posts, with an optimistic toggle.
 *
 * The optimistic update mirrors the server's toggle semantics exactly - add,
 * swap, or remove - so the number never jumps when the real response lands.
 */
export const usePostReactions = (postIds: string[]) => {
  const queryClient = useQueryClient();
  const key = queryKeys.myReactions(postIds);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchReactionSummaries(postIds),
    enabled: postIds.length > 0,
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: ({ postId, emoji }: { postId: string; emoji: ReactionEmoji }) =>
      togglePostReaction(postId, emoji),

    onMutate: async ({ postId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, ReactionSummary>>(key);

      queryClient.setQueryData<Record<string, ReactionSummary>>(key, (current) => {
        const next = { ...(current ?? {}) };
        const summary = next[postId] ?? EMPTY;
        const counts = { ...summary.counts };

        if (summary.mine === emoji) {
          // Same emoji tapped again: remove it.
          counts[emoji] = Math.max((counts[emoji] ?? 1) - 1, 0);
          if (counts[emoji] === 0) delete counts[emoji];
          next[postId] = { counts, mine: null };
        } else {
          // Swapping: decrement the old one before incrementing the new.
          if (summary.mine) {
            counts[summary.mine] = Math.max((counts[summary.mine] ?? 1) - 1, 0);
            if (counts[summary.mine] === 0) delete counts[summary.mine];
          }
          counts[emoji] = (counts[emoji] ?? 0) + 1;
          next[postId] = { counts, mine: emoji };
        }
        return next;
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      // Roll back to the last known-good server state.
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return {
    summaries: query.data ?? {},
    summaryFor: (postId: string): ReactionSummary => query.data?.[postId] ?? EMPTY,
    react: (postId: string, emoji: ReactionEmoji) => mutation.mutate({ postId, emoji }),
    isLoading: query.isLoading,
  };
};
