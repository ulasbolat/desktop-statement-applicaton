#!/usr/bin/env bash
# RLS politikalarını yerel bir Postgres'te doğrular.
#
# Supabase'e özgü parçalar (auth.users, auth.uid(), storage.*) 00_supabase_stub.sql
# içinde taklit ediliyor — yani bu test gerçek Supabase'e bağlanmadan,
# migration'ların ve politikaların doğru davrandığını gösteriyor.
#
# Kullanım:  bash supabase/tests/calistir.sh
# Gereken:   postgresql-16 (initdb, pg_ctl, psql)

set -euo pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CALISMA="${PGTEST_DIR:-/var/tmp/quiz-rls-test}"
PORT="${PGTEST_PORT:-55432}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"

echo "→ Geçici Postgres: $CALISMA (port $PORT)"
rm -rf "$CALISMA"
mkdir -p "$CALISMA"

# initdb root olarak çalışmayı reddeder; root isek postgres kullanıcısına geçiyoruz.
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  chown postgres "$CALISMA"; chmod 700 "$CALISMA"
  KOSTUR() { su postgres -c "$1"; }
else
  KOSTUR() { bash -c "$1"; }
fi

KOSTUR "$PGBIN/initdb -D $CALISMA/data -U pg --auth=trust" >/dev/null
KOSTUR "$PGBIN/pg_ctl -D $CALISMA/data -l $CALISMA/log -o '-k $CALISMA -p $PORT -h \"\"' start" >/dev/null

temizle() {
  KOSTUR "$PGBIN/pg_ctl -D $CALISMA/data stop -m immediate" >/dev/null 2>&1 || true
}
trap temizle EXIT

export PGHOST="$CALISMA" PGPORT="$PORT" PGUSER=pg

cp "$KOK"/supabase/migrations/*.sql "$KOK"/supabase/tests/*.sql "$CALISMA/"
chmod 644 "$CALISMA"/*.sql

psql -q -d postgres -c "create database quizdb;" >/dev/null

for f in 00_supabase_stub 0001_init 0002_rls 0003_storage; do
  printf "  %-20s " "$f"
  if psql -q -v ON_ERROR_STOP=1 -d quizdb -f "$CALISMA/$f.sql" >/dev/null 2>&1; then
    echo "OK"
  else
    echo "HATA"
    psql -v ON_ERROR_STOP=1 -d quizdb -f "$CALISMA/$f.sql" 2>&1 | head -20
    exit 1
  fi
done

echo "→ RLS testleri:"
psql -d quizdb -f "$CALISMA/90_rls_test.sql" 2>&1

echo
echo "Her TEST bloğunun çıktısını başlığındaki 'beklenen' ile karşılaştır."
