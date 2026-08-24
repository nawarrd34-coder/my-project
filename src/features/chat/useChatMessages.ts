import { useCallback, useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { queryKeys } from '@/lib/queryClient';
import {
  fetchMessages,
  MESSAGE_PAGE_SIZE,
  sendMessage,
  type SendMessageInput,
} from '@/services/messaging';
import type { Message, MessageKind } from '@/services/types';

/** A message that exists only on this device until the server confirms it. */
export interface OptimisticMessage extends Message {
  __pending?: boolean;
  __failed?: boolean;
}

/**
 * Chat transcript with realtime delivery and optimistic sends.
 *
 * Each send carries a client-generated nonce. The server's unique index on
 * (sender_id, client_nonce) makes a retry return the original message instead
 * of creating a duplicate - which also stops a retry from counting twice
 * toward the streak (§15).
 */
export const useChatMessages = (conversationId: string | null, myUserId: string | null) => {
  const queryClient = useQueryClient();
  const key = queryKeys.messages(conversationId ?? '');
  const [outbox, setOutbox] = useState<OptimisticMessage[]>([]);

  const query = useInfiniteQuery({
    queryKey: key,
    enabled: !!conversationId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchMessages({ conversationId: conversationId!, cursor: pageParam, limit: MESSAGE_PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const serverMessages = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  );

  // Server rows win: once a nonce comes back from the database its optimistic
  // twin is dropped, so nothing is rendered twice.
  const messages = useMemo(() => {
    const confirmedNonces = new Set(
      serverMessages.map((m) => m.client_nonce).filter((n): n is string => !!n),
    );
    const stillPending = outbox.filter(
      (m) => !m.client_nonce || !confirmedNonces.has(m.client_nonce),
    );
    return [...stillPending, ...serverMessages];
  }, [serverMessages, outbox]);

  useRealtimeChannel<Message>(
    {
      channel: `messages:${conversationId ?? 'none'}`,
      table: 'messages',
      event: '*',
      filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
      enabled: !!conversationId,
    },
    useCallback(
      (payload: RealtimePostgresChangesPayload<Message>) => {
        const incoming = payload.new as Message | undefined;
        // Clear our optimistic copy as soon as the real row arrives.
        if (incoming?.client_nonce) {
          setOutbox((current) => current.filter((m) => m.client_nonce !== incoming.client_nonce));
        }
        void queryClient.invalidateQueries({ queryKey: key });
      },
      [queryClient, key],
    ),
  );

  const send = useCallback(
    async (input: Omit<SendMessageInput, 'conversationId' | 'clientNonce'>) => {
      if (!conversationId || !myUserId) return;

      const nonce = Crypto.randomUUID();
      const optimistic: OptimisticMessage = {
        id: nonce,
        conversation_id: conversationId,
        sender_id: myUserId,
        kind: (input.kind ?? 'text') as MessageKind,
        body: input.body ?? null,
        storage_path: input.storagePath ?? null,
        duration_ms: input.durationMs ?? null,
        sound_id: input.soundId ?? null,
        reply_to_id: input.replyToId ?? null,
        client_nonce: nonce,
        counted_for_streak: false,
        edited_at: null,
        removed_at: null,
        removed_by: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        __pending: true,
      };

      setOutbox((current) => [optimistic, ...current]);

      try {
        await sendMessage({ ...input, conversationId, clientNonce: nonce });
        setOutbox((current) => current.filter((m) => m.client_nonce !== nonce));
        await queryClient.invalidateQueries({ queryKey: key });
        // The streak may have advanced as a side effect of this message.
        await queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
      } catch {
        // Keep the message visible and marked failed so it can be retried,
        // rather than silently losing what the user typed (§36).
        setOutbox((current) =>
          current.map((m) =>
            m.client_nonce === nonce ? { ...m, __pending: false, __failed: true } : m,
          ),
        );
      }
    },
    [conversationId, myUserId, queryClient, key],
  );

  const retry = useCallback(
    async (nonce: string) => {
      const failed = outbox.find((m) => m.client_nonce === nonce);
      if (!failed || !conversationId) return;

      setOutbox((current) =>
        current.map((m) => (m.client_nonce === nonce ? { ...m, __pending: true, __failed: false } : m)),
      );

      try {
        // Re-sending with the same nonce is safe: the server returns the
        // original message if it did land the first time.
        await sendMessage({
          conversationId,
          body: failed.body ?? undefined,
          kind: failed.kind,
          storagePath: failed.storage_path,
          durationMs: failed.duration_ms,
          clientNonce: nonce,
        });
        setOutbox((current) => current.filter((m) => m.client_nonce !== nonce));
        await queryClient.invalidateQueries({ queryKey: key });
      } catch {
        setOutbox((current) =>
          current.map((m) =>
            m.client_nonce === nonce ? { ...m, __pending: false, __failed: true } : m,
          ),
        );
      }
    },
    [outbox, conversationId, queryClient, key],
  );

  return {
    messages,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    send,
    retry,
  };
};
