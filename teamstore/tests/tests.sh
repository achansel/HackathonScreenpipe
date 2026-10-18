#!/usr/bin/env bash
# Tous les tests de teamstore d'une commande (Mac, Linux, WSL). Résultats détaillés : teamstore/MESURES.md.
#   ./teamstore/tests/tests.sh              unitaires + bout en bout (stockage local) + circuit du démon
#   ./teamstore/tests/tests.sh --supabase   + les mêmes tests sur le Supabase de team.env
#   ./teamstore/tests/tests.sh --ia         + évaluation de la boucle de nuit avec le vrai modèle (Screenpipe)
#   ./teamstore/tests/tests.sh --perf       + banc de performance (local et Supabase)
set -uo pipefail
cd "$(dirname "$0")"
[ -f ~/.config/screenpipe/env ] && . ~/.config/screenpipe/env
fail=0
step() { echo; echo "== $1"; }
step "unitaires (boucle de nuit, tableau en direct)"; bun test ./nuit.test.ts ./board.test.ts 2>&1 | tail -4 || fail=1
bun ../server/local-server.ts >/tmp/fa-tests-local.log 2>&1 & LS=$!; sleep 1
step "bout en bout, stockage local"; bun e2e.ts | tail -1; bun e2e.ts >/dev/null || fail=1
step "circuit du démon d'Andrea (local)"; ./daemon-test.sh 2>&1 | grep -E " pass| fail" || fail=1
if [[ " $* " == *" --perf "* ]]; then step "performance (local)"; bun ../mesures/perf.ts --local | tail -5; fi
kill $LS 2>/dev/null
if [[ " $* " == *" --supabase "* ]]; then
  set -a; . ~/.config/friction-assist/team.env; set +a
  step "bout en bout, Supabase"; TEAMSTORE_URL=$FRICTION_TEAMSTORE_URL TEAMSTORE_ANON_KEY=$FRICTION_TEAMSTORE_ANON_KEY TEAMSTORE_REST_PATH=/rest/v1 bun e2e.ts | tail -1
  step "circuit du démon, Supabase"; TEAMSTORE_URL=$FRICTION_TEAMSTORE_URL TEAMSTORE_ANON_KEY=$FRICTION_TEAMSTORE_ANON_KEY TEAMSTORE_REST_PATH=/rest/v1 ./daemon-test.sh 2>&1 | grep -E " pass| fail"
fi
if [[ " $* " == *" --perf "* ]]; then step "performance (Supabase)"; bun ../mesures/perf.ts | tail -5; fi
if [[ " $* " == *" --ia "* ]]; then step "boucle de nuit, vrai modèle"; (cd .. && bun teamstore/nuit/eval.ts --tirages 1 | tail -6 && bun teamstore/nuit/eval.ts --reserve --tirages 1 | tail -4); fi
echo; [ $fail = 0 ] && echo "TOUT EST VERT" || echo "ÉCHEC : voir plus haut"
exit $fail
