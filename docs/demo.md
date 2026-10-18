# Reproduire la démo

> Trois minutes : Léa (support, nouvelle) et Karim (trois ans de maison) chez PipingTable, start-up fictive qui vend un logiciel de réservation aux restaurants. Deux postes, ou une seule machine avec `simuler`. État et mesures : [etat.md](etat.md).

## L'environnement fictif PipingTable

Tout est fictif (clients en `@example.com` ou sur un domaine réservé `.test`). Détail : [../minguk/build/pipingtable.md](../minguk/build/pipingtable.md).

| Outil | Préparation |
| --- | --- |
| **Crisp** (chat client) | Un espace de travail Crisp, ouvert dans Chrome côté agent. Les clients fictifs se créent par un lien direct : [crisp.md](crisp.md). Client de l'ouverture : **Jean Dupont**, `jd.resto75@resa-paris.test` (introuvable dans HubSpot sous cet e-mail, exprès). |
| **HubSpot** (CRM) | Un portail gratuit, rempli avec `cd minguk && bun run seed` (clé privée dans `~/.config/friction/env` : `export HUBSPOT_SEED_TOKEN=…`). La même clé sert à l'agent pour retrouver la fiche par le nom. |
| **Slack** (facultatif) | Espace « Piping Company », historique rempli par `bun run seed:slack`. Sert au contexte de la demande anonyme. |
| **Screenpipe** | Enregistrement actif, Chrome (pas Firefox) pour Crisp et HubSpot. |

## Les postes

Sur chaque poste, depuis la racine du dépôt :

```bash
source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env && source ~/.config/friction/env
```

- **Karim** (responsable) : `bun andrea/daemon/main.ts equipe-creer Support`, puis `bun andrea/daemon/main.ts` (solutions de démo par défaut).
- **Léa** : `bun andrea/daemon/main.ts equipe-rejoindre "<lien>"` (lien transmis en privé), puis, pour n'avoir qu'une seule règle connue et montrer le partage sur le reste :

```bash
FRICTION_SEED_IDS=client-introuvable FRICTION_REQUEST_JITTER=0 bun andrea/daemon/main.ts
```

- Sur chaque poste : `bun andrea/daemon/main.ts carte-installer`, puis ouvrir dans Screenpipe les Live Views « Mon agent, en direct » et « Frictions de l'équipe ».
- `FRICTION_REQUEST_JITTER=0` coupe le délai aléatoire d'anonymat (10 à 60 s en vrai) : à dire au jury.
- **Une seule machine** : `bun teamstore/cli.ts equipe-demo`, puis `FRICTION_REQUEST_JITTER=0 bun andrea/daemon/main.ts simuler` et `bun andrea/daemon/main.ts injecter lea "…"`. Rien ne lit l'écran : les épisodes sont injectés (le dire).

## Avant de commencer

- [ ] Relancer l'app Screenpipe, puis `bun andrea/daemon/main.ts test-notif` et **voir** la notification.
- [ ] Léa : Crisp au premier plan (liste des conversations), HubSpot ouvert sur la **liste des contacts**. **Aucune recherche HubSpot avant le message de Jean** (une aide générique bloquerait la fiche 10 min).
- [ ] Terminaux et fenêtres de travail hors de l'écran enregistré.
- [ ] Le message de Jean part du simulateur de clients (`cd minguk && bun run simulate --sans-aide`, http://127.0.0.1:4518) ou de son lien Crisp dans une fenêtre privée.

## Déroulé

| Temps | Poste | Geste | Ce qu'on voit |
| --- | --- | --- | --- |
| 0:00 | — | — | « Quand un process coince, on cherche, on demande sur Slack, on attend. Et le suivant recommence. » |
| 0:20 | Léa | Jean Dupont écrit dans Crisp : « Ma page de réservation est en panne ». Léa reste 2 s sur la liste Crisp, ouvre sa conversation, copie son adresse, la colle dans la recherche des contacts HubSpot : « 0 contacts » | ~10 s après la recherche : notification **« Client : Jean Dupont · Le Bistro · Premium »** avec [Y aller] → sa fiche. « Il écrit avec une autre adresse que celle du contrat ; l'agent l'a retrouvé par son nom. » Léa clique [Ça m'a aidé]. Dans « Mon agent, en direct » : 💬 Crisp lu, 🧠 jugé, 🪪 fiche, 💡 aide, 🔒 envoi chiffré |
| 0:50 | Léa | Jean : « Je veux un dédommagement ». Léa écrit dans Slack `#support` : « On peut offrir quelque chose à un client premium ? » | Aucune règle connue chez Léa → **demande anonyme** à l'équipe (la vue montre ce que lit l'équipe et ce que voit le serveur) |
| 1:05 | Karim | — | Notification **« Un collègue bloque : … dédommagement »** → [Partager]. « Karim ne sait pas qui demande. » |
| 1:15 | Léa | — | ~4 s après : **« Geste commercial : 1 mois offert maximum »** avec [Copier]. Léa répond à Jean |
| 1:40 | Karim | `bun teamstore/cli.ts nuit --exemple` | La boucle de nuit relit l'exemple préparé (à annoncer comme tel) : notification **« Règle trouvée cette nuit : … »** → [Certifier]. La règle devient l'aide de toute l'équipe |
| 2:10 | — | Live View « Frictions de l'équipe » | Détours par étape, en fourchettes, jamais par personne ; étapes en attente, à documenter, partagées, certifiées |
| 2:30 | — | — | Chiffres (172 épisodes : précision 0,71, rappel 0,46 ; aide en 10 s), vie privée, et les évolutions proposées à Screenpipe : correctif Mac, mémoire d'équipe chiffrée, actions dans les Live Views |

## Si ça coince

| Problème | Repli |
| --- | --- |
| Notification invisible | Relancer l'app Screenpipe ; `test-notif` |
| Le message Crisp n'est pas lu (pas de ligne « Crisp : » dans le journal) | Il faut une capture de la liste Crisp montrant le message : revenir 2 s sur la liste. Sinon, l'aide générique « Client introuvable : chercher par domaine » part quand même |
| Clic sans effet sur Mac | Mac non patché : jouer Karim sur un second Windows, ou `simuler` |
| La détection ne se déclenche pas | `bun andrea/daemon/main.ts injecter lea "…"` (dire que c'est une injection) |
| Pas de réseau vers le stockage | Aide locale seulement (l'agent le dit au démarrage) |

## Questions probables

- **« Vous surveillez les employés ? »** Non : on compte des détours par étape ; aucune identité dans les données d'équipe (vérifiable dans `teamstore/schema.sql` : pas de colonne auteur, tout chiffré) ; consentement, pause, périmètre limité aux outils de travail.
- **« Pourquoi pas l'IA de HubSpot ? »** Elle connaît le produit, pas vos règles : « 1 mois offert max, premium seulement » n'est écrit nulle part.
- **« Le texte part dans le cloud ? »** Vers le modèle choisi dans Screenpipe, comme leurs propres fonctions ; identifiants évidents masqués ; un préréglage local le garde sur le poste.
- **« Et si l'IA invente une règle ? »** Elle propose seulement : rien n'entre dans la mémoire d'équipe sans la responsable, et une règle qui contient un nom, un e-mail ou un téléphone est refusée.
- **« Ça marche vraiment ? »** Les délais sont mesurés et les limites écrites : [etat.md](etat.md).
