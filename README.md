# Piping Company

Agent local sur l'API de [Screenpipe](https://screenpipe.com). Il repère quand quelqu'un bloque sur une étape de process (recherche, aller-retour, demande d'aide), affiche la solution qu'un collègue a déjà trouvée dans une notification Screenpipe, demande à l'équipe de façon anonyme quand personne sur le poste n'a la réponse, et montre à la responsable *où* le process coince dans une Live View, jamais *qui*. Mémoire d'équipe chiffrée de bout en bout, sans identité. Bun + TypeScript, pas de fork de Screenpipe.

Hackathon « Build Agents That Remember », 42 Entrepreneurs × Screenpipe, Paris, 16–18 octobre 2026. Équipe : [Andrea CHANSELME](https://www.linkedin.com/in/achansel), [Minguk KANG](https://www.linkedin.com/in/minguk-kang-102571258), [Haithem BOUKHORS](https://www.linkedin.com/in/haithem-boukhors-aa0a201ab).

> **English.** Local agent on Screenpipe's API: detects process friction on screen, pushes the fix a colleague already found as a Screenpipe notification, asks the team anonymously otherwise, and shows the manager *where* the process hurts in a Live View (never *who*). End-to-end encrypted team memory with no identity. Bun + TypeScript, no fork. Install: Screenpipe app + Bun, `scripts/screenpipe-env.sh`, `bun agent/main.ts activer`, `bun agent/main.ts`. Reproduce the demo: [docs/demo.md](docs/demo.md). Screenpipe usage: [docs/screenpipe.md](docs/screenpipe.md). What works and what doesn't: [docs/etat.md](docs/etat.md); numbers and how they were measured: [docs/mesures.md](docs/mesures.md). Docs are in French.

## Comment ça marche

1. `/search` toutes les secondes (OCR, frappes, accessibilité) sur les applis de travail → épisodes : fenêtre, mots nouveaux, recherche dans l'URL, délai.
2. Chaque épisode passe par la passerelle IA de Screenpipe (`claude-opus-5`) : friction ou non, type de détour, étape, confiance. Identifiants masqués avant l'envoi.
3. Friction avec solution connue → notification avec [Ça m'a aidé] / [Pas ça]. Cas « client introuvable » : la fiche HubSpot retrouvée par le nom lu dans Crisp.
4. Pas de solution → demande anonyme chiffrée à l'équipe (l'étape, rien d'autre). Celui qui sait reçoit « Un collègue bloque » → [Partager] → l'aide arrive chez le demandeur.
5. La nuit, chaque poste relit les 15 min qui ont suivi une friction sans réponse ; l'IA propose une règle sans nom ; la responsable certifie d'un clic (signature Ed25519).
6. Deux Live Views : « Frictions de l'équipe » (détours par étape, fourchettes) et « Mon agent, en direct » (la trace de l'agent du poste, avec ce que lit l'équipe à côté de ce que voit le serveur).

Vie privée : rien ne lit l'écran sans `activer` ; `pause` coupe tout ; aucun texte d'écran sur disque ; le serveur d'équipe ne stocke que des blocs chiffrés sans auteur ; on compte des détours par étape, pas par personne.

## Installation

Prérequis : l'app Screenpipe (Windows ou Mac, enregistrement actif) et [Bun](https://bun.sh). Sous Windows, le code tourne dans WSL avec `networkingMode=mirrored` dans `~/.wslconfig`.

```bash
scripts/screenpipe-env.sh && source ~/.config/screenpipe/env   # jeton + URLs Screenpipe (chmod 600, hors dépôt)
bun agent/main.ts activer          # consentement, une fois
bun agent/main.ts test-notif       # une notification doit s'afficher
bun agent/main.ts carte-installer  # les deux Live Views
bun agent/main.ts                  # l'agent (--debug : texte des épisodes dans le journal)
```

Seul, l'agent utilise sa mémoire locale (`agent/solutions.seed.json`, les règles de la boîte fictive PipingTable).

### Équipe

Stockage de blocs chiffrés : Supabase, ou un serveur local SQLite pour essayer ([teamstore/](teamstore/README.md)).

```bash
bun teamstore/local-server.ts                        # port 3001, à laisser tourner
mkdir -p ~/.config/friction-assist && printf 'export FRICTION_TEAMSTORE_URL=http://127.0.0.1:3001\nexport FRICTION_TEAMSTORE_ANON_KEY=\n' > ~/.config/friction-assist/team.env
chmod 600 ~/.config/friction-assist/team.env && source ~/.config/friction-assist/team.env
bun teamstore/cli.ts verifier
bun agent/main.ts equipe-creer Support      # lien d'invitation (contient la clé : à transmettre en privé)
bun agent/main.ts equipe-rejoindre "<lien>" # poste d'un collègue
```

Supabase : coller `teamstore/schema.sql` puis `teamstore/migrations/*.sql` dans l'éditeur SQL ; URL du projet et clé publique dans `team.env`.

### Une seule machine

```bash
bun teamstore/cli.ts equipe-demo            # équipe « Support », postes Léa et Karim
FRICTION_REQUEST_JITTER=0 bun agent/main.ts simuler
bun agent/main.ts injecter lea "Quelqu'un sait si on peut offrir un geste commercial à un client premium ?"
```

Léa n'a pas la règle → demande anonyme → Karim reçoit « Un collègue bloque » → [Partager] → aide chez Léa. Rien ne lit l'écran dans ce mode.

## Dépôt

| Dossier | Contenu |
| --- | --- |
| [agent/](agent/) | L'agent : épisodes, qualification, notifications et relais des clics, équipe (demande, partage, certification), Live Views. `offline/` : étiquettes et détecteur généré en code la nuit (**pas dans la démo**). |
| [teamstore/](teamstore/) | Mémoire d'équipe chiffrée : client, serveur local, schéma Supabase, boucle de nuit, tableau d'équipe. `dashboard/` : pages web (parcours guidé, équipe simulée, mon poste), **ébauche et démo**. |
| [integrations/](integrations/) | Lecture de Crisp et des appels via Screenpipe, fiche HubSpot, environnement fictif PipingTable (HubSpot, Slack, Notion, clients Crisp), simulateur de clients, studio de notifications. |
| [screenpipe-patch/](screenpipe-patch/) | Correctif Screenpipe : boutons `api` sur Mac. |
| [docs/](docs/) | [demo.md](docs/demo.md), [screenpipe.md](docs/screenpipe.md), [etat.md](docs/etat.md), [mesures.md](docs/mesures.md) (chiffres, méthode, scripts à relancer), [crisp.md](docs/crisp.md). |
| [pitch/](pitch/) | Film de 2 min (11 scènes animées sur de vraies captures). |

## Tests

```bash
bun test agent/                               # 24
cd integrations && bun install && bun test    # 122
./teamstore/tests.sh                          # 35 unitaires + 41 bout en bout (serveur local) + 8 circuit de l'agent
```

## Commandes de l'agent

`bun agent/main.ts` + `activer | pause | reprendre | statut | test-notif | carte-installer | carte | equipe-creer | equipe-rejoindre | equipe-liste | equipe-rotation | equipe-certifier | simuler | injecter | desactiver`.
Variables : `FRICTION_MODEL` (`claude-opus-5`), `FRICTION_MIN_CONFIDENCE` (0,72), `FRICTION_SCOPE` (applis lues), `FRICTION_CRISP=0`, `FRICTION_CALL=0`, `FRICTION_REQUEST_JITTER` (délai d'anonymat, `10-60` s par défaut).

<sub>ham</sub>
