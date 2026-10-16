# Proposition : des notifications à la hauteur de la boucle de la friction

> **Statut :** idée proposée au groupe, à discuter. Rien n'est décidé.
> Elle complète [VISION.md](VISION.md) (étape 5, « Aider en direct ») et [UseCase.md](UseCase.md) (la journée de Léa).
> Les faits techniques viennent du code de Screenpipe (v2.7.114, lu le 16 octobre) et de tests sur Mac.

## En bref

- **Le constat :** la notification de Screenpipe suffit pour **montrer** l'aide, pas pour **faire tourner la boucle**.
  - Son apparence est figée : nous n'écrivons que le texte et les boutons.
  - Un bouton ne peut pas appeler notre serveur.
- **La bonne nouvelle :** Screenpipe fournit déjà presque tout le reste :
  - un bouton « copier » ;
  - des pouces 👍/👎 avec un champ de correction ;
  - un historique lisible par API ;
  - un bus d'événements.
- **La proposition :** une notification d'aide courte et toujours construite pareil (la réponse, [Y aller], [Copier]). Notre serveur local la pilote, en ne s'appuyant que sur ce que Screenpipe expose.
- **Aucun fork, aucune modification de l'overlay.** On n'utilise que `/notify`, `/notifications`, `/feedback`, `/ws/events`, les Live Views et les pipes.

## 1. Comment marche la notification (vérifié dans le code)

### 1.1 Le trajet

```
notre serveur ── POST 127.0.0.1:11435/notify ──► appli Screenpipe (Rust, Tauri)
                                                  │  filtres : pause, silence, répétition, pipe muet
                                                  │  enregistrement dans la cloche (sauf priorité low)
                                                  ▼
                       Mac : panneau natif SwiftUI          Windows : petite fenêtre web (React)
                       notification_panel.swift             app/notification-panel/page.tsx
                                                  │
                                    clic sur un bouton → exécuté par l'appli
```

- **Sur Mac**, c'est un panneau natif :
  - 360 px de large, une hauteur qui s'adapte au contenu (le corps défile au-delà de 200 px) ;
  - en haut à droite de l'écran où se trouve la souris ;
  - il flotte au-dessus de tout et **ne vole jamais le focus**.
- **Sous Windows**, c'est une fenêtre web de 340 × 380 px sur l'écran principal. Elle s'affiche avec `window.show()`, qui peut prendre le focus (à tester).
- **Le minuteur** se met en pause quand la souris survole le panneau. `timeout: 0` le garde affiché jusqu'à ce qu'on le ferme.

### 1.2 Ce que nous contrôlons, et ce que nous ne contrôlons pas

| On contrôle (dans le JSON) | On ne contrôle pas |
| --- | --- |
| le titre | la taille, la position, les couleurs, la police |
| le corps : sur Mac, seulement **gras**, `code`, [liens] et les retours à la ligne. Windows rend tout le markdown | les titres, l'italique, les listes, les citations sur Mac (affichés en texte brut) |
| les boutons : le libellé, le type, `primary` (mis en avant) | ajouter une image, un champ de saisie, un composant |
| la durée (`timeout`, en ms), la priorité, l'`id` | l'animation, le comportement de fermeture |
| `pipe_name`, qui fait apparaître les 👍/👎 | la disposition des 👍/👎 |

Changer l'apparence voudrait dire modifier le Swift et la page React, puis recompiler Screenpipe : c'est un fork, donc exclu.

### 1.3 Les types de boutons

| Type | Au clic | Utile pour nous ? |
| --- | --- | --- |
| `link` | ouvre une URL dans le navigateur | **oui** : [Y aller] |
| `copy` | copie `value` dans le presse-papiers, en natif | **oui** : [Copier] |
| `deeplink` | ouvre un écran de Screenpipe (`screenpipe://…`) | oui : une Live View, la timeline |
| `chat` | ouvre le chat Screenpipe avec une demande | oui : [Demander à l'agent] |
| `pipe` | lance un pipe installé | plus tard |
| `source` | ouvre la surface d'origine | non |
| `dismiss` | ferme la notification | rarement |
| `api` | requête HTTP en arrière-plan, **seulement vers l'API de Screenpipe (port 3030)** | **non** : refusé vers notre serveur |

> **Pourquoi pas `api` :** Screenpipe joint la clé secrète de l'utilisateur à chaque appel `api`. Pour qu'elle ne fuie pas, l'appli refuse toute autre adresse (`lib/notifications/actions.ts:313`). VISION.md (lignes 148 et 156) prévoyait qu'un bouton appelle notre serveur : ce n'est pas possible de cette façon. Analyse complète et options : [docs/notification-bouton-api.md](docs/notification-bouton-api.md).

### 1.4 Les filtres, qui peuvent masquer une notification

| Filtre | Effet | Ce que répond `/notify` |
| --- | --- | --- |
| notifications coupées, pause, heures silencieuses | rien ne s'affiche | `"notifications paused"` |
| même type + `pipe_name` + titre + corps dans les 90 s | rien ne s'affiche | `"duplicate notification suppressed"` |
| notifications de pipes coupées, ou ce pipe rendu muet | rien ne s'affiche | `"pipe notifications disabled"` / `"pipe muted"` |
| même `id` qu'une notification déjà envoyée | rien ne change | `"Notification already sent"` |
| tout va bien | affichée | `"Notification sent successfully"` |

`success` vaut toujours `true` : **il faut lire `message`**. Le champ `id` sert à éviter les doublons. Il ne met pas à jour une notification déjà affichée.

## 2. Côté moteur : ce qui se passe après l'affichage

C'est là que l'interaction devient intéressante, pour Screenpipe comme pour nous.

| Brique | Ce qu'elle fait | Ce qu'on en tire |
| --- | --- | --- |
| **Historique** `GET 11435/notifications` | jusqu'à 100 notifications, avec `read` (dépliée dans la cloche) et les boutons. Une notification fermée disparaît de la liste | savoir si l'aide a été **vue** ou **écartée**, sans rien installer |
| **Retours** `GET/POST 3030/feedback` | 👍/👎 sur la notification, liés à son `id` et au producteur `pipe:<nom>`. Un commentaire (500 caractères max) n'est accepté qu'avec un 👎 | « ça m'a aidé / pas ça », et **un texte libre** quand ça n'a pas aidé |
| **Bus d'événements** `ws://127.0.0.1:3030/ws/events` | flux de tous les événements du moteur (réunions, captures…), et un client peut aussi **publier** un événement | réagir en direct sans interroger l'API en boucle. Branché sur Mac : aucun événement reçu en 15 s d'inactivité, à tester pendant un vrai travail |
| **Déclencheurs de pipes** | un pipe démarre sur un événement (`meeting_ended`, `pipe_completed:…`, `workflow_event`) | à vérifier : un événement publié par nous peut-il lancer un pipe ? |
| **Workflows** | catalogue des tâches récurrentes, avec leurs « goulots » (`waiting`, `switching`, `rework`, `handoff`) | notre vocabulaire de détours, et les URL de chaque étape pour [Y aller] (si le catalogue existe : plan payant) |

### Pourquoi ça compte pour Screenpipe

- **Ils investissent dans la qualité de l'IA proactive :**
  - des filtres anti-répétition ;
  - un plafond quotidien pour les suggestions de workflows ;
  - un format de retour commun à toutes leurs surfaces IA (`/feedback`) ;
  - des statistiques sur chaque clic dans la cloche.
- **Notre projet utilise exactement ces briques**, et ferme la boucle **à l'échelle de l'équipe** : un 👍 sur une aide rend la solution plus fiable pour le collègue suivant.
- **Le message pour le jury :** « nous ne contournons pas Screenpipe, nous branchons notre équipe sur leurs propres contrats ».

## 3. Ce qui manque encore pour notre cas d'usage

| Besoin (VISION / UseCase) | Limite | Notre réponse |
| --- | --- | --- |
| Savoir si un bouton a été cliqué | `api` refusé vers notre serveur ; pas d'événement « clic » exposé | lien de redirection pour [Y aller], 👍/👎 pour le reste (4.3, 4.4) |
| Copier en un clic | aucune | le bouton natif `copy` |
| Laisser celui qui a la solution la rédiger | pas de champ de saisie, sauf la correction après un 👎 | une page locale ouverte par un `link` (4.6) |
| Un affichage riche | markdown minimal sur Mac, taille figée | Live View pour le détail (4.8) |
| L'aide à côté du champ qui bloque | toast fixe ; overlay exclu | plus tard (VISION, « gardé en réserve ») |
| La même expérience sur Mac et Windows | deux rendus différents | n'écrire que gras, `code`, liens et lignes courtes |

## 4. Les propositions, UI et interaction

### 4.1 L'anatomie d'une notification d'aide

Toujours la même structure, pour que la personne la reconnaisse d'un coup d'œil :

```
┌──────────────────────────────────────────────┐
│ Geste commercial : 1 mois offert max          │  ← titre = la réponse
│                                              │
│ **Premium seulement.** Ajouter la note        │  ← 2 ou 3 lignes, gras et `code` seulement
│ `geste commercial` dans HubSpot.              │
│ Réglé 3 fois dans l'équipe.                   │  ← la preuve, sans aucun nom
│                                              │
│ [ Y aller ]  [ Copier la note ]               │  ← 2 boutons, le premier mis en avant
│                                      👍  👎   │  ← ajouté par Screenpipe (pipe_name)
└──────────────────────────────────────────────┘
```

- **Le titre donne la réponse**, jamais « Friction détectée ».
- **2 boutons au plus.** Le reste passe par les 👍/👎 et la cloche.
- **Pas de listes ni de titres markdown :** sur Mac, ils s'afficheraient en texte brut.
- **`pipe_name: "friction-assist"`** est obligatoire : sans lui, pas de 👍/👎.

### 4.2 [Y aller] : le chemin rapide

Dès qu'une demande arrive dans Crisp, le bouton ouvre **l'écran où agir**. Il n'explique pas le chemin, il le fait.

| Demande du client (UseCase) | [Y aller] ouvre | [Copier] copie |
| --- | --- | --- |
| « Ma page est en panne !! » (9 h 05) | la recherche HubSpot par domaine ou par téléphone | — |
| « Il paie quoi ? » (9 h 20) | la liste des produits de son contrat, au lieu de 4 clics | — |
| un bug à signaler (9 h 40) | le canal `#bugs` dans Slack (`slack://`) | le modèle de message |
| « Je veux un dédommagement » (11 h) | sa fiche HubSpot, pour vérifier l'offre premium | la note « geste commercial » |
| « Thomas m'a promis… » (14 h) | le champ « Conditions particulières » de la vente | — |
| « Combien pour 3 restaurants ? » (15 h 30) | la création de contact HubSpot | le stage « Lead » et la responsable, Sarah |

- **Le lien se construit en local :**
  - ce qui circule entre les machines, c'est le chemin générique (« contrat → produits ») ;
  - la machine de Léa le complète avec les identifiants qu'elle voit à l'écran ;
  - l'identifiant du client ne quitte jamais sa machine.
- **Le déclenchement :** la notification part à l'arrivée d'une demande d'un type sur lequel l'équipe a déjà bloqué. L'agent ne lit que ce message, pas l'historique.

### 4.3 Savoir qu'il a servi : le lien de redirection

- [Y aller] pointe vers `http://127.0.0.1:PORT/go/<épisode>`.
- Notre serveur note le clic, puis redirige le navigateur vers HubSpot ou Slack.
- Pour Léa, rien ne change : la bonne page s'ouvre. Pour nous, c'est la preuve qu'elle a cliqué.
- **Mac et Windows :** le navigateur atteint `127.0.0.1`, y compris un serveur dans WSL grâce au réseau `mirrored`.

### 4.4 Les 👍/👎 comme interrupteur d'escalade

- **👍 :** la solution gagne un point pour cette étape. Elle sera proposée en premier au collègue suivant.
- **👎, avec une correction facultative :**
  - notre serveur la lit dans `/feedback`, à partir de l'`id` de la notification ;
  - il envoie alors une deuxième notification : le bon canal Slack, et son modèle dans [Copier] ;
  - l'escalade se fait au grand jour, toujours sans nom.
- **Le texte de correction reste sur la machine.** Seul « non pertinent pour cette étape » remonte au serveur d'équipe.

### 4.5 Suivre la livraison, honnêtement

| Signal | D'où il vient | Ce qu'on en conclut |
| --- | --- | --- |
| `message` de `/notify` | la réponse immédiate | affichée, ou masquée (et pourquoi) |
| `read: true` dans `/notifications` | Léa l'a dépliée dans la cloche | vue |
| absente de `/notifications` | Léa l'a fermée | écartée |
| un clic sur la redirection | notre serveur | utilisée |
| 👍 / 👎 | `/feedback` | utile / pas utile |
| rien de tout ça | — | « non confirmée », **jamais** « ignorée » |

On ne déduit rien sur la personne : ces signaux servent à juger la solution, pas Léa.

### 4.6 Celui qui a la solution : une page locale pour consentir

- **Sa notification :** « Quelqu'un bloque sur *geste commercial*. Ta solution du 12/10 peut l'aider. »
  - Un seul bouton : [Voir et partager], de type `link`.
- **Ce bouton ouvre une petite page servie par notre serveur**, avec :
  - le texte de la solution, modifiable ;
  - [Partager], [Toujours pour ce cas], [Non].
- **Ce n'est pas urgent pour lui,** donc ouvrir un onglet est acceptable. La page offre le champ de saisie et les choix que la notification n'a pas.
- **[Toujours pour ce cas]** fait de la solution une solution pré-partagée, ce qui règle la fatigue pour ce cas.

### 4.7 Le rythme, contre la fatigue

| Règle | Pourquoi |
| --- | --- |
| un épisode de friction = une notification | pas de rafale pendant que Léa cherche |
| un `id` par épisode | Screenpipe ignore un double envoi |
| un titre ou un corps qui varie à chaque épisode | sinon le filtre de 90 s le masque |
| `high` seulement si un client attend dans Crisp | sinon `normal` ; `low` ne va pas dans la cloche |
| un plafond par jour et par personne | la question ouverte de VISION.md (ligne 124) |
| on lit `message` à chaque envoi | si les notifications sont en pause, on ne réessaie pas en boucle |

### 4.8 La Live View pour le détail

- La notification reste courte. La règle complète, les étapes et la fréquence de la friction vont dans une Live View, ouverte par un `deeplink` depuis la cloche ou la carte d'équipe.
- Avec le pipe qui rédige la correction de process, on montre les **trois surfaces** demandées par le jury : notification, Live View, pipe.

### 4.9 Lever l'anonymat, seulement à l'initiative de celui qui demande

- Une notification de suivi propose [Contacter la personne qui a la solution]. Ce bouton ouvre la page locale, où Léa confirme.
- Celui qui a la solution reçoit « Quelqu'un souhaite échanger », et accepte ou non.

## 5. La boucle complète

```
Crisp : une demande arrive
   │
   ▼
serveur local de Léa ── POST /notify ──► notification [Y aller] [Copier] 👍👎
   ▲                                         │
   │  /notifications (vue, écartée)          │ clic [Y aller] → /go/42 → redirection
   │  /feedback (👍 / 👎 + correction)  ◄─────┘
   │
   └── signature anonyme : étape + type de détour + « utile / pas utile »
                      │
                      ▼
            serveur d'équipe : classe les solutions par étape
                      │
                      ▼
            le collègue suivant reçoit la meilleure solution en premier
```

## 6. Exemple de notification (celui qui bloque)

`PORT` est notre serveur, qui n'existe pas encore ; `42` est le numéro de l'épisode.

```json
{
	"id": "episode-42",
	"title": "Geste commercial : 1 mois offert max",
	"body": "**Premium seulement.** Ajouter la note `geste commercial` dans HubSpot.\nRéglé 3 fois dans l'équipe.",
	"pipe_name": "friction-assist",
	"priority": "high",
	"timeout": 0,
	"actions": [
		{ "id": "go", "label": "Y aller", "type": "link", "url": "http://127.0.0.1:PORT/go/42", "primary": true },
		{ "id": "copy", "label": "Copier la note", "type": "copy", "value": "Geste commercial : 1 mois offert (client premium)." }
	]
}
```

## 7. Feuille de route

| Phase | Quand | Contenu | Résultat visible |
| --- | --- | --- | --- |
| **0. Socle** | vendredi | le modèle de notification (4.1), [Copier] natif, lecture de `message`, un `id` par épisode | une aide propre qui s'affiche à coup sûr |
| **1. Chemin rapide** | vendredi soir | [Y aller] avec redirection (4.2, 4.3), les URL HubSpot et Slack vérifiées | le moment « waouh » : le bon écran s'ouvre |
| **2. Retours** | samedi | lecture de `/feedback` et de `/notifications`, l'escalade sur 👎 (4.4, 4.5) | la boucle se ferme ; un chiffre « utile » à montrer |
| **3. Celui qui a la solution** | samedi | la page locale de consentement (4.6), les solutions pré-partagées | le consentement montré en démo |
| **4. Surfaces** | dimanche | la Live View de détail, le pipe de correction de process (4.8) | les trois surfaces du jury |
| **Feuille de route (slide)** | — | lever l'anonymat (4.9), le bus d'événements en temps réel, la lecture des workflows | la vision au-delà du week-end |

## 8. Ce qu'on demande à Louis et Ezra (Discord)

On ne modifie pas Screenpipe : ce sont des questions, et au mieux des idées de contribution pour eux.

1. Un événement « bouton cliqué » ou « notification fermée » peut-il passer sur `/ws/events` ?
2. Peut-on autoriser un bouton `api` vers un port local déclaré par un pipe, sans transmettre la clé ?
3. Peut-on mettre à jour une notification affichée par son `id` ?
4. Un événement publié sur `/ws/events` peut-il déclencher un pipe ?
5. Le rendu markdown du panneau Mac (titres, listes) est-il prévu ?

Si la réponse est non, les sections 4.3 à 4.6 couvrent ces manques de notre côté.

## 9. Points de vigilance

- **Démo :**
  - couper le mode pause et les heures silencieuses sur la machine de démo ;
  - changer le titre entre deux essais (filtre de 90 s) ;
  - vérifier le `message` renvoyé par `/notify`.
- **Windows :** refaire la notification de test complète. Le rendu web diffère, et la fenêtre peut prendre le focus.
- **VISION.md, lignes 148 et 156 :** à corriger en équipe. Un bouton ne peut pas appeler notre serveur, il faut passer par un `link`.
- **Pas de « Tab universel »**, qui a été écarté : [Copier] reste une aide ponctuelle déclenchée par une friction.
- **Données client :** le nom, l'e-mail et la commande ne vont jamais dans la signature, ni dans la notification de celui qui a la solution.
- **Jeton :** notre serveur lit `/feedback` avec `SCREENPIPE_API_KEY` (depuis `process.env`), sans jamais l'afficher dans les logs.

## 10. Questions pour le groupe

1. Valide-t-on le modèle de notification à 2 boutons (4.1) ?
2. La redirection pour [Y aller] (4.3) : d'accord pour faire passer les clics par notre serveur ?
3. Les 👍/👎 de Screenpipe comme seul retour « utile / pas utile » : ça nous suffit ?
4. Qui corrige VISION.md (lignes 148 et 156) ?
5. Qui pose les questions de la section 8 sur Discord, et quand ?
