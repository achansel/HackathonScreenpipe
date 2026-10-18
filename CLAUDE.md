# friction-assist (branche `demo` : rendu au jury)

Lire [README.md](README.md) puis [docs/etat.md](docs/etat.md) avant d'agir. Seulement ce qui est construit et testé ; les docs de travail sont sur `main`. Après un changement ou une répétition, mettre à jour `docs/etat.md` dans le même commit.

Dossiers : `agent/` (l'agent), `teamstore/` (mémoire d'équipe chiffrée ; `dashboard/` = ébauche web), `integrations/` (Crisp, appels, HubSpot, environnement PipingTable), `screenpipe-patch/`, `docs/`, `pitch/`.

## Stack

TypeScript sous Bun, pas de code natif, pas de fork : API locale de Screenpipe ([docs/screenpipe.md](docs/screenpipe.md)). Doit tourner sous WSL (Windows) et sur Mac.

## Clients fictifs Crisp

[docs/crisp.md](docs/crisp.md) : même Website ID, e-mails en `@example.com` ou les exceptions `.test` documentées, `locale=fr`, valeurs encodées. Jamais de personne réelle.

## Environnement Screenpipe

Screenpipe tourne sur l'OS hôte, jamais dans WSL. Le code parle à `127.0.0.1`.

| Variable | Valeur | Usage |
| --- | --- | --- |
| `SCREENPIPE_URL` | `http://127.0.0.1:3030` | API, jeton `Authorization: Bearer …` obligatoire (403 sinon) |
| `SCREENPIPE_NOTIFY_URL` | `http://127.0.0.1:11435` | `POST /notify`, sans jeton |
| `SCREENPIPE_API_KEY` | jeton local | |

`scripts/screenpipe-env.sh && source ~/.config/screenpipe/env` écrit le fichier (chmod 600). À relancer si le jeton change. WSL : `networkingMode=mirrored` dans `~/.wslconfig`.

Règles : jamais de jeton ni de fichier `~/.config/*/env` dans le dépôt, les logs ou les sorties ; config via `process.env` / `Bun.env` ; vérification : `curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" "$SCREENPIPE_URL/search?limit=1"` → 200.
