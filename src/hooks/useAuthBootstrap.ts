import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { startAuthAutoRefresh, supabase } from '@/lib/supabase';
import { fetchMyProfile } from '@/services/profiles';
import { useSession } from '@/store/session';

/**
 * Wire Supabase auth into the app's session store, exactly once.
 *
 * Runs at the root so every screen can assume `useSession()` is authoritative,
 * and clears the query cache on sign-out so one user's data can never be
 * served to the next.
 */
export const useAuthBootstrap = () => {
  const setSession = useSession((s) => s.setSession);
  const setProfile = useSession((s) => s.setProfile);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const profile = await fetchMyProfile();
        if (active) setProfile(profile);
      } catch {
        // A missing profile is the normal pre-onboarding state, not an error.
        if (active) setProfile(null);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) void loadProfile();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setSession(session);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
        return;
      }
      if (session) void loadProfile();
    });

    const stopRefresh = startAuthAutoRefresh();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      stopRefresh();
    };
  }, [setSession, setProfile, queryClient]);
};
