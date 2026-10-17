# Projet — Assistance aux frictions (hackathon Screenpipe)

Contexte produit, architecture et règles de vie privée : voir [VISION.md](VISION.md). Ne pas rouvrir les décisions « verrouillées » ni la liste « écartées ».

## Démo du 18 octobre : lire RAPPORT-DEMO.md d'abord

**Dès qu'une demande concerne la démo, ou dès qu'une demande est faite le 18 octobre 2026 (jour de la finale), lire d'abord [RAPPORT-DEMO.md](RAPPORT-DEMO.md)** avant d'agir : ce qui marche (avec preuve), ce qui reste, ce qui est dans la démo et ce qui est du futur (pitch seulement), l'app de Haytham et son intégration dans Screenpipe.

- Ne pas rouvrir les choix techniques de la démo ([andrea/docs/demo.md](andrea/docs/demo.md), « Choix techniques ») ni faire passer un élément « futur » dans la démo sans accord de l'équipe.
- Après tout changement ou toute répétition, **mettre à jour RAPPORT-DEMO.md** (heure, preuve) dans le même commit.
- Une fois le tag `demo` posé : plus de changement de code, sauf correctif bloquant.

## Stack

- TypeScript sous **Bun**, aucun code natif, aucun fork de Screenpipe : on n'utilise que son API locale.
- L'équipe est répartie : un Windows (avec WSL pour coder), les autres sur **Mac**. Tout le code doit marcher sur les deux.

## Démo : clients fictifs Crisp

Pour créer ou générer le lien d'un client fictif (chat Crisp), suivre [docs/crisp.md](docs/crisp.md) : même Website ID, e-mails en `@example.com`, `locale=fr`, valeurs encodées.

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

Le script trouve le CLI (côté Windows depuis WSL, dans le PATH ou `~/.screenpipe/cli` sur Mac) et écrit `~/.config/screenpipe/env` (chmod 600, hors dépôt). Ajouter `[ -f ~/.config/screenpipe/env ] && . ~/.config/screenpipe/env` au `~/.zshrc` pour le charger automatiquement. À relancer si le jeton change (mise à jour de Screenpipe).

### Windows + WSL

- `~/.wslconfig` côté Windows doit contenir `networkingMode=mirrored` (sinon `127.0.0.1` de WSL n'atteint pas Screenpipe).
- Depuis WSL, utiliser `curl` / `fetch` normalement ; la note de VISION.md sur `curl.exe` et l'échappement des guillemets ne concerne que PowerShell.

### Règles

- **Ne jamais** committer le jeton ni `~/.config/screenpipe/env`, ni l'afficher dans les logs ou les sorties.
- Lire la config via `process.env` / `Bun.env`, jamais de valeur en dur.
- Vérification rapide : `curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" "$SCREENPIPE_URL/search?limit=1"` doit répondre en 200.
