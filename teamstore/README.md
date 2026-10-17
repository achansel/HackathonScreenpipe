# Équipes chiffrées : partager les solutions entre collègues, sans rien exposer

## À quoi ça sert

Notre produit repère quand quelqu'un **bloque sur une étape de process** (« comment je fais un geste commercial dans Crisp ? », « pourquoi ma remise HubSpot est bloquée ? »), puis lui montre la solution.

Mais **d'où vient la solution ?** De la tête d'un collègue qui a déjà eu le problème. Ce module est **le tuyau entre les collègues** :

1. **Léa bloque.** Personne dans son cache n'a la réponse. Son poste envoie à son équipe une **demande anonyme** : seulement « quelqu'un bloque sur *Crisp : dédommagement* ». Ni son nom, ni le contenu de son écran.
2. **Karim connaît la réponse.** Son poste reçoit la demande, et Karim voit une notification Screenpipe : « Un collègue bloque… Ta solution peut l'aider. Personne ne saura qui a demandé. » Il clique **Partager**.
3. **Léa reçoit la solution** dans une notification, en quelques secondes.
4. **La solution reste dans l'équipe.** Le prochain qui bloque sur la même étape a la réponse tout de suite, sans rien demander à personne. **Chaque friction ne se paie qu'une fois.**

Tout ce qui circule passe par un stockage partagé (Supabase, ou une machine de l'équipe). **Chaque poste chiffre tout avant d'envoyer.** Le stockage ne voit que des blocs illisibles, tous de la même taille, sans nom d'équipe, sans auteur et sans heure précise. Même quelqu'un qui volerait toute la base ne pourrait rien lire.

### Ce que ça permet en plus

| Besoin réel | Ce que fait le module |
| --- | --- |
| Plusieurs équipes (Support, Ventes…) | Chaque équipe a **sa propre clé**. Une équipe ne peut pas lire une autre. |
| Une personne dans plusieurs équipes | Une demande Crisp part au **Support**, une demande HubSpot aux **Ventes**. Une demande qui ne concerne aucune équipe **ne sort pas du poste**. |
| Quelqu'un quitte l'équipe | Le responsable clique **« changer la clé »** : l'ancien lien ne marche plus. Les solutions déjà partagées sont conservées pour les membres restants. |
| Distinguer la règle officielle d'un tuyau | Le responsable peut **certifier** une solution (✓). Personne d'autre ne peut fabriquer ce badge, et une règle modifiée le perd. |
| Ne pas savoir qui bloque | Pas d'auteur, pas d'heure exacte, tailles identiques. Le démon d'Andrea ajoute en plus un délai aléatoire avant chaque demande. |

## Démarrer en une commande

Depuis la racine du dépôt :

| Système | Commande |
| --- | --- |
| **Mac / Linux** | `./teamstore/start.sh` |
| **Windows** | `teamstore\start.cmd` (ou double-clic sur le fichier) |
| **Windows avec WSL** | `./teamstore/start.sh` dans WSL |

La première fois, si **Bun** n'est pas installé, le script propose de l'installer (depuis bun.sh). Il n'y a **rien d'autre à installer** : pas de Docker, pas de compte, pas de dépendance npm.

La page d'accueil s'ouvre toute seule dans le navigateur. Elle propose trois entrées :

| Page | Pour quoi |
| --- | --- |
| **Parcours guidé** (`/parcours`) | **Comprendre en 5 minutes** ([guide : PARCOURS.md](PARCOURS.md), [le reproduire : PARCOURS-REPRODUIRE.md](PARCOURS-REPRODUIRE.md)). La journée de Léa en 8 chapitres : on voit son écran (Crisp, HubSpot, Slack, Notion), ce que fait l'agent à chaque étape, ce que reçoivent ses collègues, et ce que voit le serveur. On clique soi-même, ou « Mode présentation » pour que ça défile seul. Les équipes et les blocs chiffrés sont réels. |
| **Équipe simulée** (`/equipe`) | Les 5 collègues côte à côte, le scénario en 10 étapes et les attaques : pour montrer au jury. |
| **Mon poste** (`/moi`) | L'usage réel, chacun sur sa machine (voir plus bas). Toujours sur le stockage de l'équipe (`team.env`) s'il est configuré, pour voir les demandes des démons. |
| **Répétition** (`/repetition`) | **Répéter la démo avec les vrais outils** : le déroulé d'Andrea, pas à pas. Tu joues les gestes dans Crisp, HubSpot et Slack ; le démon et Screenpipe réagissent ; la page coche chaque étape quand la vraie notification arrive, avec le délai. Détail : [DEMO.md](DEMO.md). |

**Ctrl+C** dans le terminal arrête tout.

> Pour les notifications Screenpipe réelles, l'app Screenpipe doit être ouverte. Sinon, les notifications s'affichent seulement dans la page.

## Trois façons de l'utiliser

### 1. Seul, pour comprendre ou présenter : le parcours guidé, puis la démo PipingTable

Commencer par **Parcours guidé** sur la page d'accueil. Ensuite, la page **Équipe simulée** :

```bash
./teamstore/start.sh                 # Windows : teamstore\start.cmd
```

La page montre **les 5 collègues de PipingTable** côte à côte sur ta machine. PipingTable est l'entreprise fictive de la démo, créée par Minguk avec son Slack, son HubSpot et son Notion (`minguk/build/pipingtable.md`). Chacun connaît les règles qu'il donne dans le Slack « Piping Company » :

| Collègue | Rôle | Ce qu'il sait |
| --- | --- | --- |
| 🙋‍♀️ **Léa** | support, 2 semaines de poste | rien encore |
| 👩‍💼 **Claire Morin** | responsable support | le geste commercial |
| 👨‍💻 **Karim Bensaïd** | support, 3 ans de maison | client introuvable, offre, bugs, promesses, pipeline |
| 📈 **Antoine Rey** | COO : responsable des Ventes **et** membre du Support | les remises de plus de 15 % |
| 🇧🇪 **Sarah Lambert** | ventes Belgique | les prospects belges |

En bas, en noir, on voit **ce que voit le stockage** : seulement du chiffré.

Clique les boutons **1 à 10** dans l'ordre : c'est la journée de Léa, et le pitch.

| # | Ce qui se passe |
| --- | --- |
| 1 | Claire crée l'équipe Support, Antoine l'équipe Ventes. En base : un identifiant et une empreinte, aucun nom. |
| 2 | Les liens d'invitation partent en privé, et chacun rejoint. |
| 3 | 9 h 05 : Léa ne trouve pas Jean Dupont. Sa demande anonyme part au Support, et Karim est notifié. Sarah (Ventes) ne voit rien. |
| 4 | Karim partage. Léa reçoit la solution. En base, un bloc de plus, de la même taille que les autres. |
| 5 | 11 h : Jean Dupont veut un dédommagement. Claire, qui connaît la règle, est notifiée. |
| 6 | Claire partage et **certifie** sa règle : badge ✓ chez tout le Support. |
| 7 | 15 h 30 : Antoine bloque sur un prospect belge. Il est dans deux équipes, mais la demande part **aux Ventes seulement**. |
| 8 | Sarah partage. |
| 9 | Karim quitte le Support : Claire change la clé. Karim est dehors, et Léa et Antoine attendent le nouveau lien. |
| 10 | Léa et Antoine prennent le nouveau lien et retrouvent tout. |

Ensuite, les **3 boutons d'attaque** :
- lire la base avec la clé publique : refusé ;
- écrire avec un faux jeton : refusé ;
- déchiffrer avec la clé d'une autre équipe : impossible.

Tout est aussi cliquable à la main. « Tout remettre à zéro » recommence.

### 2. Avec mes collègues, sur le même réseau (sans compte)

Une personne **héberge** le stockage sur sa machine :

```bash
./teamstore/start.sh moi --heberger      # Windows : teamstore\start.cmd moi --heberger
```

Le terminal affiche la commande à donner aux autres, par exemple :

```bash
./teamstore/start.sh moi --serveur http://10.81.62.99:3001
```

Chaque collègue la lance **sur sa propre machine**. Si le système demande d'autoriser les connexions entrantes pour « bun » (chez celui qui héberge), accepter.

> Certains wifi (écoles, événements) **isolent les machines** entre elles. Si les collègues obtiennent « Stockage injoignable », passer à l'option 3.

### 3. Avec mes collègues, partout : Supabase

> **Le projet de l'équipe existe déjà** : Haytham envoie l'URL et la clé anon en message privé. Il suffit de créer `team.env` (ci-dessous). Ne jamais les mettre dans le dépôt.

Pour recréer un projet (une seule personne, environ 10 minutes) :

1. Créer un projet gratuit sur [supabase.com](https://supabase.com), **région Europe**.
2. Ouvrir **SQL Editor**, coller tout le contenu de [`schema.sql`](schema.sql), puis cliquer **Run**.
3. Dans **Project Settings → API**, copier l'**URL du projet** et la clé **anon** (« publishable »). **Ne jamais partager la clé `service_role`.**
4. Envoyer ces deux valeurs aux collègues en message privé.

Chacun, une fois par machine, crée le fichier `~/.config/friction-assist/team.env` (sous Windows : `C:\Users\<toi>\.config\friction-assist\team.env`) :

```bash
FRICTION_TEAMSTORE_URL=https://<projet>.supabase.co
FRICTION_TEAMSTORE_ANON_KEY=<clé anon>
```

Puis :

```bash
./teamstore/start.sh verifier    # vérifie que Supabase est prêt (5 contrôles)
./teamstore/start.sh moi         # mon poste, sur Supabase
```

C'est **le même fichier** que celui du démon d'Andrea : une fois configuré, le démon et la page utilisent le même stockage.

## La page « Mon poste », pas à pas

C'est la page qu'on utilise pour de vrai, une par personne (`start.sh moi`).

1. **Créer l'équipe.** Une seule personne le fait (elle en devient responsable) : « Créer une équipe », un nom, un périmètre (Support / Ventes / Tout), puis « Créer ». Un **lien d'invitation** s'affiche : « Copier », puis l'envoyer **en message privé** à chacun.
   > Le lien **contient la clé de l'équipe** : ne jamais le poster dans un canal public.
2. **Rejoindre.** Chaque collègue colle le lien dans « Rejoindre une équipe », puis clique « Rejoindre ». Le **périmètre** ne sert qu'à qui est dans **plusieurs** équipes, comme Antoine (Support + Ventes) : il décide où part chaque demande. Sinon, laisser « Tout ».
3. **Choisir son profil.** « Je joue : » propose les collègues de PipingTable (Léa, Claire Morin, Karim Bensaïd, Antoine Rey, Sarah Lambert). On connaît alors les règles que ce profil donne dans le Slack de Minguk. Pour la démo à plusieurs : la personne qui présente joue **Léa**, les autres Claire, Karim, Antoine, Sarah.
4. **Bloquer.** Trois façons :
   - **un vrai message Crisp** : lancer `./teamstore/start.sh moi --crisp` et ouvrir Crisp dans Chrome. La détection de Minguk lit les messages clients à l'écran via Screenpipe, reconnaît le besoin (panne, dédommagement, promesse, prix) et déclenche la friction toute seule. **Variante sans le démon d'Andrea seulement** : si le démon tourne sur le poste, ne pas utiliser `--crisp`, car le démon lit déjà Crisp et doit rester le seul décideur (`andrea/docs/demo.md`) ;
   - **un message Crisp simulé** : le bloc « Crisp » de la page envoie un des messages des clients de la démo (Jean Dupont, Élodie Marchand, Pieter Janssens…) ;
   - **à la main** : « Je bloque sur… » propose des frictions préparées, ou « Autre… » pour décrire une étape, **sans nom ni donnée client**.
5. **Aider.** Une demande arrive dans « Demandes de l'équipe » :
   - si j'ai déjà la solution : **Partager** ;
   - sinon : **Je sais : répondre**, et je l'écris.
6. **Certifier** (responsable seulement) : le bouton « Certifier » sur une solution reçue.
7. **Quelqu'un part** (responsable seulement) : « Quelqu'un part : changer la clé », puis envoyer le nouveau lien **aux membres restants seulement**.

Les clés restent **dans le navigateur** de chacun. « Oublier mes clés » les efface de ce navigateur.

## Le tableau « Frictions en direct » (page + Screenpipe)

Sous les postes (équipe simulée, mon poste, parcours guidé), un tableau se met à jour toutes les 2 secondes, à partir de ce que l'équipe partage :

| Zone | Ce qu'on y voit |
| --- | --- |
| **4 compteurs** | demandes **sans réponse** (et depuis combien de temps pour la plus ancienne), frictions du jour, demandes résolues par un collègue (délai médian), règles certifiées |
| **En attente** | chaque demande anonyme sans réponse : l'étape, l'équipe, le temps d'attente qui défile |
| **Étapes** | chaque étape du jour et son état : *en attente de réponse*, *à documenter*, *solution partagée*, *règle certifiée* |
| **Fil en direct** | demandes, réponses (avec leur délai), certifications, changements de clé |

**Dans Screenpipe :** le même tableau est publié dans une **Live View « Frictions en direct »** (case cochée par défaut, il faut le jeton Screenpipe). Pour l'ouvrir : le lien « Ouvrir dans Screenpipe », ou `screenpipe://live-view/friction-live`. Elle est distincte de la carte d'Andrea (`friction-map`, 7 jours).

**Alerte à la responsable :** quand une demande reste sans réponse plus de 2 minutes (`--alerte 60` pour changer), la responsable de l'équipe reçoit une notification Screenpipe : « Demande en attente : … », avec un bouton **Voir le tableau** qui ouvre la Live View. Celui qui bloque reçoit, lui, l'escalade Slack de Minguk (`--escalade`).

Tout est calculé **sur le poste**, à partir des blocs déchiffrés : ni noms, ni auteurs, seulement des étapes, des compteurs et des délais.

Pour voir les cas « en attente » en direct :
- **Parcours guidé** : chapitre 4, le prospect belge reste sans réponse ;
- **Équipe simulée** : étape 3, puis attendre avant l'étape 4. Avec `/equipe?alerte=10`, Claire est alertée au bout de 10 s ;
- **Mon poste** : « Je bloque sur… », ou un message Crisp que personne ne sait traiter.

## La boucle de nuit : la mémoire qui se nourrit seule

C'est l'idée de Minguk (`minguk/build/retour-andrea.md`, §4), implémentée dans `teamstore/nuit.ts`. Elle réutilise, sans les modifier, la recherche Screenpipe, l'IA et le masquage du démon d'Andrea.

1. **La nuit, sur chaque poste** : `./teamstore/start.sh nuit`. Pour chaque friction de la journée restée **sans réponse** (les demandes anonymes du démon), elle relit dans Screenpipe les **15 minutes qui ont suivi**, dans les outils de travail seulement. L'IA dit si la personne s'en est sortie, et comment.
2. **Résolue** : l'IA écrit la **règle générale**, sans nom de personne ni de client. Le poste la publie, chiffrée, comme **proposition à valider**. Les démons ne s'en servent **pas** tant qu'elle n'est pas certifiée.
3. **Non résolue** : une **friction en attente** est publiée pour la responsable (l'étape, jamais la personne).
4. **Le matin** :
   - la responsable reçoit une notification Screenpipe (« 3 propositions de la nuit à valider ») ;
   - dans « Mon poste », la section **🌙 Cette nuit** permet de **Certifier**, **Modifier puis certifier** ou **Rejeter** ;
   - une fois certifiée, la règle devient l'aide de toute l'équipe, et celui qui avait bloqué la reçoit ;
   - le tableau « Frictions en direct » et sa Live View ont une liste « Cette nuit ».

Options : `--depuis 14:30` (une session de répétition seulement), `--lien "<lien>"` (une équipe précise), `--sans-publier` (voir les verdicts sans rien envoyer), `--exemple` (l'**exemple préparé** : 4 frictions de Léa et les vrais fils du Slack de PipingTable, jugés par la vraie IA ; à annoncer comme exemple).

Garde-fous :
- elle exige le consentement donné au démon (`bun andrea/daemon/main.ts activer`), sauf avec `--exemple` ;
- le texte d'écran ne part que vers le modèle choisi dans Screenpipe, comme pour le démon ;
- une règle qui contient un nom, un e-mail ou un téléphone est refusée, et la responsable relit tout ;
- le stockage doit connaître le type « proposition » : sur Supabase, coller une fois `migrations/2026-10-17-boucle-de-nuit.sql` dans l'éditeur SQL.

Dans le **parcours guidé**, c'est le chapitre 5, « La nuit » : le prospect belge resté sans réponse est rejugé par la vraie IA, puis Claire certifie.

## Avec le travail d'Andrea et de Minguk (sans modifier leur code)

| Commande / fonction | Ce que ça fait | Réutilise |
| --- | --- | --- |
| Bouton **Partager** dans la notification « Un collègue bloque » | Partage en un clic depuis Screenpipe, **même sur Mac**, car c'est un lien. L'onglet déjà ouvert s'en charge, et un deuxième onglet ne double pas les notifications. | — |
| Reconnaissance des étapes | La page reconnaît une demande même formulée autrement (le démon écrit l'étape avec l'IA) : démon et page travaillent dans la même équipe. | `matchStep` d'Andrea |
| `start.sh moi --escalade 60` | Une demande sans réponse après 60 s devient l'aide **« 💬 Slack + message »** : le bon canal PipingTable (#support, #bugs, #deal-desk, #new-leads) et un message prêt à coller. Par défaut : 120 s. | les notifications de Minguk |
| `start.sh carte [--lien "<lien>"]` | Installe et remplit la **carte des frictions** dans Screenpipe (Live View), à partir des signatures chiffrées de l'équipe, y compris celles de la page. | la carte d'Andrea |
| `start.sh equipe-demo` | Prépare les postes simulés du démon (Léa, Karim) sur le stockage chiffré, pour `bun andrea/daemon/main.ts simuler`. | la simulation d'Andrea |

Le déroulé complet de la démo finale, avec le simulateur Crisp de Minguk et les replis, est dans **[DEMO.md](DEMO.md)**.

## Et le démon d'Andrea ?

Le démon (`andrea/daemon/`) détecte les frictions à l'écran et fait tout ça automatiquement. Il utilise ce stockage dès que `team.env` est configuré (option 3) :

```bash
bun andrea/daemon/main.ts equipe-creer Support --perimetre "crisp|rembours"   # responsable : affiche le lien
bun andrea/daemon/main.ts equipe-rejoindre "frictionassist://join?team=…#…" --perimetre "crisp|rembours"
bun andrea/daemon/main.ts equipe-liste
bun andrea/daemon/main.ts equipe-rotation Support        # quelqu'un part : nouveau lien
bun andrea/daemon/main.ts equipe-certifier Support geste-commercial
```

Le reste du démon (`simuler`, `carte`, `peupler-demo`, `nettoyer-demo`) marche pareil, quel que soit le stockage.

## Questions fréquentes

**Le stockage (Supabase, ou la machine qui héberge) peut-il lire nos solutions ?**
Non. Il ne reçoit que des blocs chiffrés sur les postes, avec une clé qu'il n'a jamais. Il ne sait pas non plus comment s'appellent les équipes, ni qui a écrit quoi.

**Qu'est-ce qu'il voit, alors ?**
Les adresses IP qui se connectent, le nombre de blocs et leur jour. C'est la limite honnête à dire au jury : dans une petite équipe, le moment exact d'une demande pourrait se recouper avec l'activité de quelqu'un. C'est pour ça que le démon ajoute un délai aléatoire.

**Un collègue de mon équipe peut-il tout lire ?**
Oui, tout ce que l'équipe partage : c'est le but. Il peut aussi publier une solution fausse. Elle ne sera pas certifiée, et le responsable peut la retirer.

**J'ai perdu le lien / changé de navigateur.**
Demander le lien au responsable. Il le retrouve avec « Lien d'invitation » sur sa page.

**« Accès refusé » s'affiche sur une équipe.**
Le responsable a changé la clé. S'il ne t'a pas retiré de l'équipe, il doit t'envoyer le nouveau lien.

**Où sont stockées les clés ?**
- Page : dans le navigateur (`localStorage`).
- Démon : dans `~/.config/friction-assist/teams.json`, lisible par toi seul.
- Jamais dans le dépôt.

**Et les données de la démo ?**
Dans `teamstore/.data/`, ignoré par git.

## Dépannage

| Symptôme | Solution |
| --- | --- |
| « Le port 4322 est déjà pris » | friction-assist tourne déjà : ouvrir l'adresse affichée, ou fermer l'autre terminal. Pour un deuxième poste sur la même machine : `--port 4323`. |
| « Le port 3001 est déjà pris » | Une autre instance héberge déjà. La fermer, ou `TEAMSTORE_LOCAL_PORT=3002`. |
| « Stockage injoignable » | Celui qui héberge a-t-il lancé `--heberger` ? Êtes-vous sur le même wifi ? Sinon : Supabase. |
| Pas de notification Screenpipe | L'app Screenpipe est-elle ouverte ? La case « Notifications Screenpipe réelles » est-elle cochée ? Screenpipe en pause bloque aussi les notifications. |
| `verifier` échoue sur Supabase | `schema.sql` est-il exécuté en entier ? URL et clé anon bien copiées (sans espace) ? |

## Tests et mesures

`./teamstore/tests.sh` lance tout d'une commande (`--supabase`, `--ia`, `--perf` en plus). Les résultats, la provenance des étiquettes et les limites sont dans **[MESURES.md](MESURES.md)** :
- 35 tests unitaires ;
- 41 tests de bout en bout et 8 tests du circuit du démon, en local et sur Supabase ;
- la boucle de nuit avec le vrai modèle : précision et rappel 1,00 sur 20 cas, puis sur 8 cas réservés, 0 fuite ;
- la performance de Supabase.

## Pour aller plus loin

- [PARCOURS.md](PARCOURS.md) : le parcours guidé, chapitre par chapitre, et comment le présenter ; [PARCOURS-REPRODUIRE.md](PARCOURS-REPRODUIRE.md) : comment il est construit, pour le refaire ou l'adapter.
- [RAPPORT.md](RAPPORT.md) : le rapport d'ensemble (ce qui a été construit, choix, mesures, limites, suite).

- [FICHE.md](FICHE.md) : ce qui a été construit, les choix, les tests, les limites.
- [CONCEPTION.md](CONCEPTION.md) : l'analyse de départ (modèle de menace, alternatives).
- Tests :
  - `bun teamstore/local-server.ts`, puis dans un autre terminal `cd teamstore && bun test.ts` (38 tests) ;
  - `./teamstore/daemon-test.sh` (circuit du démon, 7 tests).
