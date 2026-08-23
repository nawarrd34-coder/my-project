#!/usr/bin/env bash
# Bring up a throwaway PostgreSQL instance, apply the shims + all migrations,
# and (optionally) run the SQL test suite. Used by CI and by `npm run db:verify`.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGSOCK=${PGSOCK:-/tmp/pgsock}
PGPORT=${PGPORT:-55432}
DB=${DB:-unistreak_test}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_root() { psql -h "$PGSOCK" -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }

echo "==> recreating database $DB"
psql_root -d postgres -q -c "drop database if exists $DB;" -c "create database $DB;"

echo "==> applying local shims"
psql_root -d "$DB" -q -f "$ROOT/supabase/tests/00_local_shims.sql"

echo "==> applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '    %s\n' "$(basename "$f")"
  psql_root -d "$DB" -q -f "$f"
done

if [[ "${1:-}" == "--test" ]]; then
  echo "==> running SQL tests"
  for f in "$ROOT"/supabase/tests/test_*.sql; do
    [[ -e "$f" ]] || continue
    printf '    %s\n' "$(basename "$f")"
    psql_root -d "$DB" -q -f "$f"
  done
fi

echo "==> ok"
