import { File } from 'expo-file-system';

import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Storage buckets. Access rules live in the storage migration, not here -
 * a client-side path convention is organisation, not security (§32).
 */
export const BUCKETS = {
  avatars: 'avatars',
  posts: 'post-media',
  messages: 'message-media',
  sounds: 'sounds',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  caf: 'audio/x-caf',
};

const extensionOf = (uri: string): string => {
  const clean = uri.split('?')[0] ?? uri;
  const parts = clean.split('.');
  return (parts.length > 1 ? parts[parts.length - 1] : 'jpg')!.toLowerCase();
};

const limitFor = (contentType: string): number => {
  if (contentType.startsWith('video/')) return MAX_VIDEO_BYTES;
  if (contentType.startsWith('audio/')) return MAX_AUDIO_BYTES;
  return MAX_IMAGE_BYTES;
};

/**
 * Upload a local file to Supabase Storage and return its public URL.
 *
 * `File` from expo-file-system implements `Blob`, so the bytes stream straight
 * into the upload: no base64 round trip through JS memory, which matters for
 * a 50MB video on a mid-range phone (§35).
 *
 * The size check happens before the transfer starts, so an oversized file
 * fails immediately rather than after a long upload on a mobile connection.
 */
export const uploadFile = async (params: {
  bucket: BucketName;
  localUri: string;
  /** Path inside the bucket, without a leading slash. */
  path: string;
}): Promise<{ path: string; publicUrl: string }> => {
  const extension = extensionOf(params.localUri);
  const contentType = EXTENSION_CONTENT_TYPE[extension] ?? 'application/octet-stream';

  const file = new File(params.localUri);
  if (!file.exists) throw new AppError('uploadFailed');
  if (file.size > limitFor(contentType)) throw new AppError('tooLarge');

  const fullPath = `${params.path}.${extension}`;
  const { error } = await supabase.storage
    .from(params.bucket)
    .upload(fullPath, await file.bytes(), { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(params.bucket).getPublicUrl(fullPath);
  return { path: fullPath, publicUrl: data.publicUrl };
};

const requireUserId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AppError('sessionExpired');
  return data.user.id;
};

export const uploadAvatar = async (localUri: string): Promise<string> => {
  const userId = await requireUserId();
  // Overwriting a stable path keeps one avatar per user rather than
  // accumulating orphans on every change.
  const { publicUrl } = await uploadFile({
    bucket: BUCKETS.avatars,
    localUri,
    path: `${userId}/avatar`,
  });
  // Cache-bust, since the URL is stable but the image changed.
  return `${publicUrl}?v=${Date.now()}`;
};

export const uploadPostMedia = async (localUri: string): Promise<string> => {
  const userId = await requireUserId();
  const { path } = await uploadFile({
    bucket: BUCKETS.posts,
    localUri,
    path: `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  return path;
};

export const uploadMessageMedia = async (localUri: string): Promise<string> => {
  const userId = await requireUserId();
  const { path } = await uploadFile({
    bucket: BUCKETS.messages,
    localUri,
    path: `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  return path;
};

export const uploadSound = async (localUri: string): Promise<string> => {
  const userId = await requireUserId();
  const { path } = await uploadFile({
    bucket: BUCKETS.sounds,
    localUri,
    path: `${userId}/${Date.now()}`,
  });
  return path;
};

/** Resolve a stored path to a URL the app can render. */
export const publicUrlFor = (bucket: BucketName, path: string): string =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
