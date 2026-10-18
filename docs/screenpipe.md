# Comment Screenpipe est utilisé

Pas de fork : un programme Bun qui parle à l'API locale (`127.0.0.1:3030`, jeton obligatoire) et au serveur de notifications (`127.0.0.1:11435`).

| Fonction | Usage | Code |
| --- | --- | --- |
| `GET /search` (ocr, input, accessibility ; `app_name`, `browser_url`, `start_time`) | Chaque seconde, texte et frappes des applis de `FRICTION_SCOPE` → épisodes. Boîte Crisp par le titre de fenêtre et le compteur « 💬N ». | `agent/screenpipe.ts`, `agent/episodes.ts`, `integrations/src/detect/crisp-watcher.ts` |
| `GET /frames/:id/elements` | Arbre d'accessibilité d'une capture : liste des conversations Crisp (nom, ancienneté, aperçu). | `integrations/src/detect/crisp-inbox.ts` |
| `POST /v1/chat/completions` | Qualification d'un épisode (`claude-opus-5`) : friction, détour, étape, confiance, solution. Identifiants masqués avant. Même passerelle pour la boucle de nuit. | `agent/qualify.ts`, `teamstore/nuit.ts` |
| `POST /notify` + `actions` | Aide, fiche client, « Un collègue bloque », règle à certifier. `api` ([Ça m'a aidé], [Pas ça], [Partager], [Certifier]), `link` ([Y aller]), `copy`. | `agent/main.ts`, `agent/certify.ts` |
| `/connections/n8n/instances/…`, `/connections/n8n/proxy?instance=friction-assist` | Relais des clics : le bouton `api` appelle le proxy Screenpipe, qui POST sur l'agent (`:8787/hook`). Nonce par notification, faux clic → 403. Rien d'exposé. | `agent/screenpipe.ts` (`setupRelay`, `relayUrl`) |
| `GET /feedback` | 👍/👎 du panneau, relus toutes les 10 s. | `agent/screenpipe.ts` |
| `PUT /live-views/:id` (`expectedRevision`) | Installation des deux vues depuis `agent/*.liveview.json`. | `agent/main.ts carte-installer` |
| `GET /outputs/targets?pipe=…`, `POST /outputs/targets/:id/submit` | Remplissage des blocs (metric, table, list, timeline, markdown). Carte toutes les 30 s, trace dès qu'elle change. | `agent/map.ts`, `agent/trace.ts` |
| `GET /meetings/:id` | Transcription d'une réunion Screenpipe : appel client → contexte, phrases de l'employé → épisodes. | `integrations/src/detect/call-*.ts` |

## Mesuré

- Windows : Chrome = `chrome.exe`, `browser_url` seulement sur les captures accessibilité ; la liste Crisp se lit sur l'OCR, repérée au titre de fenêtre. Un Alt+Tab (« Task Switching ») est parfois la seule capture lisible.
- Deux `/search` en parallèle → souvent `503 search is busy`. On enchaîne.
- Un `id` de notification déjà envoyé est refusé.
- Le serveur de notifications se fige parfois ; relancer l'app. L'agent attend 1 min avant de réessayer.
- Live Views : lecture seule, ni bouton ni couleur (`/live-views/schema`). Largeurs 3/6/12. L'app n'est pas prévenue d'un changement de bloc (rien sur `/ws/events`), elle rafraîchit à son rythme. Recréer une vue remet la disposition à zéro.
- `claude-haiku-4-5` absent de la liste de la passerelle : remplacé en silence.

## Boutons `api` sur Mac

Sur Mac, un bouton `api` ne fait rien : le panneau natif renvoie l'action au JS d'une fenêtre « usually not mounted » (`native_actions.rs`). Constaté, pas corrigé : la démo tourne sur Windows. [screenpipe-patch/](../screenpipe-patch/) garde le diff qui traiterait ces boutons en Rust, pour montrer où ça se passe ; il n'est ni compilé, ni testé, ni proposé.
