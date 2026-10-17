# PROPOSITION — architecture technique

> Statut : proposition, à valider en équipe. Complète [VISION.md](VISION.md) (version proposée ici ; celle de l'équipe : [../VISION.md](../VISION.md)), [notification.md](../notification.md), [docs/notification-bouton-api.md](../docs/notification-bouton-api.md). Chemins `scripts/`, `bench/`, `docs/` ci-dessous : relatifs à `andrea/`.
> Sources : code Screenpipe `main` du 16/10 (chemins ci-dessous relatifs à leur dépôt), doc `docs/mintlify`, mesures sur Windows (moteur 0.4.52). **[mesuré]** / **[code]** / **[à vérifier]** indiquent le niveau de preuve.

## TL;DR

- Tout passe par Screenpipe (capture, IA, notifications, pipes, Teams), **sauf deux briques** : un daemon Bun local par machine, et un stockage d'équipe partagé.
- Stockage partagé = **Supabase, temporaire**, derrière une interface. Données chiffrées côté client (même modèle que Teams), format `team-memory` de Screenpipe → migrable vers leur cloud le jour où les membres peuvent y écrire.
- Pas de serveur à nous, pas de clé IA : le modèle passe par `/v1/chat/completions` de Screenpipe, sur le compte de chacun.
- Apprentissage **hors ligne** (pipes planifiés), détection **en direct** par du code fixe, validé.

## 1. Vue d'ensemble

```
machine de Léa                                    stockage d'équipe (Supabase, temporaire)
┌──────────────────────────────────────────┐      blobs chiffrés AES-256-GCM, rien en clair
│ Screenpipe  :3030 search/input/feedback  │            ▲              │
│             :3030 /v1/chat/completions   │            │ put          │ list(since)
│             :11435 /notify, /notifications│            │              ▼
│ daemon Bun  (détecteur + serveur 127.0.0.1)│ ──────────┴──── cache local des solutions
└──────────────────────────────────────────┘
nuit : pipes Screenpipe (collect → learn), diffusés par Teams
```

| Brique | Où | Fournie par Screenpipe |
| --- | --- | --- |
| Capture, `/search`, événements d'entrée | local | oui |
| IA (qualification, apprentissage) | `/v1/chat/completions` → préréglage de l'utilisateur | oui |
| Notifications, cloche, 👍/👎 (`/feedback`) | app Screenpipe | oui |
| Traitement de nuit | pipes planifiés, enchaînés par `pipe_completed:<pipe>` | oui |
| Diffusion pipes / filtres / modèle autorisé | Teams (admin) | oui |
| Détecteur temps réel + serveur local (`/go`, consentement) | **daemon Bun** | non (un pipe = agent IA, trop lent pour une boucle à 1 s) |
| Stockage partagé entre membres | **Supabase** | non (Teams = configs poussées par l'admin ; sync = appareils d'un même user) |

## 2. Détection en direct (daemon)

**Boucle, toutes les 1 s, curseur `start_time` + `order=ascending` :**

1. `GET /search?content_type=input` → `app_switch`, `window_focus`, `click` (titres, éléments). Retard ≈ 2 s **[mesuré]**.
2. `GET /search?content_type=ocr` (inclut les frames d'accessibilité) sur les fenêtres actives. Retard capture → API ≈ 1 s **[mesuré]**.
3. **Debounce** : on s'appuie sur la capture « typing pause » de Screenpipe (500 ms après la dernière frappe, `docs/EVENT_DRIVEN_CAPTURE_SPEC.md`, brouillon). Un épisode est qualifié quand le texte du champ est stable ~2 s, ou à l'envoi. Le texte en cours de frappe est lisible **[mesuré]**.
4. Filtre rapide = **code de détection généré la nuit** (0 ms). Seuls les candidats partent au modèle.
5. Confirmation : `POST /v1/chat/completions`, `model: "claude-haiku-4-5"`, sortie 1 mot ou JSON court.
6. Solution trouvée dans le cache local → `POST /notify`. Sinon → écrit une **demande anonyme** dans le stockage.

**Budget** : capture ~1 s + API ~1 s + boucle ≤ 1 s + modèle ~1,2–2,5 s ≈ **4–5 s** de la frappe à la notification **[mesuré par morceaux, jamais de bout en bout]**.

**Pièges connus [mesuré]** :
- `max_tokens` ≥ 200 (1 mot) / 400 (JSON) : le modèle raisonne en interne ; trop bas → `content: ""` avec HTTP 200. Réponse vide = échec → retry.
- `model: "auto"` peut renvoyer vide : nommer le modèle.
- Firefox : le texte d'accessibilité peut venir d'un **autre onglet**, `browser_url` est souvent périmé. Utiliser Chrome, ou l'OCR seul sous Firefox.
- Ignorer les frames `Task Switching` (aperçus alt-tab : titres d'autres fenêtres).
- Les identifiants de session et noms de clients apparaissent dans les titres et URL : à filtrer avant toute sortie.
- `/ws/events` ne porte **aucun texte d'écran** (`ocr_result` / `ui_frame` ne sont plus émis) : pas de push, on poll.

## 3. Hors ligne (pipes de nuit)

- `friction-collect` (`schedule: every 24h`) → épisodes locaux (titres, texte nettoyé, événements). Prototype : `scripts/collect-episodes.ts`.
- `friction-learn` (`trigger: events: [pipe_completed:friction-collect]`, même schéma que `workflow-timing → workflow-discovery`) :
  1. regroupe et étiquette les épisodes ;
  2. régénère le code du détecteur ;
  3. **porte de validation** : déployé seulement s'il bat la version courante sur un jeu de test non vu ;
  4. **approbation humaine** (admin), puis exécution comme code fixe (cf. starter : « fixed code, not AI-generated instructions », « unapproved until a person checks it »).

**Implémenté (`offline/`, `pipes/`) et mesuré le 17/10 sur l'historique réel :**
- collecte = rejeu de l'historique dans le **même** `EpisodeBuilder` que le direct : 2 987 frames + 4 214 événements → 210 épisodes en ~4 s ; incrémentale ensuite (curseur) ;
- **périmètre** (vie privée, pas classement) : seules les applis de travail sont lues ; jugé sur l'appli, le titre/URL ne compte que pour les navigateurs (frames de `claude.exe`/`explorer.exe` titrées « … - Slack » mesurées) ;
- étiquetage par le modèle (≤ 150/nuit, cache ; étiquettes humaines prioritaires dans `labels.human.json`) : 108 « aucun » / 42 frictions sur les 150 premiers ;
- le détecteur est un **filtre avant le modèle** : la porte exige ≥ 90 % des frictions conservées, puis de faire mieux que l'approuvé. Candidat actuel : **97 % des frictions conservées (1 ratée / 31), 15 % du travail normal écarté**, < 1 ms/épisode. Sûr, mais économise peu : il faut des étiquettes humaines et plus de données ;
- pipes installés via `POST /pipes/install` (planif, trigger, permissions relus OK) ; **exécution en échec** sur notre poste : l'agent Pi de Screenpipe ne démarre pas (`pi-subagents … toToolDeclaration is not a function`), bug de leur côté → **repli** : le daemon lance collecte + apprentissage à 3 h si aucun passage n'a eu lieu. `/offline/*` protégé par jeton (403 sans).

Banc d'essai : `bench/run.mjs` (52 cas synthétiques). Résultats **[mesuré, synthétique, optimiste]** : IA texte+titres F1 97 % / 0 fausse alerte / ~1,1 s ; code généré F1 77 % / 0 ms ; règles à la main 59 % ; titres seuls 58 %.

## 4. Vocabulaire des frictions

On **reprend celui de Screenpipe** (`packages/workflows-ui/src/model.ts`, validé dans `crates/screenpipe-core/src/workflows/mod.rs`) et on l'étend :

```yaml
type: waiting | switching | rework | handoff | unclear   # Screenpipe, tel quel
control: direct | influence | external | required       # Screenpipe, tel quel
detour: blocage | demande_aide | recherche | tatonnement | parcours | ressaisie | contournement | attente_relance   # notre extension
```

Mapping : attente → `waiting` ; parcours → `switching` ; ressaisie, tâtonnement → `rework` ; demande d'aide, recherche → `unclear` ; blocage → `unclear` + `control: required|external`.
`control: required` (validation, conformité) ⇒ l'aide **explique** la règle, elle ne propose jamais de la contourner.

## 5. Stockage d'équipe (temporaire)

```ts
interface TeamStore {
  put(kind: "request" | "solution" | "signature", blob: Uint8Array): Promise<string>;
  list(kind: string, since: string): Promise<{ id: string; at: string; blob: Uint8Array }[]>;
}
// impl actuelle : Supabase (table blobs: id, kind, at, ciphertext). Cible : Teams / team-memory.
```

- **Chiffrement client** AES-256-GCM, clé d'équipe dans le lien d'invitation, nonce 12 octets : copie du modèle Teams (`docs/mintlify/.../teams.mdx`, `lib/team-crypto.ts`). Le stockage ne voit que des blobs.
- **Rapprochement côté client**, après déchiffrement (volumes faibles).
- **Implémenté et mesuré le 17/10** (`daemon/teamstore.ts`, `daemon/team.ts`) sur Supabase (pooler IPv4 `aws-0-eu-west-1` : l'hôte direct est IPv6 seul, injoignable depuis WSL/Windows). Simulation à deux daemons (Léa sans solution, Karim avec) : demande anonyme de Léa → « Un collègue bloque » chez Karim **7 s** après → clic Partager → aide chez Léa **4 s** après → la solution reste dans le cache de Léa (2ᵉ blocage : aide locale, sans redemander). En base : 5 colonnes (`id, kind, at, nonce, ciphertext`), aucune identité, RLS active.
- Piège démo : Screenpipe supprime une notification identique dans les 90 s (« duplicate notification suppressed »).
- **Aucune identité dans les lignes** : une même clé de projet pour tous. Pas de Slack comme bus (la connexion poste « en tant que la personne » → Léa identifiée).
- **Format d'une solution = `team-memory`** (`crates/screenpipe-team-memory`) :

```markdown
---
id: 2026-10-17-geste-commercial
created_at: 2026-10-17T11:02:00Z
kind: friction-solution
source: friction-assist
type: unclear
control: required
detour: demande_aide
step: "Crisp → HubSpot : dédommagement client"
owner: support-ops
reviewed: 2026-10-17
uses: 3
---
1 mois offert max, premium seulement. Note `geste commercial` dans HubSpot.
```

## 6. Notifications

Modèle de [notification.md](../notification.md) §4.1 (titre = la réponse, 2 boutons max, `pipe_name: "friction-assist"` pour les 👍/👎). Pas d'emoji ni de « ! » dans nos textes (règle de design Screenpipe).

| Bouton | Usage | Mac | Windows |
| --- | --- | --- | --- |
| `link` → `http://127.0.0.1:PORT/go/<id>?t=<nonce>` | [Y aller] + preuve de clic, page de consentement de Karim | oui, traité en Rust **[code]** | oui **[code]** |
| `copy` | [Copier] | oui, natif **[code]** | oui **[code]** |
| 👍/👎 → `GET /feedback` | utile / pas utile, escalade | **[à vérifier]** | **oui [mesuré]** : derrière le menu « … » → Feedback |
| `api` → `POST :3030/connections/n8n/proxy` (relais webhook vers le daemon) | clic silencieux | **non [mesuré, 17/10]** : le clic n'arrive pas (attendu, `native_actions.rs:1131`) | **oui [mesuré]** |

- `api` ne vise que `:3030` (`lib/notifications/actions.ts:306`) → pas d'appel direct au daemon. Le relais webhook ne valide que `http(s)` (`connections_api.rs`, `webhook_proxy`) : il marche vers `127.0.0.1`.
- **Décision (17/10)** : boutons `api` + relais = voie principale, pas de `link`. Sur Mac, correctif Screenpipe : [screenpipe-patch/](screenpipe-patch/) (bouton `api` traité en Rust, même règle de cible). Relais isolé dans une **instance** dédiée (`PUT /connections/n8n/instances/friction-assist`, appel `…/proxy?instance=friction-assist`) : aucun n8n existant n'est touché.
- **Relais, mesuré sous Windows (17/10)** : connexion n8n avec `webhook_url: http://127.0.0.1:8787/hook` (`POST /connections/n8n {"credentials":{...}}`), puis clic sur un bouton `api` → corps JSON reçu tel quel par le daemon dans WSL (réseau `mirrored`), 24 ms en appel direct. En-têtes transmis : `content-type`, `content-length`, `accept`, `host` ; **pas d'`Authorization`**.
- **`/feedback`, mesuré sous Windows** : un 👍 donne `{"target":{"kind":"notification","id":"<id de la notif>"},"rating":"up","producer_ref":"pipe:friction-assist"}`, lisible par `GET /feedback?kind=notification&target_id=<id>`. Le commentaire n'est accepté qu'avec `down` (`ai_feedback.rs:261`), non testé. Sous Windows, le bouton Feedback est dans le menu « … » : peu visible, à dire à l'utilisateur ou à doubler par nos propres boutons.
- **Panneau Windows vide [mesuré]** : après une relance de l'enregistrement, `/notify` répond « Notification sent successfully », le journal dit `outcome=shown_on_panel`, la fenêtre de 340 × 380 est visible et au premier plan… mais rien n'est dessiné. Relancer toute l'app répare. **Un 200 de `/notify` ne prouve pas l'affichage** : vérifier à l'œil avant chaque démo. App 2.7.109.
- `/notify` est ouvert à tout process : chaque lien et chaque appel relayé porte un **nonce par épisode**, vérifié par le daemon.
- Toujours lire `message` de `/notify` (pause, doublon < 90 s, pipe muet).

## 7. Données et vie privée (« comme Screenpipe »)

- IA cloud = préréglage choisi par l'utilisateur, verrouillable par l'admin (Teams, « managed AI presets »). Opt-in, comme leur VISION (« local-first, unless the user explicitly opts in »).
- Envoi minimal : l'épisode, jamais l'historique.
- Lecture du texte via `/search?filter_pii=1` avant le modèle ; `/v1/chat/completions` ne filtre rien lui-même. **Bloquant [à vérifier]** : `filter_pii` ne filtre rien sur notre install (19 ms, noms en clair). À activer dans Réglages → Confidentialité, ou à demander à Ezra.
- Messages clients lisibles ; valeurs client jamais dans une signature ni une solution (remplacées par des exemples fictifs, cf. `share-team-knowledge.mdx`).
- Données réelles collectées : `bench/real/`, ignoré par git.

## 8. Ce qu'on propose à Screenpipe

1. **Écriture par les membres** dans la mémoire d'équipe (aujourd'hui : push admin seulement), + routes de l'API locale pour lire/écrire → remplace Supabase.
2. **Bouton `callback`** : POST vers un port local **sans** la clé, traité en Rust (marche sur Mac). Ou un événement `notification_action` sur `/ws/events`.

## 9. Risques et tests avant de construire

- [ ] **Squelette de bout en bout** (détection réelle → solution en dur → `/notify`) sur Windows **et** Mac. Rien n'a encore tourné en chaîne.
- [ ] `filter_pii` actif et latence réelle.
- [ ] Précision sur de **vrais** épisodes (`scripts/collect-episodes.ts` → étiquetage → `bench/`).
- [x] Relais webhook + bouton `api` sous Windows ; `GET /feedback` après un 👍 sous Windows.
- [x] Bouton `api` sur Mac : **ne passe pas** (17/10). Confirme le choix : `link` = voie principale, relais = bonus Windows.
- [ ] `link` / `copy` / 👍👎 sur Mac ; commentaire avec 👎 ; `link` et `copy` sous Windows.
- [ ] Panneau Windows qui reste vide après une relance de l'enregistrement : reproduire, puis le signaler à Ezra.
- [ ] Live View (`GET /live-views/schema`, test 6).
- [ ] CPU du daemon (< 20 %, règle Screenpipe) et quota IA du compte Business.
- [ ] Offre gratuite Supabase (limites, mise en pause).

## 10. Décisions prises

- Partage entre collègues : cœur du produit (track « Make it work for a team ») ; absent de Screenpipe.
- Debounce sur la frappe : oui. Messages clients : lisibles. IA cloud : oui, « comme Screenpipe » (§7).
- Un correctif minimal de Screenpipe (boutons `api` sur Mac), proposé upstream ; le reste sans modification de Screenpipe. Relais webhook = voie principale des clics.
