# Proposition : comment Screenpipe parle à son utilisateur, et ce qu'on en fait

> **Statut :** idée proposée au groupe, à discuter. Rien n'est décidé.
> **Sources :** le code de Screenpipe v2.7.114 (`../screenpipe`, lu le 16 octobre 2026) et des tests sur Mac. Ce qui n'a pas été testé est marqué « à tester ».
> **Documents liés :** [VISION.md](VISION.md), [UseCase.md](UseCase.md), [notification.md](notification.md), [docs/notification-bouton-api.md](docs/notification-bouton-api.md).

## En bref

- **La notification n'est pas le seul canal.** C'est le seul qui atteint la personne **pendant qu'elle travaille dans une autre appli**, sans fork. Screenpipe offre aussi :
  - une extension Chrome capable d'agir **dans la page web** ;
  - une mémoire que son IA consulte ;
  - un chat, des Live Views, des annonces dans l'appli, et un serveur MCP pour les agents externes.
- **Deux canaux peuvent avoir plus d'impact que la notification :**
  1. **l'aide dans la page** (via l'extension) : la règle et le bouton [Insérer la réponse] apparaissent directement dans Crisp, sans saut d'appli ni copier-coller ;
  2. **les règles de l'équipe dans la mémoire de Screenpipe** : son propre chat répond avec la règle de l'équipe. C'est le thème du jury (*Build Agents That Remember*).
- **La proposition :** donner un rôle à chaque canal.

| Rôle | Canal |
| --- | --- |
| Déclencher | la notification |
| Agir | l'aide dans la page, sinon les boutons de la notification |
| Mémoriser | les mémoires + les 👍/👎 |
| Réparer le process | la Live View + un pipe |

## 1. La carte des canaux

| Canal | Où l'utilisateur le voit | Utilisable par notre code, sans fork ? | Vérifié |
| --- | --- | --- | --- |
| **Notification + cloche** | en haut à droite, par-dessus toutes les applis | oui : `POST 11435/notify` | testé sur Mac |
| **Extension Chrome** | **dans la page web** (Crisp, HubSpot, Slack web) | oui : `POST 3030/browser/eval` exécute du JavaScript dans un onglet | code lu ; extension non connectée sur le Mac de test |
| **Mémoires** | dans les réponses de l'IA de Screenpipe (chat, agents, pipes) | oui : `POST/GET/PUT/DELETE 3030/memories` | code lu |
| **Chat** | la fenêtre de chat de Screenpipe | oui : un bouton `chat` (une demande + du contexte, sans envoi automatique) | code lu |
| **Live View** | un tableau de bord dans l'appli Screenpipe | oui : `/live-views` + un pipe | VISION.md (14 oct.) |
| **Annonces** | une fenêtre modale, un bandeau, une carte, une bulle ou un panneau latéral, **dans la fenêtre de Screenpipe** | oui : `/notify` avec un champ `surface` | code lu |
| **Serveur MCP** | dans n'importe quel agent IA (Claude, Cursor…) | oui : `packages/screenpipe-mcp` | utilisé dans cette session |
| **Pipes** | invisibles : ce sont des agents IA planifiés ou déclenchés | oui : `pipe.md` | code lu |
| **Capsule de réunion** | une capsule native pendant les appels | non : réservée aux alertes de réunion | code lu |
| **Timeline, navigateur intégré, Live Text, menu de la barre** | dans l'appli | non, ou sans intérêt pour nous | code lu |

## 2. Chaque canal en détail

### 2.1 La notification et la cloche

- **Ce que c'est :**
  - sur Mac, un panneau natif SwiftUI de 360 px qui ne vole pas le focus ;
  - sous Windows, une petite fenêtre web ;
  - la cloche garde l'historique et les boutons.
- **Ce qu'on contrôle :** le titre, un corps en markdown minimal sur Mac (gras, `code`, liens), jusqu'à 5 boutons, la priorité, la durée.
- **Les boutons utiles :**
  - `link` : [Y aller] ;
  - `copy` : [Copier] ;
  - `chat` : [Demander à l'agent] ;
  - les 👍/👎 sont ajoutés automatiquement si `pipe_name` est rempli.
- **La limite majeure :** un bouton `api` ne peut pas appeler notre serveur (voir [docs/notification-bouton-api.md](docs/notification-bouton-api.md)).
- **Le détail :** voir [notification.md](notification.md).

### 2.2 L'extension Chrome de Screenpipe

- **Ce que c'est :** l'extension officielle (`packages/browser-extension`) se connecte au moteur. L'API peut alors **exécuter du JavaScript dans un onglet**, choisi par un morceau d'URL :

```
POST 3030/browser/eval
{ "code": "…", "url": "crisp.chat", "timeout_secs": 5 }
```

- **Ce que ça permet :**
  - **lire** la page, même en arrière-plan : le dernier message Crisp dès son arrivée, ou le lien de la transaction signée sur une fiche HubSpot ;
  - **afficher** un élément dans la page : un encadré avec la règle, un champ mis en évidence ;
  - **pré-remplir** un champ (la réponse Crisp, le message Slack), **sans jamais l'envoyer**.
- **Les limites :**
  - Chrome ou Chromium seulement, et l'extension doit être installée sur chaque machine ;
  - la structure des pages peut changer sans prévenir ;
  - c'est un accès puissant : on le limite aux domaines de travail (crisp.chat, hubspot.com, slack.com).
- **À tester :** l'insertion d'un élément et le remplissage d'un champ par `/browser/eval`.

### 2.3 Les mémoires

- **Ce que c'est :** une base locale de faits durables que l'IA de Screenpipe consulte. Chaque mémoire a :
  - un contenu ;
  - une source ;
  - des étiquettes ;
  - une importance.
- **Ce que ça permet :** écrire chaque règle confirmée de l'équipe dans les mémoires de chaque membre. Le chat de Screenpipe, les agents MCP et les pipes répondent alors avec **la règle de l'équipe**.
- **Une piste à vérifier :** le code contient un format de **mémoire d'équipe** (`crates/screenpipe-team-memory`), un fichier par mémoire, synchronisable. S'il est utilisable, il pourrait porter notre partage d'équipe dans le format natif de Screenpipe.

### 2.4 Le chat

- **Ce que c'est :** la fenêtre de chat IA de Screenpipe. Un bouton de notification `chat` l'ouvre avec une demande et du contexte. Avec `auto_send: false`, rien n'est envoyé avant que l'utilisateur relise.
- **Ce que ça permet :** [Demander à l'agent] depuis une aide, avec l'étape et la règle en contexte. Combiné aux mémoires, l'agent connaît les règles de l'équipe.

### 2.5 La Live View

- **Ce que c'est :** un tableau de bord dans l'appli Screenpipe, construit à partir de blocs (`GET /live-views/schema`) et alimenté par un pipe.
- **Ce que ça permet :**
  - la carte des détours par étape (étape 6 de la boucle) ;
  - le détail d'une règle ;
  - la demande de correction de process.

### 2.6 Les annonces

- **Ce que c'est :** `/notify` avec un champ `surface` (`modal`, `banner`, `card`, `bubble`, `sidebar`). Elles peuvent avoir un bouton d'action et un petit sondage à choix. Elles s'affichent **dans les fenêtres de Screenpipe**, pas par-dessus les autres applis.
- **Ce que ça permet :**
  - un récapitulatif hebdomadaire (« 3 frictions de l'équipe réglées cette semaine ») ;
  - un sondage d'une question à celui qui a la solution.

  Pas pour l'aide en direct.

### 2.7 Le serveur MCP

- **Ce que c'est :** les outils de Screenpipe exposés aux agents IA externes (recherche, notifications, workflows…).
- **Ce que ça permet :** la mémoire de l'équipe devient accessible aux agents que l'équipe utilise déjà. C'est pour la feuille de route.

### 2.8 Ce qui revient vers nous (les signaux de l'utilisateur)

| Signal | Canal | Comment on le lit |
| --- | --- | --- |
| notification affichée ou masquée | notification | le champ `message` de la réponse de `/notify` |
| vue (dépliée) ou fermée | cloche | `GET 11435/notifications` (`read`, ou absente de la liste) |
| clic sur [Y aller] | notification | notre lien de redirection (`/go/<épisode>`) |
| utile / pas utile, et une correction | notification | `GET 3030/feedback` (le commentaire n'est accepté qu'avec 👎) |
| texte inséré dans la page | extension | notre script, au moment du clic sur [Insérer] |
| événements du moteur | bus | `ws://127.0.0.1:3030/ws/events` (à tester pendant un vrai travail) |

## 3. Ce qu'on améliore, du point de vue de notre idée

### 3.1 Un rôle par canal

| Rôle | Canal | Pourquoi |
| --- | --- | --- |
| **Déclencher** : « il y a une aide » | notification courte | le seul canal visible par-dessus toutes les applis |
| **Agir** : faire en un clic | aide dans la page (extension) ; sinon [Y aller] et [Copier] | supprime le saut d'appli et le copier-coller |
| **Mémoriser** : l'équipe se souvient | mémoires + 👍/👎 | l'IA de Screenpipe connaît les règles, et une règle contestée se met à jour |
| **Approfondir** : demander plus | chat avec contexte | pour les cas que la règle ne couvre pas |
| **Réparer** : le process change | Live View + pipe | étapes 6 et 7 de la boucle |

### 3.2 Les trois aides retenues, canal par canal

| Aide | Notification (partout) | Dans la page (si l'extension marche) | Mémoire |
| --- | --- | --- | --- |
| 🧭 **Le chemin à plusieurs niveaux** (9 h 20) | « 1 clic au lieu de 4 », le fil d'Ariane, [Y aller] | la carte « Transactions » mise en évidence dans HubSpot, ou le lien du contrat signé lu sur la page | « Offre d'un client : contact › transactions › contrat signé › produits » |
| 💬 **Slack + le message** (9 h 40, 15 h 30) | « Bug client → #bugs », [1. Copier le message] [2. Ouvrir #bugs] | le modèle pré-rempli dans le champ de message de Slack web | « Un bug client se signale dans #bugs, avec le modèle client · offre · symptôme » |
| 📘 **La règle maison** (11 h) | la règle, l'exception, la fraîcheur ; [Y aller] [Copier la note] [Réponse client] | un encadré au-dessus du champ de réponse Crisp, avec [Insérer la réponse] | « Geste commercial : 1 mois offert max, premium seulement » |

### 3.3 Les deux idées à fort impact

**1. L'aide dans la page (extension Chrome)**

- **L'impact :** l'aide est là où se trouve la friction. Pour les trois aides, le nombre de clics tombe à un.
- **Pourquoi c'est permis :**
  - c'est l'extension **officielle**, via l'API, donc sans fork ;
  - VISION.md la garde « en réserve » (« une aide injectée dans les applis web ») ;
  - ce qui a été écarté, c'est de modifier **l'overlay** de Screenpipe, pas ceci.
- **Les règles :**
  - jamais d'envoi automatique : Léa clique toujours « envoyer » ;
  - seulement les domaines de travail ;
  - seulement au moment d'une friction, jamais une autocomplétion permanente (« Tab universel » est écarté).

**2. Les règles de l'équipe dans la mémoire de Screenpipe**

- **L'impact :**
  - **le thème du jury :** on fait se souvenir *leur* agent, à l'échelle de l'équipe ;
  - **le critère intégration (30 %) :** une surface de plus, nourrie nativement ;
  - **le coût :** faible, quelques appels à `/memories`.
- **Les règles :**
  - seule la règle générique entre en mémoire, jamais un client ni le nom de celui qui a demandé ;
  - une règle contestée (👎) est marquée comme à revoir.

## 4. Le parcours de Léa, avec tous les canaux

Une seule conversation Crisp avec Jean Dupont, un client fictif en `@example.com` (voir [docs/crisp.md](docs/crisp.md)) :

| Moment | Ce que voit Léa | Canal |
| --- | --- | --- |
| Jean écrit « Ma page est en panne !! » | 💬 « Bug client → #bugs » ; dans Slack web, le modèle est déjà dans le champ | notification + extension |
| Léa cherche l'offre de Jean | 🧭 « 1 clic au lieu de 4 » ; dans HubSpot, la carte « Transactions » s'allume | notification + extension |
| Jean demande un dédommagement | 📘 la règle de l'équipe ; dans Crisp, [Insérer la réponse] au-dessus du champ | notification + extension |
| Léa veut un cas particulier | [Demander à l'agent] : le chat connaît la règle et propose une variante | chat + mémoires |
| Léa met 👍 | la règle est « confirmée aujourd'hui » pour le collègue suivant | retour + mémoires |
| La responsable ouvre Screenpipe le soir | la carte des détours et la demande « activer l'intégration Crisp → HubSpot » | Live View + pipe |

## 5. La vie privée, canal par canal

| Canal | Règle |
| --- | --- |
| Notification | ni nom du client dans la signature partagée, ni nom de celui qui a demandé |
| Extension | les domaines de travail seulement ; lecture des derniers messages uniquement ; aucun envoi automatique |
| Mémoires | la règle générique seulement, sans donnée client |
| Retours | le texte de correction reste sur la machine ; seul « utile / pas utile pour cette étape » remonte |
| Live View | des fourchettes, regroupées à la semaine, avec un seuil (VISION.md, *Vie privée*) |

## 6. Feuille de route

| Phase | Contenu | Dépend de |
| --- | --- | --- |
| **0. Tests** (tout de suite) | l'extension : insérer un élément et remplir un champ dans Crisp ; les mémoires : créer une règle et interroger le chat | — |
| **1. Socle** | la notification et ses 3 modèles (🧭 💬 📘), [Y aller] avec redirection, [Copier] | [notification.md](notification.md) |
| **2. Mémoire** | les règles confirmées écrites dans `/memories` ; 👍/👎 qui confirment ou contestent | phase 1 |
| **3. Dans la page** | l'encadré Crisp avec [Insérer la réponse], puis le modèle Slack, puis HubSpot | le test de la phase 0 |
| **4. Vue d'ensemble** | la Live View et le pipe de correction de process | VISION.md, plan |
| **Feuille de route (slide)** | la mémoire d'équipe native, le MCP, les annonces pour le récapitulatif | — |

Si le test de l'extension échoue, la phase 3 tombe et la notification garde le rôle « agir » avec [Y aller] et [Copier].

## 7. Questions

**Pour Louis et Ezra (Discord) :**

1. `/browser/eval` peut-il servir à afficher un élément dans une page et à remplir un champ ? Y a-t-il une restriction prévue ?
2. Le format de mémoire d'équipe (`screenpipe-team-memory`) est-il utilisable aujourd'hui pour partager entre plusieurs machines ?
3. Le chat de Screenpipe consulte-t-il toutes les mémoires, ou seulement celles d'une certaine source ou importance ?

**Pour le groupe :**

1. Valide-t-on la répartition des rôles (3.1) ?
2. L'aide dans la page : on la tente pour la démo, ou on la garde pour la slide ?
3. Les règles dans les mémoires de Screenpipe : d'accord pour que ce soit notre « mémoire d'équipe » visible ?
4. Qui fait les deux tests de la phase 0, et sur quelle machine ?
