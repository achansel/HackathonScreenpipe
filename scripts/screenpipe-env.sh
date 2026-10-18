#!/usr/bin/env bash
# Écrit ~/.config/screenpipe/env (jeton + URLs Screenpipe). Fonctionne sur WSL et sur macOS.
# Usage : scripts/screenpipe-env.sh && source ~/.config/screenpipe/env
set -euo pipefail

if grep -qi microsoft /proc/version 2>/dev/null; then
  # WSL : Screenpipe tourne côté Windows ; réseau "mirrored" => 127.0.0.1 partagé
  WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')
  CLI=$(ls -d /mnt/c/Users/"$WIN_USER"/.screenpipe/cli/*/screenpipe.exe 2>/dev/null | sort -V | tail -1 || true)
else
  # macOS : CLI dans le PATH, sinon dans ~/.screenpipe/cli
  CLI=$(command -v screenpipe || ls -d "$HOME"/.screenpipe/cli/*/screenpipe 2>/dev/null | sort -V | tail -1 || true)
fi
[ -n "${CLI:-}" ] || { echo "CLI screenpipe introuvable (l'app est-elle installée ?)" >&2; exit 1; }

TOKEN=$("$CLI" auth token 2>/dev/null | tr -d '\r\n')
[ -n "$TOKEN" ] || { echo "Jeton vide : Screenpipe est-il lancé ?" >&2; exit 1; }

mkdir -p ~/.config/screenpipe
umask 077
cat > ~/.config/screenpipe/env <<ENV
export SCREENPIPE_API_KEY=$TOKEN
export SCREENPIPE_URL=http://127.0.0.1:3030
export SCREENPIPE_NOTIFY_URL=http://127.0.0.1:11435
ENV
chmod 600 ~/.config/screenpipe/env
echo "OK : ~/.config/screenpipe/env écrit"
