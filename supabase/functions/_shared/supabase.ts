// Deno edge function shared helpers.
//
// These run on Supabase Edge Runtime, not in the app bundle, and use the
// service role key from the function's secrets. That key never reaches a
// device (§32/§44).
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const serviceClient = (): SupabaseClient => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Scheduled functions are reachable over HTTP, so they must authenticate.
 * `CRON_SECRET` is a shared secret set with `supabase secrets set`.
 */
export const assertCronAuthorized = (request: Request): void => {
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) throw new Error('CRON_SECRET is not configured');

  const provided = request.headers.get('x-cron-secret');
  if (provided !== expected) {
    throw Object.assign(new Error('unauthorized'), { status: 401 });
  }
};

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
