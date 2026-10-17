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

La page s'ouvre toute seule dans le navigateur. **Ctrl+C** dans le terminal arrête tout.

> Pour les notifications Screenpipe réelles, l'app Screenpipe doit être ouverte. Sinon, les notifications s'affichent seulement dans la page.

## Trois façons de l'utiliser

### 1. Seul, pour comprendre ou présenter : la démo PipingTable

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

Une seule personne prépare le projet, une fois (environ 10 minutes) :

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
4. **Bloquer.** « Je bloque sur… » propose des frictions préparées, ou « Autre… » pour décrire une étape. La décrire **sans nom ni donnée client**.
5. **Aider.** Une demande arrive dans « Demandes de l'équipe » :
   - si j'ai déjà la solution : **Partager** ;
   - sinon : **Je sais : répondre**, et je l'écris.
6. **Certifier** (responsable seulement) : le bouton « Certifier » sur une solution reçue.
7. **Quelqu'un part** (responsable seulement) : « Quelqu'un part : changer la clé », puis envoyer le nouveau lien **aux membres restants seulement**.

Les clés restent **dans le navigateur** de chacun. « Oublier mes clés » les efface de ce navigateur.

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

## Pour aller plus loin

- [FICHE.md](FICHE.md) : ce qui a été construit, les choix, les tests, les limites.
- [CONCEPTION.md](CONCEPTION.md) : l'analyse de départ (modèle de menace, alternatives).
- Tests :
  - `bun teamstore/local-server.ts`, puis dans un autre terminal `cd teamstore && bun test.ts` (38 tests) ;
  - `./teamstore/daemon-test.sh` (circuit du démon, 7 tests).
