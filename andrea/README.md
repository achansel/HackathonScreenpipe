# andrea/ — travaux d'Andrea (avec Claude)

Rien ici ne remplace les documents de l'équipe à la racine : ce sont des propositions et des outils de test.

| Fichier | Contenu |
| --- | --- |
| [PROPOSITION.md](PROPOSITION.md) | architecture technique proposée (daemon, IA via Screenpipe, stockage d'équipe temporaire, vocabulaire des frictions, mesures) |
| [VISION.md](VISION.md) | VISION.md de l'équipe + définition de la friction, type « parcours », traitement hors ligne verrouillé (à fusionner après validation) |
| [docs/test-mac.md](docs/test-mac.md) | test à faire sur Mac : boutons de notification, relais webhook, `/feedback` |
| [docs/crisp.md](docs/crisp.md) | docs/crisp.md + le client fictif Julien Moreau |
| `bench/` | banc d'essai de détection (`dataset.mjs` synthétique, `run.mjs`) ; `bench/real/` = données réelles, **ignoré par git** |
| `scripts/collect-episodes.ts` | extrait des épisodes réels de Screenpipe vers `bench/real/` |
| `scripts/test-receiver.ts` | récepteur local de test (joue le daemon) |
| `daemon/` | **étape 1 de la proposition** : daemon friction-assist (détection, qualification, notification, relais des clics, 👍/👎). `bun andrea/daemon/main.ts activer`, `relais`, puis lancer ; `test-notif` pour la chaîne sans détection |
| `screenpipe-patch/` | correctif Screenpipe : boutons `api` traités en Rust sur Mac (non compilé ici) |

Commandes depuis la racine du dépôt, après `source ~/.config/screenpipe/env`.
