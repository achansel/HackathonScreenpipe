# friction-assist : une friction ne se paie qu'une fois

Agent local construit sur [Screenpipe](https://screenpipe.com) pendant le hackathon « Build Agents That Remember » (42 Entrepreneurs × Screenpipe, Paris, 16–18 octobre 2026). Équipe : Andrea, Minguk, Haytham.

> **English summary.** friction-assist is a local agent on top of Screenpipe's API. It notices when an employee is stuck on a process step (searching, going back and forth, asking for help), shows the solution a colleague already found as a Screenpipe notification, asks the team anonymously when nobody has it, and gives the manager a Live View of *where* the process hurts, never *who*. Everything the user sees lives in Screenpipe (notifications, Live Views, the model gateway); team memory is end-to-end encrypted, with no identity stored. Bun + TypeScript, no native code. Install: Screenpipe app + Bun, then `scripts/screenpipe-env.sh`, `bun andrea/daemon/main.ts activer`, `bun andrea/daemon/main.ts`. Reproduce the demo: [docs/demo.md](docs/demo.md). How Screenpipe is used: [docs/screenpipe.md](docs/screenpipe.md). What works, measures and limits: [docs/etat.md](docs/etat.md). Docs are in French.

## Le problème

Léa, arrivée il y a deux semaines au support de PipingTable, cherche un client dans HubSpot : 0 résultat. Elle cherche dix minutes, demande sur Slack, attend. Demain, Yasmine fera exactement pareil. La règle (« il écrit avec une autre adresse que celle du contrat : chercher par le nom ») vit dans la tête de Karim, trois ans de maison, et n'est écrite nulle part.

## Ce que fait l'agent

1. **Il voit la friction.** Screenpipe enregistre l'écran ; l'agent découpe l'activité en épisodes et demande au modèle choisi dans Screenpipe si l'employé bloque sur une étape de process (recherche, aller-retour, demande d'aide…).
2. **Il apporte la solution déjà trouvée**, dans une notification Screenpipe : la règle qu'un collègue a partagée, ou la fiche du client retrouvée par son nom dans HubSpot. Boutons [Ça m'a aidé] / [Pas ça].
3. **Il demande à l'équipe, anonymement**, quand personne sur ce poste n'a la réponse : seulement l'étape, ni le nom de l'employé, ni celui du client. Le collègue qui sait reçoit « Un collègue bloque » et clique [Partager].
4. **Il se souvient.** La nuit, chaque poste relit ce qui a suivi une friction restée sans réponse ; l'IA écrit une règle sans nom, la responsable la **certifie** d'un clic (signature que personne d'autre ne peut fabriquer).
5. **Il montre où ça coince**, dans deux Live Views Screenpipe : « Frictions de l'équipe » (détours par étape, en fourchettes, jamais par personne) et « Mon agent, en direct » (ce que fait l'agent de ce poste, étape par étape, avec ce que lit l'équipe à côté de ce que voit le serveur).

Tout ce que l'utilisateur voit vit dans Screenpipe : notifications, Live Views, modèle. Le dépôt n'est pas un fork : il utilise l'API locale de Screenpipe ([docs/screenpipe.md](docs/screenpipe.md)).

## Vie privée

- Rien ne lit l'écran sans un consentement explicite (`activer`) ; `pause` coupe tout.
- Le texte d'un épisode ne quitte le poste que vers le modèle choisi dans Screenpipe, identifiants évidents masqués. Aucun texte d'écran sur disque.
- L'équipe ne reçoit que des blocs chiffrés (AES-256-GCM, clé d'équipe qui ne quitte jamais les postes), sans auteur. Le serveur ne voit ni qui, ni quoi.
- On compte des détours par étape de process, jamais par personne.

## Installation

Prérequis : l'app [Screenpipe](https://screenpipe.com) (Windows ou Mac, enregistrement actif) et [Bun](https://bun.sh). Sous Windows, le code tourne dans WSL (`networkingMode=mirrored` dans `~/.wslconfig`) ; Screenpipe reste côté Windows.

```bash
git clone <ce dépôt> && cd HackathonScreenpipe
scripts/screenpipe-env.sh && source ~/.config/screenpipe/env   # jeton et URLs de Screenpipe, hors dépôt
bun andrea/daemon/main.ts activer        # consentement, une fois
bun andrea/daemon/main.ts test-notif     # une notification doit s'afficher
bun andrea/daemon/main.ts carte-installer   # les deux Live Views
bun andrea/daemon/main.ts                # l'agent
```

L'agent tourne seul avec sa mémoire locale (`andrea/daemon/solutions.seed.json` : les règles de démo de PipingTable). Il part en veille si Screenpipe est fermé et reprend seul.

### Une équipe (facultatif)

La mémoire d'équipe est un stockage de blocs chiffrés ([teamstore/](teamstore/README.md)) : Supabase, ou un serveur local pour essayer.

```bash
bun teamstore/local-server.ts            # serveur local, port 3001 (à laisser tourner)
mkdir -p ~/.config/friction-assist && cat > ~/.config/friction-assist/team.env <<'EOF'
export FRICTION_TEAMSTORE_URL=http://127.0.0.1:3001
export FRICTION_TEAMSTORE_ANON_KEY=
EOF
chmod 600 ~/.config/friction-assist/team.env && source ~/.config/friction-assist/team.env
bun teamstore/cli.ts verifier
bun andrea/daemon/main.ts equipe-creer Support        # affiche un lien d'invitation : à transmettre en privé
bun andrea/daemon/main.ts equipe-rejoindre "<lien>"   # sur le poste d'un collègue
```

Avec Supabase : coller `teamstore/schema.sql` puis `teamstore/migrations/*.sql` dans l'éditeur SQL, mettre l'URL du projet et la clé publique dans `team.env`.

### Sur une seule machine

`bun teamstore/cli.ts equipe-demo` crée l'équipe « Support » avec deux postes simulés, puis :

```bash
FRICTION_REQUEST_JITTER=0 bun andrea/daemon/main.ts simuler
bun andrea/daemon/main.ts injecter lea "Quelqu'un sait si on peut offrir un geste commercial à un client premium ?"
```

Léa n'a pas la réponse : demande anonyme, Karim reçoit « Un collègue bloque », [Partager], l'aide arrive chez Léa.

## Reproduire la démo

Le déroulé complet (Crisp → HubSpot → fiche client en 10 s, demande anonyme, partage, certification de nuit, Live Views), l'environnement fictif PipingTable et les replis : **[docs/demo.md](docs/demo.md)**.

## Organisation du dépôt

| Dossier | Contenu |
| --- | --- |
| [andrea/daemon/](andrea/daemon/) | **L'agent** : épisodes, qualification par le modèle, notifications et boutons, équipe (demande, partage, certification), Live Views |
| [andrea/offline/](andrea/offline/) | Apprentissage hors ligne : étiquettes, génération d'un détecteur en code la nuit. **Évolution, pas dans la démo** |
| [andrea/screenpipe-patch/](andrea/screenpipe-patch/) | Correctif Screenpipe pour que les boutons `api` marchent sur Mac (PR à proposer) |
| [teamstore/](teamstore/) | Mémoire d'équipe chiffrée (client, serveur local, schéma Supabase), boucle de nuit, tableau d'équipe |
| [minguk/](minguk/) | Les yeux et les oreilles : lecture de Crisp et des appels via Screenpipe, fiche HubSpot ; l'environnement de démo PipingTable (HubSpot, Slack, Notion, clients Crisp) ; studio de notifications et film |
| [docs/](docs/) | Démo, usage de Screenpipe, état et mesures, clients Crisp |
| [scripts/](scripts/) | `screenpipe-env.sh` |

Les dossiers portent le nom de leur auteur principal ; la branche `main` garde les documents de travail et le parcours guidé web de Haytham.

## Tests

```bash
bun test andrea/                          # agent et apprentissage
cd minguk && bun install && bun test      # lecture de Crisp, HubSpot, notifications
./teamstore/tests.sh                      # stockage chiffré (local), boucle de nuit, circuit du démon
```

## Commandes de l'agent

`bun andrea/daemon/main.ts <commande>` : `activer`, `pause`, `reprendre`, `statut`, `test-notif`, `carte-installer`, `carte`, `equipe-creer`, `equipe-rejoindre`, `equipe-liste`, `equipe-rotation` (départ d'un membre : nouvelle clé), `equipe-certifier`, `simuler`, `injecter`, `desactiver`. Option `--debug` pour voir le texte des épisodes. Variables : `FRICTION_MODEL` (`claude-opus-5`), `FRICTION_MIN_CONFIDENCE` (0,72), `FRICTION_SCOPE` (applis lues), `FRICTION_CRISP=0`, `FRICTION_CALL=0`.
