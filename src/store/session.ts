import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/services/types';

export interface SessionState {
  /** null = signed out; undefined = not yet resolved. */
  session: Session | null | undefined;
  profile: Profile | null;
  /** True until the first auth resolution, so we can hold the splash screen. */
  initializing: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>()((set) => ({
  session: undefined,
  profile: null,
  initializing: true,

  setSession: (session) => set({ session, initializing: false }),
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));

/** True once the user has both an account and a completed profile (§3). */
export const selectIsOnboarded = (state: SessionState): boolean =>
  !!state.session && !!state.profile;

export const selectIsStaff = (state: SessionState): boolean =>
  !!state.profile && state.profile.role !== 'student';
