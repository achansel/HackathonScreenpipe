# Conception : stockage d'équipe chiffré sur Supabase (avant implémentation)

> **Document de conception, écrit AVANT l'implémentation.** Ce qui a été réellement construit, testé et les options retenues sont dans [FICHE.md](FICHE.md). Les noms de fichiers cités plus bas (`store.ts`, 22 tests) sont ceux du premier prototype ; ils ont été remplacés par `client.ts` (38 + 7 tests).

> **Statut :** proposition technique, avec un prototype qui marche et qui est testé (`teamstore/`). Elle complète l'étape 2 d'`andrea/PROPOSITION.md`.
> **Établi le :** 17 octobre 2026, après lecture des commits d'Andrea (`46ac33d` à `53fa42e`), du code de Screenpipe Teams (`lib/team-crypto.ts`, `teams.mdx`) et du format `crates/screenpipe-team-memory`.
> **Testé :** 22 tests de bout en bout contre un vrai Postgres 16 + PostgREST (la pile de Supabase), dans Docker. **Pas encore sur un vrai projet Supabase.**

## En bref

- **L'idée d'Andrea est la bonne :** des blobs chiffrés côté client en AES-256-GCM, la clé dans le lien d'invitation, Supabase comme simple entrepôt temporaire, et une interface `TeamStore` pour migrer plus tard vers la mémoire d'équipe de Screenpipe.
- **Il lui manque 6 choses pour tenir face à plusieurs équipes :**
  1. **séparer les équipes** côté serveur : aujourd'hui, une seule clé publique commune lit et écrit tout ;
  2. **ne rien exposer directement** : uniquement des fonctions qui vérifient un jeton d'équipe ;
  3. **gérer le départ d'un membre** (rotation de clé, époques) ;
  4. **lier chaque blob** à son équipe et à son type (données associées) ;
  5. **ne pas trahir l'auteur** par l'heure exacte ou la taille ;
  6. **pouvoir faire confiance aux règles** : la signature du responsable.
- **Tout est implémenté et testé :**
  - `schema.sql` : les tables, et des fonctions RPC seules accessibles ;
  - `crypto.ts` : HKDF, AES-GCM avec données associées, rembourrage, Ed25519 ;
  - `store.ts` : l'implémentation Supabase de `TeamStore`, et la classe `Team`.
  - Environ 300 lignes, sans dépendance, en TypeScript sous Bun.
- **Ce que le serveur voit :** des identifiants d'équipe, des blobs chiffrés de taille arrondie, un type, une époque et un jour. **Jamais** la clé, le contenu ou l'auteur.

## 1. Les derniers commits (Andrea, 17/10)

| Commit | Contenu |
| --- | --- |
| `46ac33d` | `andrea/` : la proposition technique, un banc d'essai de détection (52 cas synthétiques), des outils de test |
| `74fbbc8` | **le démon** friction-assist (étape 1) : détection, qualification par `/v1/chat/completions` de Screenpipe, notification, relais des clics, 👍/👎, commandes de consentement (`activer`, `pause`). Plus un **patch de Screenpipe** pour les boutons `api` sur Mac |
| `157e4fb` | suppression de l'ancien prototype à expressions régulières |
| `53fa42e` | **l'apprentissage hors ligne** (étape 3) : rejeu de l'historique, étiquetage, détecteur généré, porte de validation, pipes de nuit |

### Ce qui est très bien

- **Du vrai code qui tourne**, avec des mesures notées « mesuré », « code » ou « à vérifier ».
- La vie privée est intégrée au démon : consentement explicite, pause, aucun texte d'écran sur disque, un périmètre limité aux applis de travail, un nonce par épisode.
- **Pas de clé IA :** le modèle passe par `/v1/chat/completions` de Screenpipe, sur le compte de chacun.
- **Il a lui aussi rencontré le bug de l'agent Pi** (`toToolDeclaration`), et prévu un repli : le démon lance le traitement de nuit à 3 h. Ça confirme notre fiche de bugs.
- L'astuce du **relais n8n** : un bouton `api` vise `:3030/connections/n8n/proxy`, ce qui est autorisé, et Screenpipe relaie l'appel vers le démon. C'est mesuré sous Windows.

### Les points à corriger ou à trancher

1. **`PROPOSITION.md` se contredit.** La §6 dit « Décision : boutons `api` + relais = voie principale, pas de `link` », alors que la §9 dit « `api` sur Mac : ne passe pas → `link` = voie principale ». Nos tests vont dans le sens de la §9 : sur Mac, le **`link` marche** (testé), et le `api` dépend d'une fenêtre interne pas toujours chargée.
2. **Son patch de Screenpipe ne suffit pas pour les corps imbriqués.** Le patch lit `body` dans le JSON déjà produit par le panneau Swift. Or ce panneau abîme les listes et les objets (notre bug `AnyCodable`). Il faut **les deux correctifs**, ou des corps sans liste ni objet, comme le fait déjà son démon.
3. **Patcher et recompiler Screenpipe, c'est un fork** pour la démo : permissions macOS à redonner, et contraire au principe verrouillé « sans fork ». C'est très bien comme **PR upstream**, à éviter sur les machines de démo.
4. **`filter_pii` diffère selon le système :** il « ne filtre rien » sous Windows chez Andrea (19 ms), alors qu'il prend 0,7 à 0,9 s chez nous sur Mac, ce qui suggère qu'il y est actif. À comparer avant d'en dépendre.
5. **Deux VISION.md** (racine et `andrea/`) : à fusionner vite, sinon il n'y a plus de source de vérité.
6. **Le port du démon (8787)** est différent de celui de nos tests (4317) : à aligner. L'apprentissage hors ligne est ambitieux pour 48 h, et ses chiffres sont synthétiques (il le dit lui-même).

## 2. La proposition Supabase d'Andrea : vérification point par point

Extrait d'`andrea/PROPOSITION.md` §5 : table `blobs(id, kind, at, ciphertext)`, AES-256-GCM, clé dans le lien d'invitation, « aucune identité dans les lignes : une même clé de projet pour tous », rapprochement côté client.

| Point | Verdict | Pourquoi |
| --- | --- | --- |
| Chiffrement côté client AES-256-GCM, nonce de 12 octets | ✅ | C'est le standard, et le même que Screenpipe Teams |
| Clé dans le lien d'invitation | ✅, à améliorer | La mettre **dans le fragment `#`**, que le navigateur n'envoie jamais. Option : la protéger par une phrase secrète, comme Screenpipe (PBKDF2 600 000 itérations) |
| Rapprochement côté client, après déchiffrement | ✅ | Les volumes sont faibles, et le serveur n'a rien à comprendre |
| Format `team-memory` pour les solutions | ✅ | Migration vers Screenpipe facilitée |
| **« Une même clé de projet pour tous »** | ❌ **bloquant** | La clé publique de Supabase (`anon`) est dans le code de chaque client. Avec un accès direct à la table, **n'importe qui la possédant peut lire les blobs de toutes les équipes** (chiffrés, mais énumérables), **les effacer ou noyer la base**. Il faut un **jeton par équipe**, vérifié par des fonctions RPC, et aucun accès direct aux tables |
| Pas de colonne `team_id` | ❌ | Impossible d'isoler les équipes, de faire une purge par équipe ou des quotas |
| Colonne `at` (horodatage) | ⚠️ | Dans une petite équipe, l'heure exacte d'une demande peut désigner la personne. Il vaut mieux un **numéro de séquence** comme curseur, et seulement le **jour** pour la rétention |
| Pas d'époque ni de rotation | ❌ | Quand quelqu'un quitte l'équipe, il garde la clé pour toujours |
| Pas de données associées | ⚠️ | Un blob peut être déplacé d'un type à l'autre ou d'une équipe à l'autre |
| Pas de rembourrage | ⚠️ | La taille d'un blob trahit son contenu (une règle courte, une longue demande) |
| Pas de signature des règles | ⚠️ | N'importe quel membre peut publier une « règle » fausse. Ça rejoint la question ouverte « la règle maison est-elle validée par le responsable ? » |

## 3. Le modèle de menace : qui peut voir quoi

| Acteur | Ce qu'il peut faire | Ce qu'il ne peut pas faire |
| --- | --- | --- |
| **Un membre de l'équipe** | lire les solutions, les signatures et les demandes de son équipe, en clair | savoir **qui** a publié quoi (aucun auteur dans les blobs) |
| **Un ancien membre** (après rotation) | garder ce qu'il a déjà téléchargé | lire ou écrire quoi que ce soit de nouveau ; l'ancien jeton est refusé, même pour les vieux blobs (**testé**) |
| **Une autre équipe** (même projet Supabase) | rien | lire, écrire ou même lister les blobs d'une autre équipe (**testé**) |
| **Quiconque a la clé publique `anon`** | appeler les fonctions RPC, créer une équipe (limité à 50 par heure) | lire ou écrire sans le jeton d'une équipe ; toucher aux tables (**testé : 401**) |
| **L'opérateur** (nous, Supabase, un dump de la base) | voir les identifiants d'équipe, le nombre de blobs, leur type, leur époque, leur jour et leur taille arrondie, **et les adresses IP dans les journaux de Supabase** | déchiffrer (la clé n'y est jamais), retrouver la clé (seule l'empreinte du jeton est stockée) |
| **Un membre malveillant** | publier des blobs faux ou du bruit (quota de 2 000 par jour) | faire passer une fausse règle pour **certifiée** (il faudrait la clé privée du responsable, **testé**) |
| **Un ordinateur volé** | lire le trousseau local s'il n'est pas protégé | rien de plus, si l'admin fait tourner la clé dès que le vol est connu |

**À dire honnêtement dans le pitch :** l'opérateur du stockage voit les adresses IP. Il pourrait donc relier « une demande a été écrite à 11 h 02 » à une adresse. C'est la limite d'un stockage centralisé. En production, la mémoire d'équipe de Screenpipe ou un relais résoudrait ce point.

## 4. L'architecture

```
machine de Léa (démon Bun)                         Supabase (région UE, temporaire)
┌──────────────────────────────────────┐           ┌───────────────────────────────────┐
│ trousseau ~/.config/friction-assist/ │           │ teams(id, access_hash, admin_hash, │
│   teams.json (chmod 600) :           │           │       epoch)                       │
│   { team_id, K, epoch, rôle }        │  HTTPS    │ blobs(seq, team_id, kind, epoch,   │
│                                      │  :443     │       ciphertext, day, expires_at) │
│ K ──HKDF──► clé de chiffrement       │ ────────► │                                    │
│   └─HKDF──► jeton d'accès            │  RPC      │ aucun accès direct aux tables      │
│ blob = AES-GCM(rembourré,            │  seules   │ RPC : create_team, put_blob,       │
│        AAD = équipe|type|époque)     │ ◄──────── │       list_blobs, rotate_team,     │
│ cache local des solutions déchiffrées│  poll 3 s │       purge_blob, delete_team      │
└──────────────────────────────────────┘           │ pg_cron : purge des blobs expirés  │
                                                   └───────────────────────────────────┘
```

**Un bénéfice inattendu :** Supabase passe par HTTPS sur le port 443. Ça résout le risque « le wifi de 42 isole les machines » qui menaçait un serveur d'équipe hébergé sur un portable.

## 5. Les clés

### 5.1 Une clé maîtresse, plusieurs sous-clés

```
K (32 octets aléatoires, générés par l'admin, partagés par le lien d'invitation)
├── HKDF("enc")    → clé AES-256-GCM : chiffre et déchiffre les blobs
└── HKDF("access") → jeton d'accès : envoyé à chaque appel ; le serveur ne garde que sha256(jeton)

Kadmin (32 octets, gardés par l'admin seul, jamais dans le lien)
└── HKDF("admin")  → jeton admin : rotation, purge, suppression de l'équipe
```

- **Un seul secret à partager** donne à la fois le droit d'accès et le déchiffrement.
- **Le serveur ne peut pas déchiffrer**, puisqu'il n'a ni K ni la clé de chiffrement. Une empreinte volée ne permet pas non plus de déchiffrer.
- **L'admin est séparé** : un membre ne peut pas expulser les autres.

### 5.2 L'invitation

```
frictionassist://join?team=<uuid>&epoch=1&name=Support#<K en base64url>
```

- **La clé est dans le fragment (`#…`)**, qui n'est jamais envoyé à un serveur, même si le lien est ouvert dans un navigateur.
- **À transmettre par un canal sûr** : DM Slack, Signal, ou en personne. C'est la règle de Screenpipe Teams.
- **Variante pour la démo sur scène**, reprise de Screenpipe : la clé est chiffrée par une phrase secrète de 8 caractères (PBKDF2 à 600 000 itérations), stockée sur le serveur, et la phrase est donnée à l'oral. C'est un QR code plus un mot de passe, sans lien sensible à copier.

### 5.3 Le stockage sur chaque machine

- `~/.config/friction-assist/teams.json`, en `chmod 600`, à côté de `~/.config/screenpipe/env` : même règle que le `CLAUDE.md` (jamais dans le dépôt, jamais dans les logs).
- Bonus Mac : le trousseau macOS (`security add-generic-password`).

### 5.4 Le départ d'un membre (rotation)

1. L'admin génère K′ et appelle `rotate_team` avec son jeton admin : l'empreinte d'accès change, et l'époque passe de 1 à 2.
2. **L'ancien jeton ne donne plus rien**, pas même les anciens blobs.
3. L'admin envoie le nouveau lien aux membres restants.
4. Les blobs de l'époque 1 ne sont plus lisibles par les membres réinvités, puisqu'ils n'ont que K′. Deux options : laisser expirer (les demandes vivent 1 jour, les signatures 30 jours), ou faire **re-chiffrer les solutions** par l'admin avant la rotation. Je recommande la deuxième pour les solutions, et l'expiration pour le reste.

**La limite à connaître :** ce qu'un ancien membre a déjà téléchargé, il le garde. C'est vrai de tout chiffrement, Screenpipe Teams compris. La rétention courte en limite la portée.

## 6. La base Supabase (`schema.sql`)

- **Deux tables**, avec la sécurité par ligne (RLS) activée et **aucun droit** pour `anon` ou `authenticated`. Personne n'y accède directement (**testé : 401**).
- **Six fonctions RPC** en `security definer` avec `search_path = ''`, les seules appelables avec la clé publique :

| Fonction | Qui | Ce qu'elle vérifie |
| --- | --- | --- |
| `create_team(access_hash, admin_hash)` | l'admin | le format des empreintes ; 50 créations par heure au maximum |
| `put_blob(team, jeton, type, époque, chiffré)` | un membre | le jeton, l'époque courante, le type autorisé, 16 Ko au maximum, 2 000 blobs par jour et par équipe |
| `list_blobs(team, jeton, depuis)` | un membre | le jeton. Renvoie `seq, type, époque, chiffré`, **jamais l'heure** |
| `rotate_team(team, jeton_admin, nouvelle_empreinte)` | l'admin | le jeton admin |
| `purge_blob(team, jeton_admin, seq)` | l'admin | le jeton admin (une règle fausse, du bruit) |
| `delete_team(team, jeton_admin)` | l'admin | le jeton admin (droit à l'effacement) |

- **La rétention, par type**, purgée chaque nuit par `pg_cron` :

| Type | Durée de vie |
| --- | --- |
| `request` | 1 jour |
| `signature`, `vote` | 30 jours |
| `solution`, `certification` | 180 jours |

## 7. Le format des blobs

| Type (`kind`) | Contenu en clair (une fois déchiffré) | Publié par |
| --- | --- | --- |
| `request` | `{ step, detour, week }` : « quelqu'un bloque sur cette étape » | la personne qui bloque, de façon anonyme |
| `solution` | un fichier au format `team-memory` (le modèle du §5 d'Andrea) | la personne qui a la solution, après son consentement |
| `signature` | `{ stepId, kind, control, week }` pour la carte d'équipe | chaque démon |
| `vote` | `{ solution_id, useful: true/false }` (venant des 👍/👎) | la personne aidée |
| `certification` | `{ solution_id, signature Ed25519 }` | le responsable du process |

- **Les données associées** `fa1|équipe|type|époque` sont vérifiées au déchiffrement. Un blob déplacé d'équipe, changé de type ou modifié est rejeté (**testé**).
- **Le rembourrage** arrondit les tailles à des paliers (512, 1 024… 16 384 octets) : tous les blobs du test font exactement 720 caractères.
- **Aucun champ d'auteur**, aucune valeur client : on garde la règle de `UseCase.md` et de `notification.md`.

## 8. Plusieurs équipes

| Situation | Comment on la gère |
| --- | --- |
| **Plusieurs équipes dans la même entreprise** (Support, Ventes) | une équipe = un `team_id`, une clé K et une époque. L'isolation est cryptographique **et** côté serveur (**testé**) |
| **Une personne dans plusieurs équipes** (Léa au Support et dans l'équipe Onboarding) | son trousseau contient plusieurs équipes. Le démon interroge chacune, et cherche une solution dans **l'union** des équipes dont elle fait partie |
| **À quelle équipe va une demande ?** | celle dont le **périmètre** correspond (les applis et étapes de `steps.json`) : Crisp et HubSpot → Support ; HubSpot Deals → Ventes. Une demande ne part jamais à toutes les équipes à la fois |
| **Repartager d'une équipe à l'autre** | **jamais automatique** : une solution du Support ne doit pas fuiter vers les Ventes. C'est un bouton explicite, « Partager aussi avec… » |
| **Sous-équipes** | ce sont des équipes à part. Dériver des sous-clés d'une clé commune ne suffit pas, puisque quiconque a la clé commune peut toutes les dériver |
| **Plusieurs entreprises sur le même projet Supabase** | ça marche (isolation par jeton et par clé), mais en production on prendrait un projet par entreprise, ou la mémoire d'équipe de Screenpipe |
| **La démo** | une équipe « Démo » à part, pour la population synthétique, signalée comme telle, jamais mélangée à une vraie équipe |
| **Le responsable qui voit plusieurs équipes** | il doit être membre de chacune ; la carte est calculée sur sa machine, équipe par équipe |

## 9. L'anonymat et la carte d'équipe

- **Ce qu'on garantit :** un membre ne voit jamais l'auteur d'un blob, et le serveur ne voit jamais le contenu.
- **Ce qu'on ne garantit pas :**
  - dans une équipe de 3, la **simultanéité** (« quelqu'un bloque sur le remboursement » pendant que Léa est sur Crisp) peut trahir la personne. VISION.md l'accepte déjà pour les petites équipes ;
  - les **adresses IP** chez l'opérateur.
- **Le seuil de la carte** (`max(3, 20 %)`, des fourchettes, à la semaine) est appliqué **côté client**, puisque chaque membre peut déchiffrer toutes les signatures. C'est une règle d'affichage, pas une garantie cryptographique. Le risque reste faible, puisqu'une signature ne contient ni nom ni texte. Une vraie garantie demanderait une agrégation par le serveur, qui verrait alors les données : hors sujet pour le week-end.

## 10. Le temps réel

- **Interroger le serveur toutes les 2 à 3 s** (`list_blobs` depuis le dernier `seq`) suffit : environ 100 à 300 ms par appel vers une région UE, et quelques blobs par heure.
- **Supabase Realtime** est possible plus tard, avec un canal par équipe au nom dérivé de K (donc impossible à deviner), mais il demande des rôles et des politiques RLS en plus. Il n'est pas nécessaire pour la démo du cas n° 9 (la panne partagée entre deux machines).

## 11. L'exploitation

| Sujet | Recommandation |
| --- | --- |
| **Région** | UE (Paris `eu-west-3` ou Francfort) : c'est le RGPD, et la latence est meilleure |
| **Offre gratuite** | largement suffisante. Mais **le projet se met en pause après 7 jours d'inactivité** : à relancer avant la démo de dimanche |
| **Secrets** | l'URL et la clé `anon` sont publiques par conception (dans `.env`). **La clé `service_role` ne va jamais dans le code ni sur les postes** |
| **RGPD, CSE, DPO** | Supabase est sous-traitant, mais ne voit que du chiffré. C'est un argument pour l'analyse d'impact (`ClientProfile.md`) |
| **Suppression** | `delete_team` (effacement) ; la purge nocturne garantit la rétention |
| **Windows et WSL** | rien de particulier : du `fetch` en HTTPS, et le trousseau dans `~/.config` côté WSL |

## 12. La migration vers Screenpipe

- L'interface `TeamStore` reste la même ; seule l'implémentation change.
- Les solutions sont déjà au format `team-memory` : quand Screenpipe permettra aux **membres** d'écrire dans la mémoire d'équipe (aujourd'hui, seul l'admin pousse), on remplace `SupabaseStore` par un `ScreenpipeTeamStore`.
- C'est la proposition n° 1 d'Andrea à Screenpipe (§8), et un bon message pour le jury : « on a construit sur Supabase ce qui manque à Teams, au même format, prêt à basculer ».

## 13. Le prototype (`teamstore/`)

| Fichier | Contenu |
| --- | --- |
| `schema.sql` | les tables, les 6 fonctions RPC, les droits et la rétention. À coller dans l'éditeur SQL de Supabase |
| `crypto.ts` | HKDF, AES-GCM avec données associées, rembourrage, liens d'invitation, Ed25519 |
| `store.ts` | `TeamStore`, `SupabaseStore` (RPC seulement, sans `supabase-js`), et la classe `Team` (`create`, `join`, `publish`, `pull`, `rotate`) |
| `test.ts` | 22 tests de bout en bout |
| `local-db.sh` | Postgres 16 + PostgREST dans Docker, avec un rôle `anon`, comme Supabase |

```bash
cd teamstore && ./local-db.sh up && bun test.ts && ./local-db.sh down
```

**Résultat :** 22 réussis, 0 échoué. Ce qui est couvert :
- deux équipes et leur isolation ;
- l'invitation ;
- la lecture en clair par un membre, et l'absence d'auteur ;
- un faux jeton refusé ;
- un serveur qui ne voit que du chiffré, avec des tailles identiques ;
- les données associées (pas de changement de type, pas de rejeu dans une autre équipe, pas de modification) ;
- la rotation (nouvelle époque, ancien jeton refusé en lecture comme en écriture, membres réinvités, anciens blobs ignorés, écriture avec l'ancienne époque refusée, réservée à l'admin) ;
- la certification Ed25519 ;
- les types inconnus et les blobs trop gros, refusés.

Accès direct vérifié : `GET /blobs`, `GET /teams`, `POST /blobs` et l'appel à la fonction interne `_hash` répondent tous **401, permission refusée**.

## 14. Le plan d'implémentation

| Étape | Contenu | Durée | Qui (proposition) |
| --- | --- | --- | --- |
| 1 | Créer le projet Supabase (région UE) et coller `schema.sql` | 15 min | une personne, avec le compte de l'équipe |
| 2 | Relancer `test.ts` **contre le vrai projet** (`TEAMSTORE_URL`, `TEAMSTORE_ANON_KEY`, `TEAMSTORE_REST_PATH=/rest/v1`) | 10 min | idem |
| 3 | Brancher `Team` dans le démon d'Andrea : `solutions.ts` lit `pull()`, la publication suit le consentement, les demandes partent anonymes | 1 à 2 h | Andrea (auteur du démon) |
| 4 | Commandes `creer-equipe`, `rejoindre <lien>` et `rotation` dans le démon, et le trousseau en `chmod 600` | 1 h | idem |
| 5 | Une équipe « Démo » avec la population synthétique, et une équipe réelle à 3 | 30 min | carte et démo |
| 6 | Le test de démo du cas n° 9 : une solution publiée sur la machine A, la notification sur la machine B en moins de 5 s | 30 min | tout le monde |

## 15. Questions pour le groupe

1. Valide-t-on « **aucun accès direct aux tables, uniquement des RPC avec un jeton d'équipe** » à la place de la clé de projet commune ?
2. L'invitation : un **lien avec la clé dans le fragment**, ou le **QR code avec une phrase secrète**, plus démonstratif sur scène ?
3. Au départ d'un membre, **re-chiffre-t-on les solutions** pour les membres restants, ou les laisse-t-on expirer ?
4. Les **règles signées par le responsable** : dans la démo, ou sur la feuille de route ?
5. Qui crée le projet Supabase, et avec quel compte ? La clé `service_role` reste chez cette personne seule.
