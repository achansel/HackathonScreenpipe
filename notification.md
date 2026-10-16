# Proposition : des notifications à la hauteur de la boucle de la friction

> **Statut :** idée proposée au groupe, à discuter. Rien n'est décidé.
> Elle complète [VISION.md](VISION.md) (étape 5, « Aider en direct ») et [UseCase.md](UseCase.md) (la journée de Léa).

## En bref

- **Le constat :** la notification de Screenpipe suffit pour **montrer** l'aide. Elle ne suffit pas pour **faire tourner la boucle** : on ne sait pas si l'aide a servi, celui qui a la solution ne peut pas la rédiger, et rien ne se copie en un clic.
- **La proposition :** notre serveur local devient le « cerveau » des notifications. Les boutons l'appellent, et lui gère le reste (le suivi des clics, le presse-papiers, le consentement, l'anonymat).
- **La règle respectée :** aucun fork, aucune modification de l'overlay. On n'utilise que `/notify`, les Live Views et les pipes.

## 1. Ce que fait la notification aujourd'hui

### Testé sur Mac le 16 octobre

- `POST 127.0.0.1:11435/notify`, sans jeton, servi par l'appli de bureau (Tauri). C'est le même processus que l'API sur le port 3030.
- **Le contenu :** un titre et un corps en markdown.
- **Les boutons :** jusqu'à 5. Les types possibles :
  - `link` : un lien web ;
  - `deeplink` : un lien `screenpipe://` ;
  - `chat` : ouvre le chat avec une demande et du contexte ;
  - `pipe` : lance un pipe ;
  - `api` : appelle un endpoint local ;
  - `dismiss` : ferme la notification.
- **La priorité :**
  - `high` : en plus du panneau, va dans la vue « Priorité » ;
  - `normal` : reste dans « Tout » ;
  - `low` : le toast seul.
- **La durée :** 20 s par défaut, `0` = la notification reste jusqu'à ce qu'on la ferme.
- **L'historique :** la notification reste dans la cloche, et ses boutons restent actifs après la disparition du toast.

### Lu dans le binaire de l'appli (à confirmer)

- **Sur Mac :** un panneau natif SwiftUI (`NSPanel`), qui flotte au-dessus des fenêtres, a priori sans voler le focus.
- **Sinon :** une fenêtre web (Tauri, page Next.js). C'est probablement le cas sous Windows, donc le rendu peut différer d'un système à l'autre.
- **La notification peut être masquée** en silence : par le mode pause ou silencieux (« snooze / quiet »), ou par un délai anti-répétition (« cooldown »).

## 2. Ce qui manque pour notre cas d'usage

| Besoin (VISION / UseCase) | Limite actuelle | Gravité |
| --- | --- | --- |
| Savoir si l'aide est arrivée et a servi | `/notify` répond `success` même quand la notification est masquée. Aucun événement « vue » ni « fermée » | haute |
| Copier en un clic un modèle Slack ou une note HubSpot | aucun bouton de type « copier » | haute |
| Laisser celui qui a la solution la rédiger ou la corriger | des boutons seulement, pas de champ de saisie | haute |
| L'anonymat de celui qui demande, levé seulement par lui | rien de prévu, c'est à nous de le gérer | moyenne |
| Afficher l'aide à côté du champ qui bloque | un toast fixe en haut à droite ; modifier l'overlay est écarté | moyenne |
| Éviter la fatigue (VISION, *Questions ouvertes*) | le cooldown de Screenpipe peut masquer nos répétitions légitimes, sans qu'on le contrôle | moyenne |
| Un contenu détaillé (étapes, historique) | markdown seul, 5 boutons, pas d'image | basse (une Live View suffit) |
| La même expérience sur Mac et Windows | un rendu natif sur Mac, une page web ailleurs | à tester |

## 3. La proposition

### 3.1 Notre serveur local pilote chaque notification

- **Un épisode = une friction :** le serveur supprime les doublons, applique son propre délai entre deux notifications et un plafond par jour.
- **Chaque bouton important est un appel `api` vers notre serveur :** c'est notre seule façon de savoir ce qui a été cliqué (« ça m'a aidé », « pas ça », « copié »).
- **Copier en un clic :**
  - le bouton `api` demande au serveur de mettre le texte dans le presse-papiers (`pbcopy` sur Mac, `clip.exe` depuis WSL) ;
  - la notification l'annonce dans son texte : « Modèle copié, colle-le dans #bugs ».
- **Un statut honnête :** sans clic, une notification est « non confirmée », jamais « ignorée ». On ne déduit rien sur la personne.

### 3.2 Le chemin rapide, dès l'arrivée de la demande client

Dès qu'une demande arrive dans Crisp, la notification ouvre directement **l'écran où il faut agir**. Elle n'explique pas le chemin : elle le fait. C'est le bouton **[Y aller]**, de type `link`.

| Demande du client (UseCase) | [Y aller] ouvre | En plus, [Copier] |
| --- | --- | --- |
| « Ma page est en panne !! » (9 h 05) | la recherche HubSpot par domaine ou par téléphone, au lieu de l'e-mail | — |
| « Il paie quoi ? » (9 h 20) | la liste des produits de son contrat dans HubSpot, au lieu de 4 clics | — |
| un bug à signaler (9 h 40) | le canal `#bugs` dans Slack (lien `slack://`) | le modèle de message |
| « Je veux un dédommagement » (11 h) | sa fiche HubSpot, pour vérifier l'offre premium | la note « geste commercial » |
| « Thomas m'a promis… » (14 h) | le champ « Conditions particulières » de la vente | — |
| « Combien pour 3 restaurants ? » (15 h 30) | la création de contact HubSpot | le stage « Lead » et la responsable, Sarah |

- **Deux clics, et la tâche avance :** [Y aller] ouvre le bon écran, [Copier] met le bon texte dans le presse-papiers.
- **Le lien se construit en local :**
  - ce qui circule entre les machines, c'est le chemin générique (« contrat → produits ») ;
  - la machine de Léa le complète avec les identifiants qu'elle voit à l'écran ;
  - l'identifiant du client ne quitte jamais sa machine.
- **Le déclenchement :**
  - la notification part à l'arrivée d'une demande d'un type sur lequel l'équipe a déjà bloqué, donc d'une friction prévisible ;
  - l'agent ne lit que ce message Crisp, pas l'historique, comme le veut VISION.md.
- **À vérifier :** le format exact des URL HubSpot (contrat, recherche, pipeline présélectionné) et des liens `slack://`.

### 3.3 Une notification par rôle

**Pour celui qui bloque** (Léa, 11 h, le geste commercial) :

- **Le titre donne la réponse**, pas une alerte : « Geste commercial : 1 mois offert maximum, premium seulement ».
- **Le corps contient la règle maison** en deux ou trois lignes, et la mention « Réglé 3 fois dans l'équipe ». Si la règle est plus longue, la version complète va dans une Live View (3.5).
- **Les boutons :**
  - [Y aller] : le chemin rapide (3.2)
  - [Copier la note HubSpot]
  - [Ça m'a aidé]
  - [Pas ça]
- **[Pas ça] mène à une deuxième notification :** le bon canal Slack et son modèle, déjà copié. L'escalade se fait au grand jour, toujours sans nom.

**Pour celui qui a la solution :**

- **Le titre :** « Quelqu'un bloque sur *geste commercial*. Ta solution du 12/10 : … »
- **Les boutons :**
  - [Partager tel quel]
  - [Modifier avant]
  - [Toujours pour ce cas]
  - [Non]
- **[Modifier avant]** ouvre une petite page locale, servie par notre serveur : c'est le champ de saisie qui manque à la notification.
- **[Toujours pour ce cas]** fait de la solution une solution pré-partagée, ce qui règle la fatigue pour ce cas.

### 3.4 L'anonymat, levé seulement par celui qui demande

- Celui qui bloque a un bouton [Contacter la personne qui a la solution]. Lui seul peut le déclencher, comme le veut VISION.md (« c'est lui qui décide »).
- Celui qui a la solution reçoit « Quelqu'un souhaite échanger », et accepte ou non.

### 3.5 Trois surfaces Screenpipe, un seul parcours (critère du jury)

| Surface | Rôle |
| --- | --- |
| **Notification** | l'accroche : la réponse en une ligne et le chemin rapide |
| **Live View** | le détail : la règle complète, les étapes, la fréquence de la friction, la carte de l'équipe |
| **Pipe** | la réparation : il rédige la page de wiki et la demande de correction pour la responsable (par exemple « activer l'intégration Crisp → HubSpot ») |

### 3.6 La priorité selon le coût réel

- `high` seulement quand un client attend dans Crisp : le coût est réel, comme le dédommagement de 11 h.
- `normal` sans délai d'expiration pour le reste.
- `low` pour les simples astuces.

### 3.7 Apprendre de chaque notification

- **Nos signaux :** les pouces haut et bas de `GET /feedback?kind=notification` et nos propres clics.
- **Leur usage :** ils ajustent la sensibilité du déclenchement pour chaque type de friction.
- **En démo :** on montre « chaque friction ne se paie qu'une fois », chiffres à l'appui.

## 4. Exemple de notification (celui qui bloque)

`PORT` désigne notre serveur, qui n'existe pas encore. `PORTAIL` et `CONTRAT` sont les identifiants HubSpot, complétés en local sur la machine de Léa.

```json
{
	"title": "Geste commercial : 1 mois offert maximum, premium seulement",
	"body": "**Règle de l'équipe**\n1. Vérifier l'offre premium dans HubSpot\n2. Ajouter la note `geste commercial`\n\n_Réglé 3 fois dans l'équipe._",
	"pipe_name": "friction-assist",
	"priority": "high",
	"timeout": 0,
	"actions": [
		{ "id": "go", "label": "Y aller", "type": "link", "url": "https://app.hubspot.com/contacts/PORTAIL/record/0-3/CONTRAT", "primary": true },
		{ "id": "copy", "label": "Copier la note HubSpot", "type": "api", "url": "http://127.0.0.1:PORT/episodes/42/copy" },
		{ "id": "ok", "label": "Ça m'a aidé", "type": "api", "url": "http://127.0.0.1:PORT/episodes/42/helped" },
		{ "id": "no", "label": "Pas ça", "type": "api", "url": "http://127.0.0.1:PORT/episodes/42/escalate" }
	]
}
```

## 5. Ce qu'on demande à Louis et Ezra (Discord)

On ne modifie pas Screenpipe, on leur demande :

1. Existe-t-il un retour quand une notification est affichée ou fermée ?
2. Peut-on mettre à jour une notification existante par un `id` ? Un événement interne `notification-panel-update` existe, à vérifier.
3. Un type de bouton « copier » est-il prévu ? L'appli a une commande interne `copy_text_to_clipboard`.
4. Peut-on désactiver le cooldown pour un `pipe_name` donné ?

Si la réponse est non, les sections 3.1 et 3.3 couvrent ces manques de notre côté.

## 6. Priorités proposées

| Ordre | Quoi | Pourquoi |
| --- | --- | --- |
| 1 | Serveur local : suivi des clics et copie en un clic (3.1) | ça comble les deux plus gros manques, et c'est la base du reste |
| 2 | Le chemin rapide [Y aller] (3.2) | le moment « waouh » de la démo : la notification ouvre le bon écran |
| 3 | Les deux notifications par rôle (3.3) | c'est le cœur de l'assistance en direct et du consentement |
| 4 | Notification + Live View + pipe (3.5) | les trois surfaces exigées par le jury |
| 5 | Lever l'anonymat, apprendre des retours (3.4, 3.7) | la feuille de route, si on a de l'avance |

## 7. Points de vigilance

- **Démo :** couper le mode pause et le mode silencieux sur la machine de démo. Varier le titre entre deux essais, sinon le cooldown masque la notification.
- **Windows :** refaire la notification de test complète sur la machine Windows (le rendu web peut différer).
- **Pas de « Tab universel »**, qui a été écarté : la copie en un clic reste une aide ponctuelle déclenchée par une friction, jamais une autocomplétion permanente.
- **Données client :** le nom et la commande du client n'entrent jamais dans la notification de celui qui a la solution, ni dans la signature.

## 8. Questions pour le groupe

1. Valide-t-on le serveur local comme « cerveau » des notifications ?
2. La copie en un clic : dans la démo, ou sur la feuille de route ?
3. Les deux rôles en démo, ou seulement celui qui bloque ?
4. Qui pose les 4 questions à Louis et Ezra sur Discord, et quand ?
