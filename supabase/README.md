# Uni Streak backend

Everything the app is allowed to do is defined here. The client holds no
authority: it presents state the database agreed to return.

## Layout

```
migrations/    ordered, idempotent SQL. The source of truth for the schema.
functions/     Deno edge functions (scheduled jobs and push dispatch).
tests/         SQL test suites, runnable against any PostgreSQL 16.
seed/          optional development fixtures.
```

## Applying migrations

Against a Supabase project:

```bash
supabase link --project-ref <ref>
supabase db push
```

Against a throwaway local PostgreSQL (what CI uses — no Docker required):

```bash
bash scripts/localdb.sh          # apply shims + all migrations
bash scripts/localdb.sh --test   # ... and run the SQL suites
```

`tests/00_local_shims.sql` recreates the small part of the Supabase platform
the migrations depend on (`auth.users`, `auth.uid()`, the anon/authenticated
roles, the realtime publication). It is never applied to a real project.

## Regenerating types

`src/types/database.types.ts` is generated, never edited:

```bash
npm run db:types
```

On a Supabase project you can equivalently run
`supabase gen types typescript --local`. The bundled generator exists so CI can
verify the app's types against the migrations without the Supabase toolchain.

## Scheduled jobs

Two things must run on a schedule. Both are exposed only to `service_role`.

### streak-cron

Hourly — **not** daily. Users span timezones, so "the end of the day" happens
at a different instant for every streak (§34). An hourly sweep bounds how long
a lapsed streak can linger before it is closed.

```sql
select cron.schedule(
  'streak-cron',
  '0 * * * *',
  $$
    select net.http_post(
      url     := 'https://<ref>.supabase.co/functions/v1/streak-cron',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret', true)
      )
    );
  $$
);
```

### cleanup

Hourly housekeeping: expired typing markers, stale rate-limit windows, and
lifting bans whose term has ended.

```sql
select cron.schedule('cleanup', '30 * * * *', $$ select public.cleanup_ephemeral_admin(); $$);
```

### send-push

Not scheduled. Wire it to a database webhook on `INSERT INTO
public.notifications`, so a push is a consequence of the server deciding
something is notable, rather than a separate decision the client can forge.

## Secrets

```bash
supabase secrets set CRON_SECRET=<random>
supabase secrets set EXPO_ACCESS_TOKEN=<expo token>   # optional, raises rate limits
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
The service role key never reaches a device.

## Authorization model

- Every table has RLS enabled and at least one policy. No policy means no
  access, so a table added without one fails closed.
- `authenticated` holds no INSERT/UPDATE/DELETE on `streaks`, `streak_events`,
  `streak_history`, `university_activity`, `badges` or `admin_actions`. Those
  are written only by `security definer` functions.
- Privileged logic lives in `app_private`, which PostgREST does not expose.
  The `*_admin` wrappers in `public` are granted to `service_role` alone and
  additionally refuse to run when `auth.uid()` is present.
- Anonymity is a projection, not storage: `posts.author_id` is always the real
  author, and `public.feed_posts` withholds it from ordinary readers while
  leaving moderators able to act. Bans therefore cover anonymous content.
