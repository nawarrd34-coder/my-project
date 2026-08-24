-- ============================================================================
-- Uni Streak :: 0015 group admin escalation guard
-- ============================================================================
-- The membership policies correctly control *who may be a member*, but they
-- said nothing about the `is_admin` column. That left two escalation paths:
--
--   1. joining a public group with `is_admin = true` in the INSERT
--   2. a plain member UPDATE-ing their own row to set `is_admin = true`
--
-- Both made any member a group admin, which carries the power to rename the
-- group, add and remove members, and promote others.
--
-- An RLS policy cannot express this: a WITH CHECK sees only the new row, so it
-- cannot tell "was already an admin" from "just made themselves one". A
-- BEFORE trigger can see both, so the rule lives here.
-- ============================================================================

create or replace function app_private.guard_conversation_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  granting boolean;
  creator uuid;
begin
  -- Server-side callers (service role, security-definer RPCs) have no end-user
  -- identity and are trusted to set membership directly.
  if auth.uid() is null then
    return new;
  end if;

  granting := new.is_admin and (tg_op = 'INSERT' or not old.is_admin);
  if not granting then
    return new;
  end if;

  select created_by into creator
    from public.conversations
   where id = new.conversation_id;

  -- The creator seeds themselves as the first admin at creation time; after
  -- that, only an existing admin may grant the flag.
  if creator = auth.uid() and new.user_id = auth.uid() then
    return new;
  end if;

  if public.is_conversation_admin(new.conversation_id) then
    return new;
  end if;

  raise exception 'only a group admin can grant admin' using errcode = '42501';
end;
$$;

create trigger conversation_members_guard_admin
  before insert or update on public.conversation_members
  for each row execute function app_private.guard_conversation_admin();

comment on function app_private.guard_conversation_admin() is
  'Blocks self-promotion to group admin on both INSERT and UPDATE (§13/§32).';
