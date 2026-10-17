#!/usr/bin/env bash
# friction-assist — équipes chiffrées : une commande (Mac, Linux, WSL). Voir teamstore/README.md.
#   ./teamstore/start.sh            démo PipingTable
#   ./teamstore/start.sh moi        mon poste, avec mes collègues (options : --heberger, --serveur <url>)
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v bun >/dev/null 2>&1 && [ -x "$HOME/.bun/bin/bun" ]; then export PATH="$HOME/.bun/bin:$PATH"; fi
if ! command -v bun >/dev/null 2>&1; then
  echo "Bun (le moteur JavaScript du projet) n'est pas installé."
  read -r -p "L'installer maintenant depuis https://bun.sh ? [o/N] " ok
  case "$ok" in o|O|oui|y|Y) curl -fsSL https://bun.sh/install | bash; export PATH="$HOME/.bun/bin:$PATH" ;; *) echo "Installer Bun puis relancer : https://bun.sh"; exit 1 ;; esac
fi
exec bun teamstore/start.ts "$@"
