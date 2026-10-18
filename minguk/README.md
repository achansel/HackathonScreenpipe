# minguk/ : lecture de Crisp et des appels, fiche HubSpot, environnement PipingTable

TypeScript sous Bun, aucune dépendance d'exécution. Depuis ce dossier : `bun install`, puis `bun test` (122 tests).

| Partie | Code | Utilisé par |
| --- | --- | --- |
| **Lecture de Crisp** via Screenpipe : nouveau message client (nom, texte), compteur de non-lus, conversation ouverte ; captures OCR et accessibilité, Windows et Mac | `src/detect/crisp-watcher.ts`, `crisp-inbox.ts` ; `bun run watch:crisp` | l'agent (contexte du dossier client) |
| **Écoute d'un appel** : réunion Screenpipe, client reconnu, phrases de l'employé | `src/detect/call-listener.ts`, `call-episodes.ts` ; `bun run call` | l'agent |
| **Fiche HubSpot** retrouvée par le nom du client | `src/assist/hubspot-lookup.ts` | l'agent (notification « fiche client ») |
| **Environnement PipingTable** : clients HubSpot, historique Slack, pages Notion, clients Crisp | `src/seed/`, `content/notion/`, `bun run seed`, `bun run seed:slack` | la démo ([build/pipingtable.md](build/pipingtable.md)) |
| **Simulateur de clients** : une page locale envoie les messages des clients de la démo dans la vraie boîte Crisp et mesure le délai de détection | `src/sim/`, `bun run simulate --sans-aide` (http://127.0.0.1:4518) | la démo |
| **Notifications d'aide** (chemin rapide, Slack + message, règle maison) : modèles, file, suivi 👍/👎, escalade | `src/notify/` ; `bun run demo`, `bun run preview:notifs`, `bun run studio:notifs` | les modèles d'escalade ; studio pour rédiger les notifications |
| **Film** : le système en 11 scènes animées, sur de vraies captures | `motion/film.html` | le pitch |

Jetons : `~/.config/screenpipe/env` (Screenpipe) et `~/.config/friction/env` (`HUBSPOT_SEED_TOKEN`, `SLACK_SEED_TOKEN`), hors dépôt, jamais affichés. Pendant la démo, l'agent (`andrea/daemon`) est le seul décideur : ne pas lancer en même temps `bun run simulate` sans `--sans-aide`.
