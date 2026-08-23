-- ============================================================================
-- Local-only Supabase shims.
--
-- Supabase's hosted platform provides the `auth` schema, the `extensions`
-- schema, the anon/authenticated roles, and the realtime publication. This
-- file recreates just enough of that surface to run the migrations and the
-- test suite against a plain PostgreSQL instance in CI.
--
-- It is NOT part of the migration set and is never applied to a real project.
-- ============================================================================

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists realtime;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- Minimal stand-in for auth.users.
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Supabase exposes the current request's claims through these functions.
-- Locally we drive them from a GUC the tests set.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- Realtime publication that Supabase creates for you.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime with (publish = 'insert, update, delete');
  end if;
end $$;
