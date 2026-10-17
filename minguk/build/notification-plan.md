# Plan de construction : la couche notification

> **Statut :** étapes 0 à 6 construites et testées sur Mac le 17 octobre (59 tests automatiques, deux répétitions complètes). Reste à tester sous Windows (WSL) : tests T1 à T8. Fiche de démo : [demo-runbook.md](demo-runbook.md).
> **Périmètre :** **uniquement la notification** : les trois aides (🧭 chemin, 💬 Slack, 📘 règle maison), le suivi de livraison, les retours 👍/👎 et le lien [Y aller].
> **Documents de référence :** [notification.md](../../notification.md) (le design), [docs/notification-bouton-api.md](../../docs/notification-bouton-api.md) (pourquoi pas de bouton `api`), [UserInteraction.md](../../UserInteraction.md) (les autres canaux, hors périmètre ici).

## 1. Objectif

Livrer un module TypeScript sous Bun qui, à partir d'un **épisode de friction** déjà qualifié, envoie la bonne notification d'aide et sait ensuite ce qu'elle est devenue :

- **masquée** (et pourquoi) ;
- **affichée** ;
- **vue** ;
- **fermée** ;
- **utilisée** (clic sur [Y aller]) ;
- **utile ou pas utile** (👍/👎).

Il marche à l'identique sur Mac et sous Windows (code dans WSL).

### Ce qui est hors périmètre

| Hors périmètre | Pourquoi |
| --- | --- |
| La détection des frictions (lecture de `/search`) | un autre module : il appelle le nôtre via `requestHelp()` |
| Le serveur d'équipe, les signatures | un autre module : on expose seulement les résultats (utile / pas utile) |
| L'extension Chrome, les mémoires, la Live View | voir [UserInteraction.md](../../UserInteraction.md) |
| Le bouton `api` | refusé par Screenpipe vers notre serveur |

Pour tester sans la détection, une commande `bun run demo` déclenche les trois aides à la main.

## 2. Ce qu'on sait déjà (contraintes vérifiées dans le code)

| Contrainte | Conséquence pour le code |
| --- | --- |
| `POST 127.0.0.1:11435/notify` sans jeton ; la réponse est toujours `success: true` | lire `message` pour connaître le vrai résultat |
| Messages possibles : `Notification sent successfully`, `notifications paused`, `duplicate notification suppressed`, `pipe notifications disabled`, `pipe muted`, `Notification already sent` | un analyseur de réponse avec ces 6 cas + « inconnu » |
| Filtre de répétition : même type + `pipe_name` + titre + corps sous 90 s | un `id` unique par épisode, et un titre ou un corps qui varie |
| Le markdown sur Mac : seulement gras, `code`, liens, retours à la ligne | un contrôle des modèles : pas de `#`, `-`, `>`, `1.` en début de ligne |
| Le panneau Mac fait 360 px | titre ≤ 45 caractères, corps ≤ 3 lignes |
| `copy` est natif (`value`) ; `link` ouvre le navigateur ; `api` est refusé hors port 3030 | seulement `link`, `copy`, `deeplink`, `chat` |
| Les 👍/👎 n'apparaissent que si `pipe_name` est rempli | `pipe_name: "friction-assist"` partout |
| `priority: low` = toast seul, absent de la cloche | 🧭 en `low`, 💬 en `normal`, 📘 en `high` |
| `timeout` en millisecondes ; `0` = reste affiché | 🧭 30 000, 💬 60 000, 📘 0 |
| L'historique : `GET 11435/notifications` (100 au plus, avec `read`) | « vue » = `read: true` ; « fermée » = absente de la liste |
| Les retours : `GET 3030/feedback?kind=notification&producer=pipe:friction-assist` (jeton requis) ; un commentaire n'existe qu'avec 👎 | relier `target.id` à notre `id` de notification |

## 3. Architecture

```
détection (autre module)
   │  requestHelp(episode)
   ▼
┌──────────────────────── src/notify/ ────────────────────────┐
│ scheduler ── choisit le moment (une à la fois, plafond/jour) │
│    │                                                          │
│ templates ── construit le JSON 🧭 / 💬 / 📘 et le vérifie     │
│    │                                                          │
│ client ───── POST /notify, analyse `message`                  │
│    │                                                          │
│ store ────── état des épisodes (bun:sqlite)                   │
│    ▲                                                          │
│ redirect ─── serveur local /go/:id → note le clic → 302       │
│ tracker ──── lit /notifications et /feedback toutes les 5 s   │
│ escalate ─── sur 👎 : la 2e notification (le canal Slack)      │
└───────────────────────────────────────────────────────────────┘
   │  onOutcome(episodeId, résultat)
   ▼
serveur d'équipe (autre module) : « utile / pas utile pour cette étape »
```

### Arborescence

```
package.json            scripts : dev, demo, test, check-env
tsconfig.json
src/
	config.ts           lecture de process.env, valeurs par défaut
	notify/
		types.ts        Episode, HelpKind, NotifyPayload, DeliveryOutcome…
		templates.ts    les 3 modèles + le contrôle des contraintes Mac
		client.ts       POST /notify et analyse de la réponse
		scheduler.ts    rythme : une à la fois, plafond, variation du titre
		store.ts        bun:sqlite : épisodes, événements
		redirect.ts     Bun.serve : /go/:id et /health
		tracker.ts      lecture de /notifications et /feedback
		escalate.ts     la 2e notification après un 👎
		index.ts        requestHelp(), onOutcome(), start()
	cli/
		demo.ts         déclenche 🧭, 💬 et 📘 avec Jean Dupont
		check-env.ts    vérifie Screenpipe, le jeton, le port
tests/
	templates.test.ts
	client.test.ts
	scheduler.test.ts
	tracker.test.ts
```

### Configuration (variables d'environnement)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `SCREENPIPE_URL` | `http://127.0.0.1:3030` | API (`/feedback`) |
| `SCREENPIPE_NOTIFY_URL` | `http://127.0.0.1:11435` | `/notify`, `/notifications` |
| `SCREENPIPE_API_KEY` | — (obligatoire) | jeton pour `/feedback`, **jamais affiché** |
| `FRICTION_PORT` | `4517` | notre serveur de redirection (éviter 3030 et 11435) |
| `FRICTION_DB` | `~/.local/share/friction/notify.sqlite` | l'état local |
| `FRICTION_DAILY_CAP` | `8` | le plafond d'aides par jour |

Les trois premières variables viennent déjà de `scripts/screenpipe-env.sh`.

## 4. Les contrats (TypeScript)

```ts
export type HelpKind = "path" | "slack" | "rule";

export interface Episode {
	id: string;                  // unique, sert aussi d'id de notification
	kind: HelpKind;
	stage: string;               // étape générique, ex. "offre-client"
	createdAt: number;
	customerWaiting: boolean;    // un client attend dans Crisp → priorité haute
	help: PathHelp | SlackHelp | RuleHelp;
}

export interface PathHelp {
	destination: string;         // "Produits du contrat signé"
	breadcrumb: string[];        // ["Contact", "Transactions", "Contrat signé", "Produits"]
	url: string | null;          // URL résolue en local ; null → [Ouvrir la fiche]
	fallbackUrl: string;         // la fiche contact
	teamCount: number;           // « chemin pris par l'équipe N fois »
}

export interface SlackHelp {
	channel: string;             // "#bugs"
	channelUrl: string;          // slack://channel?team=…&id=…
	message: string;             // rempli en local, jamais partagé
	reason: string;              // "Bug client"
}

export interface RuleHelp {
	title: string;               // "Geste commercial : 1 mois offert max"
	condition: string;           // "Premium seulement."
	exception?: string;          // "Sinon : un bon de 10 %."
	action: string;              // "Note `geste commercial` dans HubSpot."
	confirmedAt: number;         // dernier 👍
	recordUrl: string;           // la fiche à vérifier
	note: string;                // texte de [Copier la note]
	reply: string;               // texte de [Réponse client], rempli en local
}

export type DeliveryOutcome =
	| "shown" | "paused" | "duplicate" | "pipe_disabled" | "muted"
	| "already_sent" | "unreachable" | "unknown";

export type EpisodeStatus =
	| "queued" | "suppressed" | "shown" | "seen" | "dismissed"
	| "clicked" | "helpful" | "unhelpful" | "unconfirmed";

export function requestHelp(episode: Episode): Promise<void>;
export function onOutcome(cb: (episodeId: string, status: EpisodeStatus, comment?: string) => void): void;
```

> **Vie privée :** les champs `message`, `reply`, `url` et `recordUrl` peuvent contenir des données client. Ils restent dans `store` sur la machine. `onOutcome` ne transmet que l'`id`, le statut et l'étape : le commentaire de 👎 reste local.

## 5. Les étapes de construction

Les estimations tiennent compte du test sur les deux systèmes.

### Étape 0 : le socle (1 h)

- `bun init`, `tsconfig`, indentation par tabulations, `bun test`.
- `config.ts` : lit `process.env` et refuse de démarrer sans `SCREENPIPE_API_KEY`, sans afficher sa valeur.
- `cli/check-env.ts` vérifie :
  - `/health` ;
  - `/search?limit=1` répond 200 avec le jeton ;
  - `POST /notify` répond ;
  - le port `FRICTION_PORT` est libre.

**Terminé quand :** `bun run check-env` passe au vert sur Mac **et** sous WSL.

### Étape 1 : les modèles et le client (3 h)

- `templates.ts` : construit le JSON des trois aides, comme décrit dans [notification.md](../../notification.md), section 4.

| Aide | Titre | Boutons | Priorité / durée |
| --- | --- | --- | --- |
| 🧭 | « 🧭 {destination} : 1 clic au lieu de {n} » | [Y aller], ou [Ouvrir la fiche] si `url` est null | `low` / 30 s |
| 💬 | « 💬 {reason} → {channel}, avec le modèle » | [1. Copier le message] (`copy`), [2. Ouvrir {channel}] (`link`) | `normal` / 60 s |
| 📘 | « 📘 {title} » | [Y aller], [Copier la note], [Réponse client] | `high` si un client attend, sinon `normal` / 0 |

- **Le contrôle des contraintes** (`lintPayload`) : titre ≤ 45 caractères, corps ≤ 3 lignes, aucune ligne commençant par `#`, `-`, `*`, `>` ou un chiffre suivi d'un point, au plus 3 boutons, `pipe_name` présent, aucun bouton `api`. Un modèle qui viole une règle ne part pas.
- `client.ts` : `sendNotification(payload) → DeliveryOutcome`, avec la correspondance exacte des 6 messages. En cas de réseau coupé : `unreachable`.

**Terminé quand :** `bun run demo` affiche les trois notifications sur Mac et sous Windows, et les tests de `templates` et de `client` passent.

### Étape 2 : le rythme (2 h)

- `scheduler.ts` :
  - **une notification à la fois :** la suivante attend que la précédente soit utilisée ou fermée, ou 60 s ;
  - **un épisode = une notification ;** un épisode déjà servi est ignoré ;
  - **un plafond quotidien** (`FRICTION_DAILY_CAP`) ;
  - **sur `paused` :** pas de nouvel essai avant 10 minutes, et l'épisode passe en `suppressed` ;
  - **sur `duplicate` :** le corps reçoit un discret suffixe d'heure (« · 11 h 02 »), et un seul nouvel essai.
- `store.ts` (bun:sqlite) : deux tables. `episodes` (id, kind, stage, statut, horodatages, données locales) et `events` (id, épisode, type, horodatage).

**Terminé quand :** envoyer 5 épisodes d'un coup en produit un seul à l'écran, puis les suivants un par un, ce que confirment les tests du `scheduler`.

### Étape 3 : [Y aller] et le serveur de redirection (2 h)

- `redirect.ts` (`Bun.serve`, sur `127.0.0.1` seulement) :
  - `GET /go/:episodeId` → note l'événement `clicked`, puis redirige (`302`) vers l'URL **enregistrée** pour cet épisode ;
  - un épisode inconnu → une petite page « aide expirée », **jamais** une redirection vers une adresse passée en paramètre (pas de redirection ouverte) ;
  - `GET /health` pour `check-env`.
- Les modèles utilisent `http://127.0.0.1:{FRICTION_PORT}/go/{id}` comme URL de [Y aller] et d'[Ouvrir la fiche].

**Terminé quand :** un clic sur [Y aller] ouvre HubSpot et l'épisode passe en `clicked`, sur Mac et sous Windows (navigateur Windows → serveur dans WSL, en réseau `mirrored`).

### Étape 4 : le suivi (3 h)

- `tracker.ts`, toutes les 5 s, seulement s'il reste des épisodes ouverts :
  - **`GET 11435/notifications`** :
    - `read: true` → `seen` ;
    - une notification absente alors qu'elle était présente → `dismissed`.

    Le toast `low` (🧭) n'est jamais dans la cloche : seul le clic le suit.
  - **`GET 3030/feedback?kind=notification&producer=pipe:friction-assist`** :
    - `rating: up` → `helpful` ;
    - `rating: down` → `unhelpful`, avec le commentaire éventuel, gardé en local.
  - Sans aucun signal après 30 minutes : `unconfirmed`.
- `onOutcome` prévient l'extérieur à chaque changement de statut.

**Terminé quand :** un 👍, un 👎 avec commentaire, une ouverture dans la cloche et une fermeture produisent chacun le bon statut, sur Mac.

### Étape 5 : l'escalade sur 👎 (1 h 30)

- `escalate.ts` : sur `unhelpful` pour une 📘 ou une 🧭, si une `SlackHelp` de repli existe pour l'étape → une 💬 « Pas trouvé ? Demande dans #… », avec le modèle à copier.
- Une seule escalade par épisode.

**Terminé quand :** un 👎 sur la 📘 fait apparaître la 💬 de repli, une seule fois.

### Étape 6 : la démo (2 h)

- `cli/demo.ts` déroule le parcours de Jean Dupont (un client fictif en `@example.com`, voir [docs/crisp.md](../../docs/crisp.md)) :
  - 💬 bug → `#bugs` ;
  - 🧭 offre → produits ;
  - 📘 dédommagement → la règle.
- Une option `--step` pour les déclencher une à une pendant la présentation.
- La vérification avant la démo est intégrée à `check-env` : notifications en pause ? Le `message` du dernier envoi ?

**Terminé quand :** deux répétitions complètes de suite, sans accroc, sur la machine de démo.

### Récapitulatif

| Étape | Durée | Dépend de | Peut se faire en parallèle avec |
| --- | --- | --- | --- |
| 0. Socle | 1 h | — | — |
| 1. Modèles + client | 3 h | 0 | 3 |
| 2. Rythme | 2 h | 1 | 3, 4 |
| 3. Redirection | 2 h | 0 | 1, 2 |
| 4. Suivi | 3 h | 1 | 2, 3 |
| 5. Escalade | 1 h 30 | 4 | — |
| 6. Démo | 2 h | toutes | — |
| **Total** | **≈ 14 h 30** | | **≈ 8 h à deux personnes** |

## 6. Les tests à faire avant de coder (30 min, sur Mac puis Windows)

À faire avec de vraies notifications ; les résultats décident de détails des modèles.

| # | Test | Ce qui en dépend |
| --- | --- | --- |
| T1 | 3 boutons tiennent-ils sur une ligne en 360 px ? | la 📘 garde [Réponse client], ou la déplace |
| T2 | une 2e notification arrive pendant que la 1re est affichée : remplacée ou empilée ? | le délai minimal du `scheduler` |
| T3 | `copy` avec `value` sous Windows (panneau web) | [Copier] sous Windows |
| T4 | la fenêtre web sous Windows vole-t-elle le focus ? | le moment d'envoi pendant que Léa tape |
| T5 | les 👍/👎 apparaissent-ils avec `pipe_name: "friction-assist"` sans pipe installé de ce nom ? | tout le suivi « utile » |
| T6 | un `link` vers `slack://channel?…` ouvre-t-il l'appli Slack ? | [Ouvrir #bugs] ; sinon l'URL web `app.slack.com` |
| T7 | un `link` vers `http://127.0.0.1:4517/go/…` depuis Windows atteint-il un serveur dans WSL ? | [Y aller] sous Windows |
| T8 | une notification fermée disparaît-elle bien de `/notifications` ? | le statut `dismissed` |

## 7. Les tests automatiques

- **`templates.test.ts` :**
  - chaque modèle passe `lintPayload` ;
  - un titre trop long, une liste markdown ou un bouton `api` sont refusés ;
  - aucun champ `value` ou `url` n'est vide.
- **`client.test.ts` :** les 6 messages de Screenpipe donnent le bon `DeliveryOutcome`, contre un faux serveur (`Bun.serve`).
- **`scheduler.test.ts` :** une notification à la fois, le plafond, l'attente après `paused`, le nouvel essai après `duplicate`.
- **`tracker.test.ts` :** à partir de réponses enregistrées de `/notifications` et `/feedback`, les bons statuts. Ces réponses sont enregistrées sans jeton ni donnée client.

## 8. Les règles de code

- TypeScript sous Bun, aucun code natif, aucune modification de Screenpipe.
- Indentation par tabulations.
- La configuration se lit via `process.env`, jamais de valeur en dur.
- **Le jeton n'apparaît jamais** dans les logs, les erreurs ou les tests.
- **Les logs ne contiennent ni titre ni corps de notification** (ils peuvent contenir des données client) : seulement l'`id`, le type, le statut.
- Le serveur de redirection n'écoute que sur `127.0.0.1`.

## 9. Les risques

| Risque | Parade |
| --- | --- |
| Les notifications sont en pause sur la machine de démo | `check-env` le détecte à partir du `message` |
| Le rendu ou le focus diffèrent sous Windows | T3, T4 ; le contrôle des modèles garde un markdown commun |
| Le filtre de 90 s masque une répétition pendant les essais | l'`id` unique et le suffixe d'heure (étape 2) |
| Les 👍/👎 n'apparaissent pas (T5) | repli : une 2e courte notification avec [Utile] / [Pas utile] en `link` vers `/go/…?r=up` |
| `slack://` ne s'ouvre pas (T6) | l'URL web `app.slack.com/client/T…/C…` |
| Les URL HubSpot changent | elles sont résolues en local à partir des captures ; sinon, [Ouvrir la fiche] et le fil d'Ariane |

## 10. Les questions pour le groupe

1. Qui prend quelles étapes ? Proposition : une personne sur 1, 2 et 5, une autre sur 3 et 4, puis la démo ensemble.
2. Le port `4517` convient-il à tout le monde (aucun conflit local) ?
3. Le texte des règles de démo (la 📘, le modèle `#bugs`) : qui l'écrit, pour qu'il sonne juste ?
4. On fait les tests T1 à T8 ensemble, une personne sur Mac et une sous Windows ?
