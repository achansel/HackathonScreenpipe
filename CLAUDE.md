# friction-assist (hackathon Screenpipe, branche `demo`)

Cette branche est le **rendu au jury** : seulement ce qui est construit et utilisable. Lire [README.md](README.md), puis [docs/etat.md](docs/etat.md) (ce qui marche, mesures, limites) avant d'agir. Les documents de travail et le parcours guidé web restent sur `main`.

- Ne rien ajouter ici qui ne soit pas construit et testé ; ne pas faire passer un élément « après » de [docs/etat.md](docs/etat.md) dans la démo sans accord de l'équipe.
- Après tout changement ou toute répétition, mettre à jour [docs/etat.md](docs/etat.md) (heure, preuve) dans le même commit.

## Stack

- TypeScript sous **Bun**, aucun code natif, aucun fork de Screenpipe : on n'utilise que son API locale ([docs/screenpipe.md](docs/screenpipe.md)).
- Un Windows (code dans WSL) et des Mac : tout le code doit marcher sur les deux.

## Démo : clients fictifs Crisp

Pour créer ou générer le lien d'un client fictif (chat Crisp), suivre [docs/crisp.md](docs/crisp.md) : même Website ID, e-mails en `@example.com` (ou les exceptions `.test` documentées), `locale=fr`, valeurs encodées. Jamais de personne réelle.

## Environnement Screenpipe

Screenpipe tourne toujours **sur l'OS hôte**, jamais dans WSL. Le code parle à `127.0.0.1` :

| Variable | Valeur | Usage |
| --- | --- | --- |
| `SCREENPIPE_URL` | `http://127.0.0.1:3030` | API (`/search`, `/live-views/schema`…) |
| `SCREENPIPE_NOTIFY_URL` | `http://127.0.0.1:11435` | `POST /notify` |
| `SCREENPIPE_API_KEY` | jeton local | `Authorization: Bearer …` obligatoire sur l'API (403 sinon) |

`/notify` n'exige pas de jeton.

### Mise en place (une fois par machine)

```bash
scripts/screenpipe-env.sh && source ~/.config/screenpipe/env
```

Le script trouve le CLI (côté Windows depuis WSL, dans le PATH ou `~/.screenpipe/cli` sur Mac) et écrit `~/.config/screenpipe/env` (chmod 600, hors dépôt). À relancer si le jeton change.

### Windows + WSL

- `~/.wslconfig` côté Windows doit contenir `networkingMode=mirrored` (sinon `127.0.0.1` de WSL n'atteint pas Screenpipe).
- Depuis WSL, `curl` / `fetch` normalement.

### Règles

- **Ne jamais** committer un jeton ni `~/.config/screenpipe/env`, `~/.config/friction-assist/team.env`, `~/.config/friction/env`, ni les afficher dans les logs ou les sorties.
- Lire la config via `process.env` / `Bun.env`, jamais de valeur en dur.
- Vérification rapide : `curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" "$SCREENPIPE_URL/search?limit=1"` doit répondre en 200.
