# Rapport : le bouton `api` des notifications ne peut pas appeler notre serveur

> **Statut :** constat technique et options, à trancher en équipe.
> **Établi le :** 16 octobre 2026, sur le code de Screenpipe v2.7.114 (`../screenpipe`, commit `991141577`) et par un test sur Mac.
> **Documents liés :** [VISION.md](../VISION.md) (lignes 148 et 156), [notification.md](../notification.md).

## 1. Résumé

- **Ce qu'on prévoyait :** un bouton de notification de type `api` appelle notre serveur local au clic (« Ça m'a aidé », « Partager ma solution »).
- **Ce qui se passe :** Screenpipe **refuse** tout appel `api` qui ne vise pas sa propre API (port 3030). Le clic ne fait rien, sans message visible.
- **Pourquoi :** c'est un choix de sécurité volontaire. Screenpipe joint la clé secrète de l'utilisateur à chaque appel `api`, et n'autorise donc que sa propre adresse.
- **Ce n'est pas un bug à contourner en douce :** le comportement est identique quel que soit l'expéditeur (notre serveur, un pipe, l'agent).
- **Recommandation :**
  - remplacer le bouton `api` par des mécanismes que Screenpipe autorise déjà : un lien qui passe par une redirection, le bouton `copy` natif, les 👍/👎 lus par `/feedback` ;
  - ne pas modifier Screenpipe, et proposer le correctif à l'équipe de Screenpipe.

## 2. Contexte : ce que le projet attendait

| Source | Ce qui était écrit |
| --- | --- |
| VISION.md, ligne 148 | « Consentement de celui qui a la solution : une notification « Partager ta solution ? » dont **le bouton appelle notre serveur** » |
| VISION.md, ligne 156 | « `api` (appeler un endpoint local, **comme notre serveur**) » |
| Skill officiel `screenpipe-api` (section 13) | « `api` (POST a local endpoint — needs `url`, optional `method`/`body`) » |
| Première version de notification.md | « Chaque bouton important est un appel `api` vers notre serveur » |

La documentation officielle dit « un endpoint local », sans préciser qu'il s'agit **uniquement** de l'API de Screenpipe. L'erreur d'interprétation était donc facile.

## 3. Le constat

### 3.1 Le test (16 octobre, Mac)

- **Notification envoyée :** « Démo complète — toutes les options », avec un bouton :

```json
{ "id": "api", "label": "Ça m'a aidé (api)", "type": "api", "url": "http://127.0.0.1:11435/notify", "method": "POST", "body": { "title": "Bouton api reçu" } }
```

- **Attendu :** une deuxième notification, « Bouton api reçu ».
- **Obtenu :** rien. L'appel est refusé, parce que le port 11435 n'est pas celui de l'API (3030).

### 3.2 Le code qui refuse

`apps/screenpipe-app-tauri/lib/notifications/actions.ts:306` :

```ts
case "api": {
	if (action.url) {
		// An `api` action calls back into the local screenpipe API with the
		// user's bearer key attached. A notification is attacker-controllable,
		// so an absolute URL pointing off-box would exfiltrate that key or turn
		// the app into a confused deputy. Only same-origin relative paths and
		// explicit local-API URLs are allowed.
		if (!isLocalApiUrl(action.url)) {
			throw new Error(`refused api action to non-local url: ${action.url}`);
		}
		const res = await localFetch(action.url, { /* … */ });
```

`apps/screenpipe-app-tauri/lib/api.ts:266` (`isLocalApiUrl`) n'accepte que :

- le protocole `http:` ;
- l'hôte `localhost` ou `127.0.0.1` ;
- **le port de l'API Screenpipe** (`_port`, 3030 par défaut).

`localFetch` ajoute ensuite l'en-tête `Authorization: Bearer <clé>`. **C'est la raison du verrou :** n'importe quel programme peut envoyer une notification sans jeton (`/notify` est ouvert). Sans ce verrou, n'importe quel programme pourrait donc récupérer la clé en faisant cliquer l'utilisateur.

Le même contrôle existe dans l'ancien gestionnaire, `components/notification-handler.tsx:250`.

### 3.3 Le trajet d'un clic, selon le système

```
            clic sur un bouton "api"
                     │
     ┌───────────────┴────────────────┐
     │ Mac : panneau natif SwiftUI     │ Windows : panneau web (React)
     ▼                                 ▼
native_actions.rs:685               page.tsx:180
dispatch_notification_action         executeNotificationAction
     │                                 │
     │ "api" (hors record-hd) n'est    ▼
     │ pas géré en Rust :           actions.ts:306 → isLocalApiUrl
     │ envoyé au JavaScript                  │
     ▼                                 port ≠ 3030 → refusé
native_actions.rs:1173
emit("native-notification-action")
     │
     ▼
notification-handler.tsx:141 (fenêtre overlay)
     │  → si la fenêtre n'est pas montée : rien ne se passe
     ▼
notification-handler.tsx:250 → isLocalApiUrl → port ≠ 3030 → refusé
```

**Un second problème sur Mac :** même vers le port 3030, un bouton `api` générique dépend d'une fenêtre que le code lui-même décrit comme « usually not mounted » (`native_actions.rs:1131`). Le clic peut donc ne rien faire du tout, même pour une adresse autorisée. Seul le cas `record-hd` est traité directement en Rust (`native_actions.rs:1053`).

## 4. L'impact sur notre projet

| Fonction prévue | Touchée ? |
| --- | --- |
| [Ça m'a aidé] / [Pas ça] qui préviennent notre serveur | oui |
| [Partager ma solution] pour celui qui a la solution (VISION.md, l. 148) | oui |
| [Copier] par notre serveur (`pbcopy`, `clip.exe`) | oui, mais inutile : le bouton `copy` natif existe |
| Savoir si une aide a été utilisée | oui, pour le clic. La vue et la fermeture restent lisibles par `/notifications` |
| [Y aller] (ouvrir HubSpot ou Slack) | non : c'est un `link`, qui est autorisé |

## 5. Les options évaluées

| # | Option | Marche ? | Expérience | Coût | Respecte « sans fork » |
| --- | --- | --- | --- | --- | --- |
| A | `link` vers notre serveur, qui note le clic et **redirige** (vers HubSpot, Slack…) | oui, Mac et Windows | ouvre un onglet, mais c'est la page voulue | faible | oui |
| B | bouton `copy` natif (`{"type":"copy","value":"…"}`) | oui (`native_actions.rs:807`) | instantané | nul | oui |
| C | 👍/👎 de Screenpipe, lus par `GET /feedback` | oui : affichés dès qu'il y a un `pipe_name` | natif, avec une correction de 500 caractères avec 👎 | faible | oui |
| D | `api` vers **l'API de Screenpipe** (`POST 3030/feedback`), relu ensuite par notre serveur | Windows : probable. Mac : **à tester** (fenêtre overlay) | invisible, instantané | faible | oui |
| E | bouton `pipe` : lance un pipe qui fait un `curl` vers notre serveur | oui en théorie : un pipe peut appeler `127.0.0.1` (`screenpipe-permissions.ts:192`) | lent (agent IA), consomme des crédits, ajoute un toast « … is running » | moyen | oui |
| F | `link` vers une **page locale** de notre serveur (formulaire) | oui | un onglet, mais avec un vrai champ de saisie | moyen | oui |
| G | **modifier le code** de Screenpipe pour autoriser notre port | oui | idéale | **élevé** (section 6) | **non** |
| H | proposer le correctif à Screenpipe (pull request) | dépend d'eux, pas avant la démo | idéale, plus tard | faible | oui |

## 6. L'option « modifier le code » en détail

### 6.1 Le changement

Un nouveau type de bouton, par exemple `callback`. Il appelle un port local **sans** joindre la clé, ce qui supprime le risque de sécurité. Trois endroits :

1. `lib/notifications/actions.ts:306` : un `case "callback"` qui fait un `fetch` simple vers `127.0.0.1:<port>`, sans `localFetch`.
2. `components/notification-handler.tsx:250` : la même règle dans l'ancien gestionnaire.
3. `src-tauri/src/commands/native_actions.rs:1053` : le même cas traité **en Rust**, pour que le clic marche sur Mac même sans la fenêtre overlay.

Environ 50 lignes et leurs tests : une demi-journée.

### 6.2 Ce que ça coûte vraiment

| Coût | Détail |
| --- | --- |
| La règle du projet | « tout vit dans Screenpipe, sans fork » est **verrouillé** (VISION.md, l. 17 et 141). CLAUDE.md demande de ne pas rouvrir ces décisions |
| La note du jury | « Tout dans Screenpipe, sans fork » est un argument du critère intégration (30 %, VISION.md l. 252) et une phrase du pitch (l. 175) |
| La compilation | une appli Tauri complète (Rust, Swift, React) à compiler sur Mac **et** Windows |
| Les permissions macOS | une appli recompilée change de signature : il faut redonner l'enregistrement d'écran et l'accessibilité. C'est la raison de l'abandon de l'idée « modifier l'overlay » |
| Les machines | tout le monde doit lancer notre version, y compris le jour de la démo |
| La licence | licence commerciale de Screenpipe : modification autorisée pour un usage personnel non commercial, ou pour une évaluation de 7 jours. Distribution interdite |
| La maintenance | Screenpipe publie souvent ; notre version prend du retard |

## 7. Recommandation

1. **Pour la démo, sans fork :**
   - **A** pour [Y aller], le lien de redirection ;
   - **B** pour [Copier] ;
   - **C** pour « utile / pas utile » et l'escalade ;
   - **F** pour celui qui a la solution, la page locale de consentement.
2. **À tester tout de suite :** **D**. S'il marche sur Mac, il offre un bouton personnalisé invisible et instantané (par exemple [Partager] sans ouvrir d'onglet).
3. **En parallèle :** **H**, proposer le type `callback` à Louis et Ezra (section 9). Dans le pitch : « on a trouvé la limite, on l'a contournée sans fork, et on leur propose le correctif ».
4. **Ne pas retenir G**, sauf décision d'équipe explicite de rouvrir « sans fork ».

## 8. Tests à faire

- [ ] **D sur Mac :** une notification avec un bouton `api` vers `POST /feedback` (`target.kind = "notification"`, `target.id` = l'id de la notification, `rating = "up"`). Cliquer, puis vérifier avec `GET /feedback?kind=notification`.
- [ ] **D sous Windows :** le même test, depuis WSL.
- [ ] **C :** vérifier que les 👍/👎 s'affichent avec `pipe_name: "friction-assist"`, et que la correction n'est acceptée qu'avec 👎.
- [ ] **A :** une redirection locale (`/go/42` → une page HubSpot) depuis un `link`, sur Mac et sous Windows (avec un serveur dans WSL et le réseau `mirrored`).
- [ ] **B :** le bouton `copy` avec `value`, sur les deux systèmes.

## 9. La proposition pour l'équipe de Screenpipe (brouillon)

> **Titre :** un type de bouton `callback` pour les notifications, vers un port local, sans la clé API.
>
> **Le besoin :** les intégrations externes (pipes, outils locaux) veulent savoir qu'un bouton a été cliqué. Le type `api` ne vise que l'API de Screenpipe, à juste titre, puisqu'il porte la clé.
>
> **La proposition :**
> - `{"type":"callback","url":"http://127.0.0.1:<port>/…","body":{…}}` ;
> - envoyé **sans** l'en-tête `Authorization` ;
> - limité à `127.0.0.1` et `localhost` (contrôle de l'hôte, comme `isLocalApiUrl`) ;
> - traité en Rust, pour marcher depuis le panneau natif même sans fenêtre overlay ;
> - éventuellement réservé aux ports déclarés par un pipe installé.
>
> **Une alternative plus légère :** publier un événement `notification_action` (id de la notification, id du bouton) sur `/ws/events`. Toute intégration pourrait alors l'écouter.

## 10. Références dans le code

Les chemins sont relatifs à `../screenpipe/apps/screenpipe-app-tauri/`.

| Sujet | Emplacement |
| --- | --- |
| refus d'un `api` hors API | `lib/notifications/actions.ts:306-316` |
| règle d'adresse autorisée | `lib/api.ts:266` (`isLocalApiUrl`) |
| même refus dans l'ancien gestionnaire | `components/notification-handler.tsx:250` |
| gestionnaire monté dans l'overlay | `app/overlay/page.tsx:392` |
| traitement des clics du panneau natif | `src-tauri/src/commands/native_actions.rs:685` |
| `api` renvoyé au JavaScript | `src-tauri/src/commands/native_actions.rs:1170-1173` |
| « usually not mounted » | `src-tauri/src/commands/native_actions.rs:1131` |
| bouton `copy` natif | `src-tauri/src/commands/native_actions.rs:807` |
| lancement d'un pipe depuis une notification | `src-tauri/src/commands/native_actions.rs:553` |
| enregistrement des 👍/👎 | `src-tauri/swift/notification_panel.swift:691` |
| format accepté par `/feedback` | `../../crates/screenpipe-engine/src/routes/ai_feedback.rs:134` |
| règle `curl` des pipes | `../../crates/screenpipe-core/assets/extensions/screenpipe-permissions.ts:192` |
