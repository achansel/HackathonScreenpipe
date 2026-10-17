# Fiche : stockage d'équipe chiffré sur Supabase (implémenté)

> **Statut :** implémenté, testé, démontrable. Branche locale `feat/teamstore-rpc`, **pas poussée**.
> **Date :** 17 octobre 2026. Base : la proposition d'Andrea (`andrea/PROPOSITION.md` §5), son commit `444607e` (étape 2 : stockage d'équipe et boucle demande/partage), **mis à jour sur `82b017c`** (carte d'équipe, délai aléatoire, `nettoyer-demo`).
> **Pour l'équipe (mode d'emploi) :** [README.md](README.md). Une commande : `./teamstore/start.sh` (Mac/Linux/WSL) ou `teamstore\start.cmd` (Windows).
> **Tests :** 38/38 (stockage), à l'identique sur **Postgres 16 + PostgREST** (la pile de Supabase) et sur le **stockage local SQLite** ; 7/7 (circuit du démon d'Andrea) ; 15/15 (tests d'Andrea, inchangés) ; scénario PipingTable en 10 étapes dans Chrome ; **deux postes séparés** reliés par le réseau (invitation, demande, partage, réponse, rotation) ; notification Screenpipe réelle affichée. **Testé sur le vrai projet Supabase de l'équipe (région UE) : 38/38, démon 7/7, `verifier` 5/5.**
> **Conception détaillée (avant implémentation) :** [CONCEPTION.md](CONCEPTION.md).

## En une minute

Chaque poste chiffre lui-même ce qu'il partage avec son équipe (demandes d'aide anonymes, solutions), puis l'envoie à Supabase. **Supabase ne stocke que des blocs illisibles**, sans nom d'équipe, sans auteur, sans heure précise, et tous de la même taille. Une personne peut appartenir à **plusieurs équipes** : chaque équipe a sa propre clé, une demande ne part qu'à l'équipe concernée, et une équipe ne peut pas lire une autre. Quand quelqu'un **quitte une équipe**, le responsable change la clé en un clic : l'ancien lien ne donne plus accès à rien, et les solutions déjà partagées sont conservées pour les membres restants. Les règles validées par le responsable sont **signées** : personne d'autre ne peut fabriquer une règle « certifiée ».

Le démon d'Andrea marche **sans réécriture** : le nouveau stockage respecte exactement son interface `TeamStore`, et son circuit `team.ts` est inchangé (5 lignes ajoutées).

## Lancer la démo

```bash
./teamstore/start.sh          # Windows : teamstore\start.cmd — ouvre http://127.0.0.1:4322
```

Prérequis : Bun (le script propose de l'installer). **Plus de Docker** : un stockage local SQLite (`local-server.ts`) reproduit les 6 fonctions de `schema.sql` avec les mêmes contrôles et les mêmes réponses HTTP que Supabase (mêmes 38 tests). Screenpipe ouvert pour les notifications réelles (sinon elles s'affichent seulement dans les panneaux).

## Utilisation par l'équipe (résumé, détail dans README.md)

| Commande | Pour quoi | Stockage |
| --- | --- | --- |
| `start.sh` | démo : les 5 collègues de PipingTable simulés (pitch) | local, remise à zéro possible |
| `start.sh moi` | **mon poste**, une personne, avec ses vrais collègues | Supabase si `team.env` est configuré, sinon local |
| `start.sh moi --heberger` | ma machine sert de stockage à l'équipe (même réseau) ; affiche la commande à donner aux autres | local, ouvert au réseau |
| `start.sh moi --serveur http://IP:3001` | rejoindre le stockage d'un collègue | celui du collègue |
| `start.sh verifier` | contrôle un stockage (après avoir collé `schema.sql` dans Supabase) : 5 vérifications, puis nettoyage | configuré |

La page « mon poste » (`/moi`) permet de :
- **choisir le profil PipingTable qu'on joue** (Léa, Claire, Karim, Antoine, Sarah) : on connaît alors ses règles ;
- créer une équipe et copier son lien d'invitation ;
- rejoindre une équipe en collant un lien, avec un périmètre ;
- bloquer (frictions préparées, ou « Autre… ») ;
- partager une solution connue, ou **écrire une réponse** ;
- certifier, et changer la clé quand quelqu'un part.

Les clés restent dans le `localStorage` du navigateur. La page n'écoute que sur `127.0.0.1` ; seul le stockage est exposé au réseau, et seulement avec `--heberger`.

La page montre **les cinq collègues de PipingTable**, l'entreprise fictive de la démo créée par Minguk (`minguk/build/pipingtable.md`, profils Slack de `minguk/src/seed/slack-story.ts`). Chacun a ses propres clés, rangées séparément dans le navigateur, et connaît **les règles qu'il donne dans le Slack** « Piping Company ». Les postes ne communiquent **que** par des blocs chiffrés stockés dans la base, sauf le lien d'invitation, envoyé « en privé » (ici, une boîte de réception qui joue le rôle d'un message privé Slack).

| Poste | Rôle | Règles connues (`andrea/daemon/solutions.seed.json`) |
| --- | --- | --- |
| 🙋‍♀️ **Léa** | Support, 2 semaines de poste (jouée par la personne qui présente) | aucune |
| 👩‍💼 **Claire Morin** | Responsable support : crée « Support », invite, retire, certifie | geste commercial |
| 👨‍💻 **Karim Bensaïd** | Support, 3 ans de maison | client introuvable, offre du client, signaler un bug, promesse d'un commercial, pipeline du ticket |
| 📈 **Antoine Rey** | COO : responsable « Ventes » **et** membre du Support, donc deux équipes avec un périmètre chacune | remise > 15 % |
| 🇧🇪 **Sarah Lambert** | Ventes Belgique | prospect venu du chat |

Les frictions proposées sont celles de **la journée de Léa** (UseCase.md) : Jean Dupont introuvable, l'offre du Bistro, le bug, le dédommagement, la promesse de Thomas à Maison Pivoine, la remise d'Osteria Nonna, le prospect belge. **Le libellé (avec le nom du client) reste sur le poste ; seule l'étape, sans nom, part dans la demande.**

En bas, en noir : **ce que voit l'opérateur du stockage** (Supabase, ou quiconque volerait la base), rafraîchi toutes les 2 secondes, et trois boutons d'attaque.

### Le scénario (boutons numérotés en haut de la page) et quoi dire

| # | Action | Ce qu'on voit | Phrase pour le jury |
| --- | --- | --- | --- |
| 1 | Claire crée « Support », Antoine « Ventes » | Deux lignes dans `teams` : un identifiant, deux empreintes. Aucun nom. | « Le serveur ne sait même pas comment s'appellent les équipes. » |
| 2 | Liens envoyés en privé, chacun rejoint | Un message privé avec le lien `frictionassist://join?…#🔑`. Antoine est dans deux équipes. | « La clé voyage dans le lien, après le `#`. Elle ne passe jamais par un serveur. » |
| 3 | 9 h 05 · Léa ne trouve pas Jean Dupont | Demande **anonyme** au Support. Karim reçoit « Un collègue bloque » (notification Screenpipe). Sarah ne voit rien. | « Karim ne sait pas qui demande. Les Ventes ne voient rien. » |
| 4 | Karim partage | Léa reçoit « Client introuvable : chercher par domaine ». Un bloc de plus en base, **de la même taille que tous les autres**. | « Même la taille ne trahit rien. » |
| 5 | 11 h · Jean Dupont veut un dédommagement | Claire, qui connaît la règle, est notifiée. | |
| 6 | Claire partage et certifie sa règle | Badge **✓ certifiée** chez tout le Support. | « Seule la responsable peut signer. Un membre qui modifie la règle perd le badge. » |
| 7 | 15 h 30 · Antoine : prospect belge | Antoine est dans deux équipes : la demande part aux **Ventes seulement**. Léa, Claire et Karim ne voient rien. | « Une personne, deux équipes, et chaque demande va au bon endroit. » |
| 8 | Sarah partage | Antoine reçoit « Prospect : stage Lead, puis #new-leads ». | |
| 9 | Karim quitte le Support : Claire change la clé | Époque 2. Karim, Léa et Antoine : **accès refusé**. Les anciens blocs disparaissent, les solutions sont republiées sous la nouvelle clé. Léa et Antoine reçoivent le nouveau lien. | « Quand quelqu'un part, on change la serrure. » |
| 10 | Léa et Antoine prennent le nouveau lien | Ils retrouvent les solutions, y compris la certifiée. Karim reste dehors. | |
| ⚔️ 1 | Lire les tables avec la clé publique | `HTTP 401 permission denied for table blobs` | « La clé publique est dans chaque appli : elle n'ouvre rien. » |
| ⚔️ 2 | Écrire dans une équipe avec un jeton inventé | `put_blob : accès refusé` | |
| ⚔️ 3 | Déchiffrer un blob du Support avec la clé des Ventes | « authentification échouée » | « Même avec toute la base volée, sans la clé de l'équipe, rien n'est lisible. » |

Tout reste cliquable à la main : « Je bloque sur… », « Inviter », « Retirer (rotation) », « Partager », « Certifier ». Le bouton « Tout remettre à zéro » efface les clés des 5 postes et vide la base locale.

**Astuce de scène :** ouvrir les outils de développement du navigateur, onglet Réseau, pour montrer que les requêtes vers la base ne contiennent que du chiffré. Le chiffrement se fait dans la page ; le serveur de démo ne voit jamais une clé.

## Intégrations avec le travail de l'équipe (17/10, sans modifier `andrea/` ni `minguk/`)

- **Démon d'Andrea ↔ page** : la page reconnaît les étapes formulées par l'IA du démon (`matchStep` importé, avec une comparaison par mots en repli). Mesuré : demande du démon → Karim (page) → Partager → aide affichée par le démon 8 s après.
- **Partager depuis la notification, sur Mac** : bouton `link` vers `/moi?partager=…` ; l'onglet ouvert traite le clic (BroadcastChannel), et un seul onglet est actif.
- **Escalade Slack** (`--escalade`) : la notification « 💬 Slack + message » de Minguk (`buildPayload` importé), avec le canal choisi d'après l'étape. Mesuré : affichée dans Screenpipe en priorité haute.
- **Carte d'Andrea** : `start.sh carte` passe par `publishMap`, avec un lecteur `TeamStore` sur nos équipes ; la page publie une signature à chaque friction. Mesuré : 5 blocs remplis.
- **Simulation d'Andrea** : `start.sh equipe-demo` écrit `teams-lea.json` et `teams-karim.json`.
- **Détection Crisp de Minguk** (`start.sh moi --crisp`) : son `CrispWatcher` (importé) lit les messages clients via Screenpipe, son `classify` lit le besoin, et la page en fait une friction. Repli : un message simulé depuis la page (même format). Mesuré : message de Jean (dédommagement) → besoin « geste » → demande anonyme publiée.
- **Parcours guidé** (`/parcours`) : 7 chapitres (aide immédiate, demande anonyme, certification avec falsification, escalade, mémoire d'équipe le lendemain, départ, carte), sur de vraies équipes chiffrées. Accueil (`/`) avec 3 entrées.
- **Correctif trouvé grâce au parcours** : la rotation de clé effaçait aussi les **signatures**, donc la carte repartait de zéro après un départ. Elles sont maintenant republiées avec les solutions.
- Déroulé : [DEMO.md](DEMO.md).

## Les options tranchées, et pourquoi

| Question ouverte | Choix | Pourquoi | Écarté |
| --- | --- | --- | --- |
| Clé de projet commune (proposition d'Andrea) | **Aucun accès direct aux tables** ; 6 fonctions protégées par un **jeton d'équipe** | La clé publique Supabase est forcément dans chaque client. Avec un accès aux tables, elle permet de lire, effacer ou noyer les blobs de toutes les équipes. La version `444607e` est pire : l'URL Postgres complète, mot de passe compris, est sur chaque poste. | Politiques RLS par équipe : il faudrait un compte Supabase par personne (identité) |
| Invitation | **Lien**, clé dans le fragment `#`, avec la clé publique du responsable | Se partage par message privé Slack, fonctionne pour le démon (`equipe-rejoindre "<lien>"`) comme pour la démo. La clé publique dans le lien empêche un membre de se faire passer pour le responsable. | QR code + mot de passe à l'oral : plus spectaculaire, mais un dérivé de mot de passe est attaquable hors ligne si la base fuit |
| Départ d'un membre | **Rotation + republication + purge** | Le responsable relit les solutions, change la clé, les republie sous la nouvelle clé ; le serveur efface l'ancienne époque. L'équipe ne perd rien, la personne partie n'a plus rien. Les demandes du jour ne sont pas republiées. | Laisser expirer : on perdrait les solutions pendant 180 jours |
| Règle « officielle » | **Signature Ed25519** du responsable | Un membre peut publier une solution (c'est le but), mais pas une solution « certifiée ». | Confiance au contenu |
| Plusieurs équipes | **Une clé par équipe, routage par périmètre** (regex sur l'étape) | Une demande Crisp va au Support, une demande HubSpot aux Ventes. Hors de tout périmètre : **rien ne sort du poste**. Une solution répond toujours dans l'équipe de la demande. Pas de republication automatique entre équipes. | Une clé pour tout le monde |
| Ce qui trahit l'auteur | **Pas d'auteur, pas d'heure** (`seq` + jour), **tailles arrondies** (paliers 1 024 → 16 384 octets) | Dans une équipe de 5, l'heure exacte ou la longueur d'un message suffisent souvent à deviner qui l'a écrit. | |
| Où chiffrer dans la démo | **Dans le navigateur** | Se montre en direct dans l'onglet Réseau, et prouve que le serveur de démo ne voit rien. Le même `crypto.ts` tourne dans Bun (démon) et dans le navigateur. | Chiffrer côté serveur de démo |

## Architecture

```
 Poste (démon Bun ou page de démo)                         Supabase (Postgres + PostgREST)
 ┌───────────────────────────────────────┐                ┌──────────────────────────────────────┐
 │ K (32 octets, par équipe, fichier 600) │                │ teams : id, access_hash, admin_hash,  │
 │   ├─ HKDF "enc"    → clé AES-256-GCM    │                │         epoch, created_at             │
 │   └─ HKDF "access" → jeton d'accès ─────┼── sha256 ────► │ blobs : seq, team_id, kind, epoch,    │
 │ clé admin (responsable seulement)       │                │         ciphertext, day, expires_at   │
 │   └─ HKDF "admin"  → jeton admin        │                │ RLS active, aucun droit pour anon     │
 │ clé Ed25519 (responsable) : certifier   │   RPC POST     │ 6 fonctions security definer :        │
 │                                         │ ─────────────► │ create_team, put_blob, list_blobs,    │
 │ seal(objet) = rembourrage + AES-GCM     │  clé « anon »  │ rotate_team, purge_blob, delete_team  │
 │   données associées fa1|équipe|type|ép. │   + jeton      │ pg_cron : purge des blobs expirés     │
 └───────────────────────────────────────┘                └──────────────────────────────────────┘
```

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `teamstore/schema.sql` | Le schéma à coller une fois dans l'éditeur SQL de Supabase : 2 tables, RLS, droits retirés, 6 fonctions, rétention |
| `teamstore/crypto.ts` | Chiffrement (WebCrypto, aucune dépendance, Bun et navigateur) : HKDF, AES-GCM, rembourrage, invitation, Ed25519 |
| `teamstore/client.ts` | `SupabaseStore` (appels RPC), `Team` (créer, ouvrir, publier, relire, certifier, faire tourner la clé, purger), `routeTeams` |
| `teamstore/test.ts` | 38 tests de bout en bout contre la base |
| `teamstore/daemon.test.ts`, `daemon-test.sh` | 7 tests : le circuit du démon d'Andrea (`TeamSync`) sur le nouveau stockage |
| `teamstore/local-server.ts` | Stockage local sans Docker (SQLite, `bun:sqlite`) : mêmes 6 fonctions, mêmes contrôles, mêmes codes HTTP que Supabase/PostgREST ; CORS ; `--heberger` pour l'équipe |
| `teamstore/start.ts` | Point d'entrée unique : `demo`, `moi`, `verifier` ; lit `~/.config/friction-assist/team.env` (le fichier du démon) ; ouvre le navigateur (Mac, Windows, WSL, Linux) |
| `teamstore/start.sh`, `start.ps1`, `start.cmd` | Lanceurs Mac/Linux/WSL et Windows ; proposent d'installer Bun s'il manque |
| `teamstore/README.md` | Mode d'emploi pour l'équipe |
| `teamstore/local-db.sh` | (Tests de fidélité) Base Postgres 16 + PostgREST dans Docker, rôles `anon`/`authenticated` comme Supabase |
| `teamstore/demo/` | La page : `server.ts` (fichiers, relais `/notify`, vue opérateur), `app.ts` (5 postes PipingTable ou « mon poste »), `index.html`, `moi.html`, `style.css` |
| `andrea/daemon/teamstore.ts` | **+ `RpcTeamStore`** (même interface que `PostgresTeamStore`, y compris `remove()` ajouté par Andrea : purge par le responsable ; multi-équipes ; rechargement à chaud du fichier d'équipes) et `openTeamStore()` (RPC si configuré, sinon Postgres) |
| `andrea/daemon/main.ts` | + commandes `equipe-creer`, `equipe-rejoindre`, `equipe-liste`, `equipe-quitter`, `equipe-rotation`, `equipe-certifier` ; le démon préfère le stockage RPC s'il est configuré ; `carte`, `peupler-demo`, `nettoyer-demo` passent par `openTeamStore()` ; « Certifiée par le responsable » dans la notification d'aide |
| `andrea/daemon/config.ts` | + `FRICTION_TEAMSTORE_URL`, `FRICTION_TEAMSTORE_ANON_KEY`, `FRICTION_TEAMSTORE_REST_PATH`, `TEAMS_FILE` |
| `andrea/daemon/team.ts` | + 4 lignes : une version certifiée d'une solution déjà en cache met à jour le cache |
| `andrea/daemon/solutions.ts` | + champs `team`, `certified`, `cert` |

Le mode `PostgresTeamStore` / `equipe-init` d'Andrea est **conservé**, et marqué « (ancien) » dans l'aide. Le démon ne l'utilise que si le stockage RPC n'est pas configuré.

## Détail technique

### Clés

- **K**, 32 octets aléatoires par équipe. Donnée par le lien d'invitation. Deux sous-clés en sont dérivées (HKDF-SHA-256, sel `friction-assist/v1`) :
  - `enc` : la clé AES-256-GCM ;
  - `access` : le jeton envoyé au serveur, qui n'en garde que le `sha256`. Le serveur ne peut ni déchiffrer, ni retrouver K à partir du jeton.
- **Clé admin**, 32 octets, chez le responsable seulement, jamais dans le lien. Son jeton dérivé (`admin`) autorise la rotation, la purge et la suppression.
- **Paire Ed25519** du responsable. La clé publique est dans le lien d'invitation, la privée reste chez le responsable.

### Format d'un blob

`base64url( iv(12 octets) ‖ AES-GCM( rembourrage( JSON ) ) )`, avec comme **données associées** `fa1|<équipe>|<type>|<époque>`. Conséquences, testées :
- un blob copié dans une autre équipe ne se déchiffre pas ;
- une « demande » ne peut pas être présentée comme une « solution » ;
- un octet modifié rend le blob illisible.

Le **rembourrage** préfixe la longueur sur 4 octets, puis complète jusqu'au palier suivant (1 024, 2 048 … 16 384). Une demande, une solution et une solution **certifiée** font toutes 1 403 caractères en base. Le premier palier était de 512 octets : la démo a montré qu'une solution signée passait alors au palier suivant, et que sa taille trahissait la certification.

Les contenus reprennent ceux d'Andrea : une demande = `{requestId, step, type, control, detour}`, une solution = le format de `solutions.seed.json` + `requestId`, plus `cert` si elle est certifiée.

### Base (`schema.sql`)

- `teams(id, access_hash, admin_hash, epoch, created_at)` et `blobs(seq, team_id, kind, epoch, ciphertext ≤ 24 000, day, expires_at)`. **Pas de colonne auteur, pas d'heure** (seulement le jour, pour la rétention).
- RLS activée, **tous les droits retirés** à `anon` et `authenticated` sur les deux tables ; `_hash` n'est pas appelable de l'extérieur.
- Fonctions `security definer`, `search_path = ''` :

| Fonction | Qui | Contrôles |
| --- | --- | --- |
| `create_team(access_hash, admin_hash)` | tout le monde | empreintes au bon format ; au plus 50 créations par heure |
| `put_blob(team, jeton, type, époque, blob)` | membres | bon jeton ; **époque courante** ; type connu ; ≤ 24 000 caractères ; au plus 2 000 blobs par jour et par équipe ; durée de vie selon le type |
| `list_blobs(team, jeton, curseur, limite, type?)` | membres | bon jeton ; **seulement l'époque courante** ; renvoie `seq, kind, epoch, ciphertext`, rien d'autre |
| `rotate_team(team, jeton admin, nouvelle empreinte)` | responsable | époque + 1, **efface les blobs des époques précédentes** |
| `purge_blob(team, jeton admin, seq)` | responsable | retire une solution fausse |
| `delete_team(team, jeton admin)` | responsable | supprime l'équipe et ses blobs |

- **Durée de vie :** demande 1 jour, signature 30 jours, vote 30 jours, solution et certification 180 jours. Purge chaque nuit par `pg_cron` (disponible sur Supabase ; ignoré en local).

### Rotation (départ d'un membre)

1. Le responsable relit toutes les solutions de l'époque courante (il a encore l'ancien jeton).
2. Il génère K', appelle `rotate_team` avec `sha256(jeton(K'))` : époque + 1, et les anciens blobs sont effacés côté serveur.
3. Il republie les solutions sous K'. Les certifications restent valides, car la signature porte sur le contenu de la règle, pas sur l'époque.
4. Il renvoie le nouveau lien, **en privé, aux membres restants seulement**. Dans le démon : `equipe-rotation Support` affiche le lien. Dans la démo, il est déposé automatiquement chez les membres restants.

Jusqu'à réception du nouveau lien, les membres restants voient « accès refusé ». La personne partie le voit pour toujours. Le démon le signale **une fois** et continue avec ses autres équipes (testé).

### Certification

Le responsable signe `{id, step, title, body, copy}` en JSON canonique (clés triées). À la réception, chaque poste vérifie la signature avec la clé publique reçue dans le lien. Si elle est valide, `certified: true` ; sinon, la signature est jetée. Le compteur d'usages et `requestId` ne sont pas signés : ils peuvent évoluer sans invalider la règle.

### Plusieurs équipes

- Chaque équipe a son `Membership` : `{name, teamId, epoch, key, ownerPub, scope?, admin?}`. Le démon les range dans `~/.config/friction-assist/teams.json` (droits 600, un fichier par instance en simulation), la démo dans le `localStorage` de chaque poste.
- **Envoi :** demande et signature → les équipes dont le `scope` correspond à l'étape. À défaut, les équipes sans `scope`. Sinon rien n'est publié.
- **Réponse :** une solution qui répond à une demande ne part **que** dans l'équipe d'où vient la demande (`requestId` → équipe, mémorisé à la lecture).
- **Lecture :** union de toutes les équipes, triée par `seq`. `seq` est global à la base, donc le curseur unique de `TeamSync` fonctionne tel quel.

### Côté démon d'Andrea

```bash
# une fois par machine : ~/.config/friction-assist/team.env (droits 600), hors dépôt
export FRICTION_TEAMSTORE_URL=https://<projet>.supabase.co
export FRICTION_TEAMSTORE_ANON_KEY=<clé anon du projet>        # publique par conception, mais hors dépôt

bun andrea/daemon/main.ts equipe-creer Support --perimetre "crisp|rembours"   # le responsable ; affiche le lien
bun andrea/daemon/main.ts equipe-rejoindre "frictionassist://join?team=…#…" --perimetre "crisp|rembours"
bun andrea/daemon/main.ts equipe-liste
bun andrea/daemon/main.ts equipe-rotation Support          # départ d'un membre ; affiche le nouveau lien
bun andrea/daemon/main.ts equipe-certifier Support geste-commercial
bun andrea/daemon/main.ts                                   # le démon prend le stockage RPC automatiquement
```

Le fichier d'équipes est relu à chaud : `equipe-rejoindre` ou `equipe-rotation` pendant que le démon tourne sont pris en compte sans redémarrage.

## Ce qui a été vérifié

**`bun test.ts` : 38/38**
- création de deux équipes, chacune avec son responsable ;
- clé et clé publique du responsable dans le fragment du lien ;
- un lien abîmé est refusé ; un membre invité n'a pas les droits du responsable ;
- un membre relit la solution en clair ; aucun auteur ; le filtre par type fonctionne côté serveur ;
- une autre équipe ne peut pas lire, même avec son propre jeton valide ; un faux jeton est refusé ; un membre de l'autre équipe ne voit rien ;
- routage : une étape Crisp va au Support, une étape HubSpot aux Ventes, une étape hors périmètre ne sort pas ;
- aucun texte en clair en base ; tous les blobs font la même taille (1 403 caractères) ;
- données associées : ni changement de type, ni rejeu dans une autre équipe, ni modification ;
- certification : reconnue ; un membre ne peut pas certifier ; une règle modifiée perd sa certification ; la signature d'un autre responsable ne vaut rien ;
- rotation : nouvelle époque ; 4 solutions republiées ; l'ancien membre ne lit ni n'écrit plus ; Léa avec l'ancien lien est bloquée puis retrouve tout avec le nouveau ; la certification survit ; la demande du jour n'est pas republiée ; une écriture avec l'ancienne époque est refusée ; seul le responsable peut faire tourner la clé ;
- purge par le responsable seulement ;
- type inconnu et blob trop gros refusés ;
- **accès direct aux tables et à `_hash` avec la clé publique : 401, 401, 401, 401.**

**`./daemon-test.sh` : 7/7**, sur le vrai `TeamSync` d'Andrea (seuls le modèle et `/notify` sont simulés) :
- Karim charge ses deux équipes ;
- une demande de Léa lui vaut « Un collègue bloque » avec Partager / Pas maintenant ;
- son clic sur Partager envoie la solution au Support seulement ;
- sa friction HubSpot part aux Ventes seulement ; une friction hors périmètre reste sur le poste ;
- la certification de la responsable arrive dans son cache ;
- après son retrait du Support, son démon le signale une fois et continue avec les Ventes.

**Stockage local SQLite :** les mêmes 38 tests, 38/38, et `start.sh verifier` 5/5.

**Deux postes séparés (deux instances, deux navigateurs, l'un héberge avec `--heberger`, l'autre se connecte par l'adresse réseau `en0`) :**
- le lien est créé et copié ;
- l'invité rejoint ;
- sa demande Crisp arrive chez l'hôte, qui partage ;
- l'invité reçoit la solution ;
- l'hôte décrit une étape inconnue (« Autre… »), et l'invité y répond en l'écrivant ;
- après la rotation, l'invité est refusé ;
- aucune erreur JavaScript.

**Navigateur (Chrome, piloté par script) :** les 10 étapes du scénario et les 3 attaques donnent le résultat attendu ; aucune erreur JavaScript. Les seules erreurs réseau sont les 401 attendus (anciens membres, attaques).

**Notification Screenpipe réelle :** « [Léa] Geste commercial : 1 mois offert max », journal Screenpipe `Notification shown … outcome=shown_on_panel`.

Pour relancer :

```bash
cd teamstore && bun local-server.ts &        # ou ./local-db.sh up (Postgres + PostgREST, Docker)
bun test.ts && ./daemon-test.sh && (cd ../andrea && bun test)
```

## Passer sur un vrai Supabase (≈ 25 minutes, une seule personne)

1. Créer un projet sur supabase.com, **région UE** (Francfort ou Paris).
2. Éditeur SQL : coller `schema.sql` et l'exécuter. Vérifier que `pg_cron` est activé (Database → Extensions), sinon l'activer et ré-exécuter la fin du fichier.
3. Settings → API : noter l'URL du projet et la clé **anon**. La clé **`service_role` ne quitte jamais cette personne** : elle n'apparaît dans aucun fichier, aucun poste, aucun message.
4. Relancer les tests contre le projet :
   `TEAMSTORE_URL=https://<projet>.supabase.co TEAMSTORE_ANON_KEY=<anon> TEAMSTORE_REST_PATH=/rest/v1 bun test.ts`
5. Démo sur ce projet : `./teamstore/start.sh --supabase` (avec `team.env` rempli). La vue opérateur n'est disponible que pour un stockage local : sur Supabase, montrer le Table Editor. Le bouton « remise à zéro » est désactivé sur un stockage partagé.
   Vérification rapide : `./teamstore/start.sh verifier`.
6. Chaque coéquipier : `~/.config/friction-assist/team.env` (600) avec les deux variables, puis `equipe-rejoindre`.
7. Après le hackathon : supprimer le projet. À noter : l'offre gratuite met en pause un projet inactif au bout de 7 jours.

## Ce que ça protège, et ce que ça ne protège pas

**Protégé :**
- le contenu (illisible sans K) ;
- l'appartenance d'un blob à une équipe (données associées) ;
- l'auteur (aucune colonne, pas d'heure, tailles égales) ;
- les autres équipes (jeton par équipe) ;
- les données des autres en cas de fuite de la clé publique (aucun accès direct) ;
- les règles officielles (signature) ;
- les données après le départ d'un membre (rotation et purge).

**Non protégé, à dire honnêtement :**
- **L'opérateur voit les adresses IP** et le rythme des requêtes. Dans une petite équipe, une demande publiée juste après un blocage visible peut se recouper avec l'activité de quelqu'un.
- **Un membre reste un membre** : il lit tout ce que son équipe partage, et peut publier une solution fausse. Elle sera « non certifiée », et le responsable peut la purger.
- Un ancien membre qui a **copié** des solutions en clair avant son départ les garde. La rotation protège la suite, pas le passé.
- Le lien d'invitation est un secret : envoyé dans un canal public, il faut faire tourner la clé.
- Pas de limite par membre (le serveur ne sait pas qui écrit) : seulement par équipe et par jour.
- `seq` est global à la base : on peut compter l'activité totale, pas l'attribuer.

## Différences avec la version d'Andrea (`444607e`)

| | Andrea (`PostgresTeamStore`) | Cette implémentation (`RpcTeamStore`) |
| --- | --- | --- |
| Sur chaque poste | URL Postgres **avec mot de passe** | URL Supabase + clé publique |
| Ce qu'un membre peut faire en base | Tout : lire, effacer toutes les équipes | Seulement les 6 fonctions, avec son jeton d'équipe |
| Équipes | Une seule clé pour tous ; les blobs des autres équipes sont seulement ignorés | Une clé et un jeton par équipe, isolées côté serveur |
| Plusieurs équipes par personne | Non | Oui, avec routage par périmètre |
| Départ d'un membre | Rien de prévu | Rotation, republication, purge |
| Horodatage | `at` à la microseconde | Le jour seulement |
| Taille | Révèle la longueur du contenu | Arrondie |
| Liaison blob ↔ équipe/type | Aucune | Données associées AES-GCM |
| Règles officielles | Non | Signature Ed25519 |
| Interface `TeamStore` | — | Identique ; `team.ts` inchangé hormis 4 lignes |

Ce qu'on garde d'Andrea : l'interface, AES-256-GCM, le modèle « la clé ne quitte pas les postes », les contenus (`requestId`, `step`, `type`…), la boucle demande → « Un collègue bloque » → Partager → aide, et la cible finale (la mémoire d'équipe de Screenpipe, derrière la même interface).

## Limites connues et suite

- **Windows non testé sur une vraie machine** (pas de Windows sous la main). Le code n'utilise que des chemins portables (`import.meta.dir`, `path.join`), `bun:sqlite` et les API de Bun ; à faire valider par le coéquipier sous Windows : `teamstore\start.cmd`.
- **Clés Supabase :** l'ancienne clé `anon` (JWT) est envoyée dans `apikey` et `Authorization` ; la nouvelle clé `sb_publishable_…`, qui n'est pas un JWT, seulement dans `apikey`.
- **Testé sur Supabase (17/10)** : le premier passage a trouvé un écart que la base locale ne voyait pas. Supabase accorde par défaut l'exécution des fonctions **directement** à `anon` et `authenticated`, si bien que `_hash` restait appelable (sans fuite : elle ne lit rien). `schema.sql` retire désormais ce droit aux trois rôles, et `local-db.sh` reproduit les droits par défaut de Supabase. Résultat après correctif : 38/38. Point à vérifier : sur Supabase, un refus renvoie peut-être 401 ou 403 selon le rôle. Le client détecte les refus par leur message (« accès refusé »), donc les deux cas marchent.
- **Boutons `api` sur Mac** : le bouton « Partager » du démon passe par le relais n8n, qui ne marche pas sur Mac (`andrea/docs/test-mac.md`). La démo utilise des boutons `link`, qui marchent partout.
- **Ordre des `seq`** : deux écritures simultanées peuvent valider dans le désordre ; un lecteur rapide peut alors manquer la plus petite. Rare à l'échelle d'une équipe. Correctif possible : relire les 30 dernières secondes.
- Une rotation republie **toutes** les solutions lisibles, y compris une éventuelle solution fausse d'un membre parti. Le responsable peut la purger ensuite.
- Pas encore de votes (« Ça m'a aidé ») partagés : le type `vote` existe dans le schéma, pas encore dans le client.
- Migration vers la mémoire d'équipe de Screenpipe : même interface, à brancher quand elle sera ouverte (CONCEPTION.md §12).

## Ce qui n'a pas été fait

- Rien n'est poussé : tout est sur la branche locale `feat/teamstore-rpc` (worktree `HackathonScreenpipe-teamstore/`).
- Aucun projet Supabase créé : il faut un compte, et c'est à l'équipe de choisir qui garde la clé `service_role`.
- Le code d'Andrea n'est modifié que par ajouts ; son mode Postgres direct reste disponible.
