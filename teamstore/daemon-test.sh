#!/usr/bin/env bash
# Test d'intégration du daemon sur la base locale (./local-db.sh up avant). Instance dédiée : rien ne touche à l'état réel.
cd "$(dirname "$0")"
FRICTION_INSTANCE=teamstore-test FRICTION_REQUEST_JITTER=0-0 FRICTION_TEAMSTORE_URL=${TEAMSTORE_URL:-http://127.0.0.1:3001} \
FRICTION_TEAMSTORE_REST_PATH=${TEAMSTORE_REST_PATH-} FRICTION_TEAMSTORE_ANON_KEY=${TEAMSTORE_ANON_KEY:-} \
  bun test ./daemon.test.ts
