# Uni Streak

A social app for university students. Each campus gets its own community, and
the thing that brings people back is the streak: a shared count between two
people that only grows when *both* of them show up on the same day.

Built for iOS and Android with Expo, React Native and Supabase.

---

## Running it

```bash
npm install
cp .env.example .env.local     # fill in your Supabase URL and anon key
npm start
```

Both env values are public client identifiers. Every authorization decision is
made by row level security in Postgres, so shipping them in the bundle grants
nothing on its own.

### Backend

```bash
supabase db push      # apply migrations to a linked project
npm run db:verify     # apply + test against a throwaway local PostgreSQL
npm run db:types      # regenerate src/types/database.types.ts from the schema
```

`npm run db:verify` needs only `psql` and a PostgreSQL 16 server — no Docker,
no Supabase CLI. See [`supabase/README.md`](supabase/README.md).

### Checks

```bash
npm run typecheck
npm run lint
npm test
npm run db:verify
```

CI additionally bundles for both platforms, because a passing typecheck does
not prove the app builds.

---

## How the streak works

This is the part worth reading carefully, because the rules are specific and
the implementation is deliberately unforgiving about them.

**Day one does not count.** When two people first exchange messages on the same
day, the streak is created with status `pending` and length `0` — the UI shows
`🔥 Pending`, not `🔥 1`. Only when both of them show up again on the *next*
calendar day does it become `🔥 2`, and it grows by one per day after that.

A `check (current_length <> 1)` constraint makes a one-day streak
unrepresentable rather than merely unimplemented.

**Both people, or it does not count.** A day is only complete once each side
has contributed. One person messaging into silence advances nothing.

**Spam cannot inflate it.** A unique index on
`(streak_id, user_id, local_day)` means the hundredth message of the day is
recorded exactly like the first: not at all. There is no counter to game.

**Days are resolved in a real timezone.** A streak is anchored to the
initiator's IANA zone, so both participants agree on which day is being filled
even when they are eight hours apart. The deadline is stored as an absolute
instant, so a countdown is correct for a reader anywhere without any
client-side timezone arithmetic.

**Nothing is deleted.** An expired streak keeps its row; the completed run is
archived to `streak_history` so the app can say "83 day streak ended" and offer
a restore within a bounded window.

All of this lives in Postgres (`supabase/migrations/*_streak_engine.sql`). The
client reads streak state and never computes it — `authenticated` holds no
write grant on `streaks` at all.

---

## Architecture

```
app/                 expo-router routes (file = screen)
src/
  components/ui/     design system primitives
  components/feedback/ loading, empty and error states
  features/          feature modules (feed, chat, streaks, university, …)
  services/          every server call, typed; components never touch supabase directly
  hooks/             cross-cutting hooks (auth, realtime, haptics, countdown)
  lib/               supabase client, i18n, RTL, errors, date formatting
  locales/           en.json / ar.json — the only place user-facing text lives
  theme/             design tokens and the theme provider
  store/             persisted preferences, session, onboarding draft
  types/             GENERATED from the database schema
supabase/
  migrations/        schema, RLS, streak engine, RPCs
  functions/         Deno edge functions (scheduled jobs, push)
  tests/             SQL suites
```

### Decisions worth knowing

**Authorization is row level security, not application code.** All 36 tables
have RLS enabled with explicit policies. A table added without a policy fails
closed. Privileged operations go through `security definer` functions that
re-check permissions, because `security definer` bypasses RLS — a missing check
there is a privilege escalation, not a bug.

**Anonymity is a projection, not storage.** `posts.author_id` is always the
real author. The `feed_posts` view withholds it from ordinary readers and
reveals it to moderators. This is what makes anonymity safe rather than a
loophole: a banned user posting anonymously is still a banned user, and the
ban still applies.

**The client is never trusted for streaks, roles, moderation or identity.**
Test suites attack each of these directly rather than asserting they are
handled.

**Types are generated, not written.** `src/types/database.types.ts` is produced
by introspecting the live schema — including foreign-key relationships and RPC
signatures. CI regenerates it and fails on any diff, so the app cannot drift
from the database. This caught a real parameter-name mismatch during
development.

**Text is never hardcoded.** Every string resolves through i18next from
`en.json` / `ar.json`. Tests enforce that both files define the same keys, use
the same interpolation placeholders, and that Arabic provides all six plural
categories its grammar requires — a missing translation is a failing test, not
a silent fallback to English.

**RTL is structural, not conditional.** Layouts use logical properties
(`marginStart`, `insetInlineEnd`, `flex-start`) which resolve against the
writing direction, so Arabic mirrors without per-component branching. Switching
between an LTR and an RTL language reloads once, because React Native applies
direction natively; switching between two same-direction languages does not.

**Scheduled work runs hourly, not daily.** Users span timezones, so "the end of
the day" is a different instant for every streak.

---

## What is verified

| Suite | Count | What it covers |
|---|---|---|
| Streak engine (SQL) | 39 | progression, spam resistance, expiry, history, timezones, restore |
| Authorization (SQL) | 45 | cross-university isolation, DM privacy, ban evasion, escalation, deletion |
| Streak presentation | 19 | countdown, milestones, bucketing, restore eligibility |
| Error taxonomy | 13 | SQLSTATE → localized message, retryability |
| Locale parity | 5 | key coverage, placeholders, Arabic plural categories |

The SQL suites run against real PostgreSQL and impersonate real end users
(`set role authenticated` plus a JWT subject claim), so they exercise the same
policy path as production rather than a mock of it.

---

## Store readiness

`app.json` carries bundle identifiers, adaptive icons, a splash screen, the
`unistreak://` scheme, an iOS privacy manifest, and localized permission
strings in English and Arabic. Permissions are requested at the moment of first
use, never at launch.

Before submitting you will need to: set a real EAS `projectId`, publish the
Terms and Privacy Policy URLs referenced in Settings, and supply store
screenshots and descriptions.
