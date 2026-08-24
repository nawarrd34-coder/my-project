import { supabase } from '@/lib/supabase';
import type { NotificationRow, NotificationSettings } from './types';

export const fetchNotifications = async (limit = 50): Promise<NotificationRow[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .is('read_at', null);
  if (error) throw error;
};

export const fetchNotificationSettings = async (): Promise<NotificationSettings | null> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateNotificationSettings = async (
  patch: Partial<Omit<NotificationSettings, 'user_id' | 'updated_at'>>,
): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: auth.user.id, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
};

/** Register this device for push. Idempotent on the token. */
export const registerPushToken = async (params: {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string | null;
}): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: auth.user.id,
      token: params.token,
      platform: params.platform,
      device_id: params.deviceId ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) throw error;
};

export const unregisterPushToken = async (token: string): Promise<void> => {
  await supabase.from('push_tokens').delete().eq('token', token);
};
