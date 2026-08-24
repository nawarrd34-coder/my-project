-- ============================================================================
-- Uni Streak :: 0014 scheduled job entry points
-- ============================================================================
-- The engine lives in `app_private`, which PostgREST does not expose. These
-- thin wrappers in `public` are the only way in, and they are granted to
-- `service_role` alone - never to `authenticated`. A signed-in user therefore
-- cannot expire someone's streak or roll a university forward (§32).
-- ============================================================================

create or replace function public.expire_due_streaks_admin()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Defence in depth: even though only service_role holds EXECUTE, refuse to
  -- run for anyone carrying an end-user identity.
  if auth.uid() is not null then
    raise exception 'not callable by an end user' using errcode = '42501';
  end if;
  return app_private.expire_due_streaks(now());
end;
$$;

create or replace function public.roll_university_streak_admin(
  p_university uuid,
  p_day date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    raise exception 'not callable by an end user' using errcode = '42501';
  end if;
  perform app_private.roll_university_streak(p_university, p_day);
end;
$$;

create or replace function public.streaks_expiring_admin(p_within interval)
returns table (
  streak_id uuid,
  user_id uuid,
  partner_id uuid,
  current_length integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    raise exception 'not callable by an end user' using errcode = '42501';
  end if;
  return query select * from app_private.streaks_expiring_within(p_within);
end;
$$;

/* Housekeeping: drop expired typing markers and stale rate-limit windows. */
create or replace function public.cleanup_ephemeral_admin()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer := 0;
  n integer;
begin
  if auth.uid() is not null then
    raise exception 'not callable by an end user' using errcode = '42501';
  end if;

  delete from public.typing_indicators where expires_at < now();
  get diagnostics n = row_count;
  removed := removed + n;

  delete from public.rate_limits where window_start < now() - interval '2 hours';
  get diagnostics n = row_count;
  removed := removed + n;

  -- Lift bans that have served their term, so a user is not left restricted
  -- by a stale row if nothing else touches it.
  update public.bans set lifted_at = now()
   where lifted_at is null and expires_at is not null and expires_at <= now();

  return removed;
end;
$$;

revoke all on function
  public.expire_due_streaks_admin(),
  public.roll_university_streak_admin(uuid, date),
  public.streaks_expiring_admin(interval),
  public.cleanup_ephemeral_admin()
from public, anon, authenticated;

grant execute on function
  public.expire_due_streaks_admin(),
  public.roll_university_streak_admin(uuid, date),
  public.streaks_expiring_admin(interval),
  public.cleanup_ephemeral_admin()
to service_role;

comment on function public.expire_due_streaks_admin() is
  'Scheduled entry point. service_role only; see supabase/functions/streak-cron.';
