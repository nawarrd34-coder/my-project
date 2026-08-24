import { supabase } from '@/lib/supabase';
import type { IdentityMode, Profile } from './types';

/** The signed-in user's profile, or null when onboarding is incomplete. */
export const fetchMyProfile = async (): Promise<Profile | null> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  if (error) throw error;
  return data === true;
};

export interface OnboardingInput {
  username: string;
  universityId: string;
  avatarUrl?: string | null;
  identityMode: IdentityMode;
  timezone: string;
  locale: string;
  displayName?: string | null;
}

export const completeOnboarding = async (input: OnboardingInput): Promise<Profile> => {
  const { data, error } = await supabase.rpc('complete_onboarding', {
    p_username: input.username,
    p_university_id: input.universityId,
    p_avatar_url: input.avatarUrl ?? undefined,
    p_identity_mode: input.identityMode,
    p_timezone: input.timezone,
    p_locale: input.locale,
    p_display_name: input.displayName ?? undefined,
  });
  if (error) throw error;
  return data as unknown as Profile;
};

/** Privacy and preference switches (§25). Never touches `role`. */
export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'display_name'
    | 'bio'
    | 'avatar_url'
    | 'timezone'
    | 'locale'
    | 'default_identity'
    | 'show_username'
    | 'allow_direct_messages'
    | 'allow_group_invites'
    | 'show_online_status'
    | 'read_receipts'
    | 'hide_from_leaderboard'
  >
>;

export const updateMyProfile = async (patch: ProfilePatch): Promise<Profile> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', auth.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const searchProfiles = async (term: string, limit = 20): Promise<Profile[]> => {
  const trimmed = term.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username_normalized', `%${trimmed}%`)
    .is('deleted_at', null)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const blockUser = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc('block_user', { p_user: userId });
  if (error) throw error;
};

export const unblockUser = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc('unblock_user', { p_user: userId });
  if (error) throw error;
};

export const fetchBlockedUsers = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked:profiles!blocks_blocked_id_fkey(*)');
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const blocked = (row as { blocked: Profile | Profile[] | null }).blocked;
    if (!blocked) return [];
    return Array.isArray(blocked) ? blocked : [blocked];
  });
};

/** Permanently delete the account and all private data (§39). */
export const deleteMyAccount = async (): Promise<void> => {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
};
