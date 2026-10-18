# integrations

Lecture des outils métier via Screenpipe, fiche client, et l'environnement fictif de la démo. Bun, aucune dépendance d'exécution. `bun install` puis `bun test` (122).

| Partie | Code | Qui s'en sert |
| --- | --- | --- |
| Lecture de Crisp : nouveau message (nom, texte), non-lus, conversation ouverte ; OCR et accessibilité, Windows et Mac | `src/detect/crisp-watcher.ts`, `crisp-inbox.ts` ; `bun run watch:crisp` | l'agent (contexte client) |
| Écoute d'un appel : réunion Screenpipe, client reconnu, phrases de l'employé | `src/detect/call-listener.ts`, `call-episodes.ts` ; `bun run call` | l'agent |
| Fiche HubSpot par le nom | `src/assist/hubspot-lookup.ts` | l'agent |
| Environnement PipingTable : clients HubSpot, historique Slack, pages Notion, clients Crisp | `src/seed/`, `content/notion/`, `bun run seed`, `bun run seed:slack` ; [build/pipingtable.md](build/pipingtable.md) | la démo |
| Simulateur de clients : envoie les messages des clients de démo dans la vraie boîte Crisp, mesure le délai de détection | `src/sim/`, `bun run simulate --sans-aide` (4518) | la démo |
| Notifications d'aide : modèles, file, suivi 👍/👎, escalade Slack ; studio pour rédiger les variantes | `src/notify/`, `src/studio/` ; `bun run demo`, `bun run studio:notifs` | escalade du dashboard ; rédaction |

Jetons dans `~/.config/friction/env` (`HUBSPOT_SEED_TOKEN`, `SLACK_SEED_TOKEN`) et `~/.config/screenpipe/env`. Pendant la démo, l'agent décide seul : `simulate` avec `--sans-aide`.
