# minguk/ : notifications d'aide, détection Crisp, environnement PipingTable

TypeScript sous Bun, aucune dépendance d'exécution. Depuis ce dossier : `bun install`, puis `bun test`.

| Partie | Code | Doc |
| --- | --- | --- |
| **Notifications d'aide** (🧭 chemin rapide, 💬 Slack + message, 📘 règle maison) : file, redirection des clics, suivi 👍/👎, escalade | `src/notify/`, `bun run demo` | [build/notification-plan.md](build/notification-plan.md), [build/demo-runbook.md](build/demo-runbook.md) |
| **Détection Crisp** : nouveau message (avec son texte), compteur de non-lus, conversation ouverte, lus via Screenpipe | `src/detect/`, `bun run watch:crisp` | en tête de `src/detect/crisp-watcher.ts` |
| **Simulateur de clients** : une page locale envoie les messages des clients de la démo dans la vraie boîte Crisp, et mesure le délai de détection | `src/sim/`, `bun run simulate` (http://127.0.0.1:4518) | en tête de `src/cli/simulate.ts` |
| **Environnement PipingTable** : clients HubSpot, historique Slack, pages Notion | `src/seed/`, `content/notion/`, `bun run seed`, `bun run seed:slack` | [build/pipingtable.md](build/pipingtable.md) |

Jetons : `~/.config/screenpipe/env` (Screenpipe) et `~/.config/friction/env` (HubSpot, Slack), hors dépôt, jamais affichés.
