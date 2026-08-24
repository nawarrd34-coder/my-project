import { create } from 'zustand';

import type { IdentityMode } from '@/store/preferences';

/**
 * Draft state for the signup wizard. Deliberately in memory only: a partially
 * chosen username should not survive a reinstall, and nothing here is
 * authoritative until `complete_onboarding` accepts it server-side.
 */
export interface OnboardingDraft {
  universityId: string | null;
  universityName: string | null;
  username: string;
  avatarUrl: string | null;
  identityMode: IdentityMode;

  setUniversity: (id: string, name: string) => void;
  setUsername: (username: string) => void;
  setAvatarUrl: (url: string | null) => void;
  setIdentityMode: (mode: IdentityMode) => void;
  reset: () => void;
}

export const useOnboardingDraft = create<OnboardingDraft>()((set) => ({
  universityId: null,
  universityName: null,
  username: '',
  avatarUrl: null,
  identityMode: 'public',

  setUniversity: (universityId, universityName) => set({ universityId, universityName }),
  setUsername: (username) => set({ username }),
  setAvatarUrl: (avatarUrl) => set({ avatarUrl }),
  setIdentityMode: (identityMode) => set({ identityMode }),
  reset: () =>
    set({
      universityId: null,
      universityName: null,
      username: '',
      avatarUrl: null,
      identityMode: 'public',
    }),
}));
