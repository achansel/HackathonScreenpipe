#!/usr/bin/env bash
# Base de test locale qui imite Supabase : Postgres + PostgREST, rôle `anon`, même schéma.
# Usage : ./local-db.sh up | down
set -euo pipefail
cd "$(dirname "$0")"
NET=fa-teamstore

case "${1:-up}" in
  up)
    docker network create $NET >/dev/null 2>&1 || true
    docker run -d --rm --name fa-pg --network $NET -e POSTGRES_PASSWORD=postgres postgres:16-alpine >/dev/null
    until docker exec fa-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
    sleep 1
    docker exec -i fa-pg psql -q -U postgres -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role authenticator login password 'authpass' noinherit;
grant anon to authenticator;
grant usage on schema public to anon;
SQL
    docker exec -i fa-pg psql -q -U postgres -v ON_ERROR_STOP=1 < schema.sql
    docker run -d --rm --name fa-rest --network $NET -p 127.0.0.1:3001:3000 \
      -e PGRST_DB_URI=postgres://authenticator:authpass@fa-pg:5432/postgres \
      -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon postgrest/postgrest >/dev/null
    until curl -s -o /dev/null http://127.0.0.1:3001/; do sleep 1; done
    echo "base de test prête : http://127.0.0.1:3001"
    ;;
  down)
    docker rm -f fa-rest fa-pg >/dev/null 2>&1 || true
    docker network rm $NET >/dev/null 2>&1 || true
    echo "base de test arrêtée"
    ;;
esac
