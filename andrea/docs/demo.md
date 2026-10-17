# Démo finale (3 min + 2 min de questions)

> Basé sur ce qui tourne réellement (voir [../ETAT.md](../ETAT.md)). Deux postes : **Léa** (Windows, nouvelle, sans solution locale) et **Karim** (Mac patché ou second Windows, connaît les règles). Repli à une machine : `simuler`.

## Choix techniques pour la démo (fixés le 17/10, ne pas rouvrir)

Ce sont des choix **pour la démo de dimanche**, pas des décisions produit. Référence unique : en cas de doute, c'est cette section qui fait foi.

| Sujet | Choix pour la démo | Pourquoi |
| --- | --- | --- |
| Qui décide d'une aide | **Le démon agnostique d'Andrea a l'autorité.** Le code de Minguk (`minguk/` : lecture de Crisp, fiche HubSpot, mots-clés, appel) est gardé pour la démo ; en cas de doublon ou de désaccord sur la même étape, le démon l'emporte. | Les mots-clés sont justes sur les phrases du script (4/4) mais faux hors script (3/4 sur des messages pièges) ; le démon juge le geste de l'employé, sans règle par appli. |
| Boutons sous Windows | `api` relayé pour [Ça m'a aidé] [Pas ça] et [Partager] ; `link` seulement pour [Y aller]. | `api` relayé = API de Screenpipe, pas un fork, mesuré. Un `link` http ouvre toujours le navigateur (`actions.ts:346-358`, `open(url)`). |
| Mac | **Screenpipe patché** ([screenpipe-patch/](../screenpipe-patch/)) pour que les boutons `api` marchent. Écart assumé avec « aucun fork », **pour la démo seulement**. PR vers Screenpipe plus tard. | Sans le correctif, un clic `api` n'arrive jamais sur Mac (mesuré). |
| Lecture de Crisp | Celle de Minguk, **dans le démon** : le dernier message client sert de contexte au modèle (10 min), jamais de friction à lui seul. Ne **pas** lancer en même temps `teamstore/start.sh moi --crisp` (variante sans démon) ni `bun run simulate` sans `--sans-aide`. | Un seul décideur ; mesuré : la question Slack « geste commercial » passe de 2/5 à 5/5 avec le contexte. Chaque lecteur en plus multiplie les recherches (503 « search is busy »). |
| Modèle | **`claude-opus-5`, seuil de confiance 0,72** (`FRICTION_MODEL`, `FRICTION_MIN_CONFIDENCE`). | `claude-haiku-4-5` n'est pas dans la liste autorisée de la passerelle Screenpipe : il était remplacé en silence. Éval sur 172 épisodes : précision 0,71 contre 0,46 ; question « geste commercial » de Léa : demande anonyme 5/5 (haiku 3/5) ; latence médiane 2,6 s. |
| Génération de code (nuit) | **Évolution prévue, hors démo, figée le 17/10.** Rien à lancer ni à montrer : en direct, tout passe par l'inférence (un appel au modèle par épisode). | Le candidat généré ce soir ne filtrait que 0,7 % du travail normal (non approuvé) ; plus le temps de l'améliorer avant dimanche. Détail et reprise : [ETAT.md](../ETAT.md#évolution-prévue--détecteur-écrit-en-code-la-nuit). |
| Pitch sur le correctif | « On a trouvé et corrigé un bug de Screenpipe sur Mac ; c'est une des 3 évolutions qu'on leur propose. » | Ne pas présenter le build patché comme du Screenpipe d'origine. |

## Avant de monter sur scène (15 min avant)

Sur chaque poste, racine du dépôt :

```bash
source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env && source ~/.config/friction/env
```

- [ ] **Relancer Screenpipe** (app entière), puis envoyer une notification de test et la **voir à l'œil** (le panneau Windows peut rester vide alors que l'API répond « sent »).
- [ ] Léa : **une seule** solution connue (« client introuvable », partagée la veille) pour montrer l'aide immédiate, puis le partage sur le reste → `FRICTION_SEED_IDS=client-introuvable`, et `rm andrea/daemon/.state/solutions.json` si un cache existe.
- [ ] Karim : solutions de démo (graine par défaut).
- [ ] Léa : `~/.config/friction/env` contient `HUBSPOT_SEED_TOKEN` (fiche client à la place de « client introuvable »). Sans elle, l'aide générique part.
- [ ] **Délai d'anonymat à 0 pour la démo** : `FRICTION_REQUEST_JITTER=0` (sinon la demande part 10 à 60 s plus tard). Le dire au jury : en vrai, il y a un délai aléatoire.
- [ ] Lancer le daemon : `bun andrea/daemon/main.ts` (Léa : `FRICTION_SEED_IDS=client-introuvable FRICTION_REQUEST_JITTER=0 bun andrea/daemon/main.ts`).
- [ ] Carte : `bun andrea/daemon/main.ts carte` (données de démo déjà en base, **annoncées comme telles**).
- [ ] Chrome (pas Firefox) pour Crisp et HubSpot. Ouvrir le lien Crisp de **Jean Dupont** ([crisp.md](crisp.md)) dans une fenêtre.
- [ ] **Ouverture** : Crisp au premier plan (liste des conversations), HubSpot ouvert sur la **liste des contacts** (pas une fiche). **Aucune recherche HubSpot avant le message de Jean** (une aide générique « client introuvable » bloquerait la fiche 10 min). Fenêtres Claude/terminal hors de l'écran (l'OCR leur prend du texte).
- [ ] Le message de Jean part du simulateur de Minguk lancé **avec `--sans-aide`** (sinon deux décideurs). Jean n'écrit qu'une fois avant la recherche : la lecture Crisp prend un 2e message du même client pour du déjà-vu, et ne garde qu'un client à la fois.
- [ ] Ne pas répéter deux fois la même notification en moins de 90 s (filtre anti-doublon de Screenpipe).

## Déroulé

| Temps | Écran | Geste | Ce qu'on voit / dit |
| --- | --- | --- | --- |
| 0:00 | — | — | « Quand un process coince, on cherche, on demande sur Slack, on attend. Et le suivant recommence. » |
| 0:20 | Léa | Jean Dupont écrit dans Crisp (simulateur `--sans-aide`) : « Ma page de réservation est en panne ». Léa ouvre sa conversation, **copie** son adresse, la **colle** dans la recherche des contacts HubSpot : « 0 contacts » (rester 5 s) | ~10 s après la recherche : notification **« Client : Jean Dupont · Le Bistro · Premium »** avec [Y aller] → sa fiche HubSpot. « Il écrit avec une autre adresse que celle du contrat ; l'agent l'a retrouvé par son nom. » Léa clique **Ça m'a aidé**. Répété le 17/10 à 19:14 : réussi de bout en bout |
| 0:50 | Léa | Jean : « Je veux un dédommagement ». Léa écrit dans Slack `#support` : « On peut offrir quelque chose à un client premium ? » | Aucune solution chez Léa → **demande anonyme** à l'équipe |
| 1:05 | Karim | — | Notification **« Un collègue bloque : … dédommagement »** → **Partager**. « Karim ne sait pas qui demande. » |
| 1:15 | Léa | — | ~4 s après : **« Geste commercial : 1 mois offert maximum »** avec **Copier**. Léa répond à Jean |
| 1:40 | Léa | Bouton « Ouvrir la carte » ou `screenpipe://live-view/friction-map` | **Carte des frictions** dans Screenpipe : détours par étape, en fourchettes, jamais par personne ; étapes sans solution ; `required` = garde-fou à expliquer |
| 2:10 | — | — | Nos chiffres, tels quels : éval sur 172 épisodes étiquetés (précision 0,53, rappel 0,65 ; référence surtout posée par Claude). Évolution prévue, **pas montrée** : la nuit, l'IA écrit un détecteur en code, déterministe, validé et approuvé par un humain (voir « Choix techniques ») |
| 2:30 | — | — | Vie privée (blocs chiffrés, aucune identité, consentement, pause) ; « tout ce que l'utilisateur voit vit dans Screenpipe : notifications, Live View, pipes, modèle » ; les 3 évolutions proposées |

## Si ça coince

| Problème | Repli |
| --- | --- |
| Notification invisible | Relancer Screenpipe ; montrer la cloche |
| Clic sans effet sur Mac | Mac non patché : faire jouer Karim sur un second Windows, ou `simuler` sur une machine |
| La détection ne se déclenche pas | `bun andrea/daemon/main.ts injecter lea "…"` en simulation (dire que c'est une injection) |
| Screenpipe fermé | Le daemon attend (« Screenpipe injoignable ») et reprend seul |
| Pas de réseau vers Supabase | Aide locale seulement (le daemon le dit au démarrage) ; montrer la carte déjà publiée |

## Questions probables du jury

- **« Vous surveillez les employés ? »** Non : on compte des détours par étape ; aucune identité dans les données d'équipe (vérifiable : 5 colonnes, tout chiffré) ; consentement, pause, périmètre limité aux outils de travail.
- **« Pourquoi pas l'IA de HubSpot ? »** Elle connaît le produit, pas vos règles : « 1 mois offert max, premium seulement » n'est écrit nulle part.
- **« Le texte part dans le cloud ? »** Vers le modèle choisi dans Screenpipe, comme leurs propres fonctions ; identifiants évidents masqués ; un préréglage Ollama le garde en local.
- **« Pourquoi un programme à côté ? »** C'est l'usage prévu de leur API ouverte (« context layer for AI agents ») ; 3 évolutions identifiées pour l'embarquer.
- **« Ça marche vraiment ? »** Mesuré : aide en ~4–5 s, partage en 7 s + 4 s ; limites dans ETAT.md.
