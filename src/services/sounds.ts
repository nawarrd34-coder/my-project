import { supabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';
import { uploadSound } from './storage';
import type { SoundRow } from './types';

/** Hard cap, mirrored by a check constraint on `sounds.duration_ms` (§23). */
export const MAX_SOUND_MS = 30_000;
export const MIN_SOUND_MS = 500;

export const fetchTrendingSounds = async (universityId: string): Promise<SoundRow[]> => {
  const { data, error } = await supabase
    .from('sounds')
    .select('*')
    .or(`university_id.eq.${universityId},university_id.is.null`)
    .eq('is_approved', true)
    .eq('is_removed', false)
    .order('use_count', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
};

/** Sounds this user uploaded, including any still awaiting approval. */
export const fetchMySounds = async (): Promise<SoundRow[]> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('sounds')
    .select('*')
    .eq('uploader_id', auth.user.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/**
 * Upload a clip and register it.
 *
 * New sounds are NOT auto-approved: `is_approved` defaults to false, so an
 * upload is visible to its author and to moderators until it is reviewed
 * (§23 moderation, §29).
 */
export const createSound = async (params: {
  localUri: string;
  title: string;
  durationMs: number;
  universityId: string;
}): Promise<SoundRow> => {
  if (params.durationMs < MIN_SOUND_MS || params.durationMs > MAX_SOUND_MS) {
    throw new AppError('tooLarge');
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new AppError('sessionExpired');

  const storagePath = await uploadSound(params.localUri);

  const { data, error } = await supabase
    .from('sounds')
    .insert({
      uploader_id: auth.user.id,
      university_id: params.universityId,
      title: params.title.trim(),
      storage_path: storagePath,
      duration_ms: Math.round(params.durationMs),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Sounds live in a private bucket, so playback needs a short-lived signed URL
 * rather than a guessable public one.
 */
export const signedSoundUrl = async (storagePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('sounds')
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
};
