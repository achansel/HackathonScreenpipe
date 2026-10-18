# Comment Screenpipe est utilisé

friction-assist n'est pas un fork : c'est un programme Bun qui parle à l'API locale de Screenpipe (`http://127.0.0.1:3030`, jeton local obligatoire) et à son serveur de notifications (`http://127.0.0.1:11435`). Tout ce que l'utilisateur voit vit dans Screenpipe.

| Fonction Screenpipe | Usage dans friction-assist | Code |
| --- | --- | --- |
| `GET /search` (`content_type` ocr, input, accessibility ; `app_name`, `browser_url`, `start_time`) | Toutes les secondes : texte à l'écran et frappes des applis de travail (`FRICTION_SCOPE` : Slack, Crisp, HubSpot, Notion). L'agent en fait des **épisodes** : fenêtre, mots nouveaux, recherche dans l'URL, délai d'attente. Lecture de la boîte Crisp (titre de fenêtre, compteur « 💬N »). | `andrea/daemon/screenpipe.ts`, `episodes.ts` ; `minguk/src/detect/crisp-watcher.ts` |
| `GET /frames/:id/elements` | Éléments d'accessibilité d'une capture : la liste des conversations Crisp (nom, ancienneté, aperçu du message). | `minguk/src/detect/crisp-inbox.ts` |
| `POST /v1/chat/completions` (passerelle IA) | Qualification d'un épisode par le modèle choisi dans Screenpipe (`claude-opus-5` par défaut) : friction ou non, type de détour, étape, confiance, solution connue. Identifiants évidents masqués avant l'envoi. Même passerelle pour la boucle de nuit. | `andrea/daemon/qualify.ts`, `teamstore/nuit.ts` |
| `POST /notify` (port 11435) avec `actions` | L'aide, la fiche client, « Un collègue bloque », la règle à certifier. Boutons : `api` ([Ça m'a aidé], [Pas ça], [Partager], [Certifier]), `link` ([Y aller]), `copy`. | `andrea/daemon/main.ts`, `certify.ts` |
| Connexions : `/connections/n8n/instances/…`, `/connections/n8n/proxy?instance=friction-assist` | **Relais des clics** : un bouton `api` appelle le proxy de Screenpipe, qui transmet au serveur local de l'agent (port 8787, `/hook`). Chaque notification porte un nonce : un faux clic est refusé (403). Pas de serveur exposé. | `andrea/daemon/screenpipe.ts` (`setupRelay`, `relayUrl`) |
| `GET /feedback` | Les 👍 / 👎 du panneau de notifications, relus toutes les 10 s, deviennent des retours sur l'aide. | `andrea/daemon/screenpipe.ts` |
| `PUT /live-views/:id` (+ `expectedRevision`) | Installation des deux Live Views à partir de modèles JSON : « Frictions de l'équipe » (`friction-map`) et « Mon agent, en direct » (`friction-agent`). | `andrea/daemon/*.liveview.json`, `main.ts carte-installer` |
| `GET /outputs/targets?pipe=…`, `POST /outputs/targets/:id/submit` | Remplissage des blocs des Live Views (metric, table, list, timeline, markdown) : la carte toutes les 30 s, la trace de l'agent dès qu'elle change. | `andrea/daemon/map.ts`, `trace.ts` |
| `GET /meetings/:id` | Transcription en direct d'une réunion Screenpipe : un appel client devient du contexte, les phrases de l'employé des épisodes. | `minguk/src/detect/call-listener.ts`, `call-episodes.ts` |

## Ce qu'on a mesuré sur Screenpipe

- Sous Windows, Chrome s'appelle `chrome.exe` et `browser_url` n'est rempli que sur les captures par accessibilité ; la liste Crisp se lit sur les captures OCR, reconnues au titre de la fenêtre. Un Alt+Tab (« Task Switching ») est parfois la seule capture lisible.
- Deux recherches en parallèle donnent souvent `503 search is busy` : l'agent les enchaîne.
- Screenpipe refuse une notification dont l'`id` a déjà été envoyé ; les identifiants sont uniques.
- Le serveur de notifications peut cesser de répondre ; l'agent attend 1 min avant de réessayer, et relancer l'app Screenpipe le remet en route.
- Les Live Views sont en lecture seule : pas de bouton ni de couleur (schéma `/live-views/schema`). Les actions passent par les notifications ; l'état se lit aux emoji. L'app n'est pas prévenue quand un bloc change : elle rafraîchit à son rythme.
- Largeurs de bloc autorisées : 3, 6, 12. Recréer une vue remet sa disposition à zéro.

## Le correctif Mac

Sur Mac, un clic sur un bouton `api` n'arrive jamais : le panneau natif renvoie l'action au JavaScript d'une fenêtre « usually not mounted ». [andrea/screenpipe-patch/](../andrea/screenpipe-patch/) traite les boutons `api` en Rust. C'est un écart assumé avec « aucun fork », pour la démo ; la PR est une des évolutions qu'on propose à Screenpipe, avec une mémoire d'équipe chiffrée native et des actions dans les Live Views.
