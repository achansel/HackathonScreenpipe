# andrea/ — travaux d'Andrea (avec Claude)

Rien ici ne remplace les documents de l'équipe à la racine : ce sont des propositions et des outils de test.

| Fichier | Contenu |
| --- | --- |
| [CONTEXTE.md](CONTEXTE.md) | **reprise de session** : décisions, environnement, faits Screenpipe vérifiés, prochaines étapes |
| [ETAT.md](ETAT.md) | **état complet** : ce qui tourne, comment lancer, limites, ce qu'il reste à faire à la main |
| [PROPOSITION.md](PROPOSITION.md) | architecture technique proposée (daemon, IA via Screenpipe, stockage d'équipe temporaire, vocabulaire des frictions, mesures) |
| [VISION.md](VISION.md) | VISION.md de l'équipe + définition de la friction, type « parcours », traitement hors ligne verrouillé (à fusionner après validation) |
| [docs/demo.md](docs/demo.md) | déroulé de la démo finale (3 min), vérifications avant scène, replis, questions du jury |
| [docs/discord.md](docs/discord.md) | questions et bugs pour Louis / Ezra, prêts à coller |
| [docs/test-mac.md](docs/test-mac.md) | test à faire sur Mac : boutons de notification, relais webhook, `/feedback` |
| [docs/crisp.md](docs/crisp.md) | docs/crisp.md + le client fictif Julien Moreau |
| `bench/` | banc d'essai de détection (`dataset.mjs` synthétique, `run.mjs`) ; `bench/real/` = données réelles, **ignoré par git** |
| `scripts/collect-episodes.ts` | extrait des épisodes réels de Screenpipe vers `bench/real/` |
| `scripts/test-receiver.ts` | récepteur local de test (joue le daemon) |
| `daemon/map.ts`, `daemon/friction-map.liveview.json` | **étape 4** : carte d'équipe en Live View (`carte-installer`, `carte`, `peupler-demo`) ; détours par étape en fourchettes, jamais par personne ; `screenpipe://live-view/friction-map` |
| `daemon/` (équipe) | **étape 2** : `teamstore.ts` (blocs chiffrés AES-256-GCM, table sans identité, RLS), `team.ts` (demande anonyme → « Partager ? » chez le collègue → aide chez le demandeur). `equipe-init`, `simuler` (Léa + Karim sur une machine, sans lire l'écran), `injecter lea "…"`. URL de la base et clé d'équipe dans `~/.config/friction-assist/`, jamais dans le dépôt |
| `daemon/` | **étape 1 de la proposition** : daemon friction-assist (détection, qualification, notification, relais des clics, 👍/👎). `bun andrea/daemon/main.ts activer`, `relais`, puis lancer ; `test-notif` pour la chaîne sans détection |
| `offline/` | **étape 3** : traitement hors ligne. `collecter` (rejoue l'historique dans le même découpage que le direct), `apprendre` (étiquette, génère le détecteur, valide), `rapport`, `approuver` (humain), `installer-pipes` |
| `pipes/` | pipes Screenpipe de nuit `friction-collect` → `friction-learn` (enchaînés par `pipe_completed`) |
| `screenpipe-patch/` | correctif Screenpipe : boutons `api` traités en Rust sur Mac (non compilé ici) |

Commandes depuis la racine du dépôt, après `source ~/.config/screenpipe/env`.
