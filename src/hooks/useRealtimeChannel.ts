import { useEffect, useRef } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export interface RealtimeSubscription {
  /** Unique channel name. Reused across renders; changing it resubscribes. */
  channel: string;
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** PostgREST filter, e.g. `conversation_id=eq.<uuid>`. */
  filter?: string;
  enabled?: boolean;
}

/**
 * Subscribe to Postgres changes for as long as the component is mounted.
 *
 * The handler is held in a ref so a caller can pass an inline closure without
 * tearing down and re-establishing the socket on every render.
 *
 * Realtime respects RLS, so a subscription can only ever deliver rows the
 * user is allowed to read (§12).
 */
export const useRealtimeChannel = <T extends Record<string, unknown>>(
  { channel, table, event = '*', filter, enabled = true }: RealtimeSubscription,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
) => {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let subscription: RealtimeChannel | null = supabase
      .channel(channel)
      .on(
        'postgres_changes',
        // The cast is needed because supabase-js types the filter object as a
        // union that does not narrow on a runtime-built `filter` string.
        { event, schema: 'public', table, ...(filter ? { filter } : {}) } as never,
        (payload: RealtimePostgresChangesPayload<T>) => handlerRef.current(payload),
      )
      .subscribe();

    return () => {
      if (subscription) {
        void supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, [channel, table, event, filter, enabled]);
};
