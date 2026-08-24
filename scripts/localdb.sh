#!/usr/bin/env bash
# Bring up a throwaway PostgreSQL instance, apply the shims + all migrations,
# and (optionally) run the SQL test suite. Used by CI and by `npm run db:verify`.
set -euo pipefail

# Connection defaults suit a local socket-based cluster; CI overrides PGHOST
# and PGPORT to reach a TCP service container.
PGHOST=${PGHOST:-/tmp/pgsock}
PGPORT=${PGPORT:-55432}
PGUSER=${PGUSER:-postgres}
DB=${DB:-unistreak_test}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_root() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"; }

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
