import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill them in.',
  );
}

/**
 * The single Supabase client for the app.
 *
 * The anon key is a public identifier, not a secret: every authorization
 * decision is made by row level security in Postgres (§32), so shipping it in
 * the bundle grants nothing. Service-role keys never appear on the device -
 * they live only in edge functions.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Sessions persist across launches; refresh tokens rotate server-side.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar to parse a session out of.
      detectSessionInUrl: false,
    },
    realtime: {
      // Backpressure guard: a very busy channel must not starve the JS thread.
      params: { eventsPerSecond: 10 },
    },
    global: {
      headers: { 'x-client-platform': Platform.OS },
    },
  },
);

/**
 * Supabase refreshes tokens on a timer, which the OS suspends in the
 * background. Tying the refresh loop to foreground state avoids waking to an
 * expired session.
 */
export const startAuthAutoRefresh = () => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
  void supabase.auth.startAutoRefresh();
  return () => subscription.remove();
};
