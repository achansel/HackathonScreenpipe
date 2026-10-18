# teamstore

Stockage de blocs chiffrés côté poste pour ce que l'agent partage : demandes anonymes, solutions, signatures pour la carte, certifications, propositions de la nuit. Le serveur voit `seq, team, kind, epoch, ciphertext` et des empreintes de jetons. Pas de colonne auteur, pas d'accès direct aux tables : tout passe par des RPC qui vérifient le jeton. AES-256-GCM, clé d'équipe dans le lien d'invitation, jamais sur le serveur. Certification = signature Ed25519 de la responsable, vérifiée sur chaque poste.

| Fichier | Rôle |
| --- | --- |
| `schema.sql`, `migrations/` | Supabase (Postgres + RPC). À coller dans l'éditeur SQL. |
| `local-server.ts` | Mêmes 6 RPC sur SQLite, sans compte. `bun teamstore/local-server.ts` (3001 ; `--heberger` : écoute sur le réseau). |
| `crypto.ts`, `client.ts` | Clés, invitation, chiffrement, signature, rotation. Utilisés par `agent/teamstore.ts`. |
| `nuit.ts` | Boucle de nuit : relit dans Screenpipe les 15 min après chaque friction sans réponse, l'IA propose une règle sans nom (bloc `candidate`), certifiée depuis une notification. |
| `board.ts` | Tableau d'équipe (attente, résolues, certifiées, fil) → Live View « Frictions de l'équipe ». |
| `cli.ts` | `verifier`, `nuit [--exemple] [--depuis HH:MM] [--sans-publier]`, `equipe-demo`. |
| `dashboard/` | Pages web : ébauche et démo, voir [dashboard/README.md](dashboard/README.md). |
| `mesures/`, `perf.ts`, `nuit-eval.ts` | Mesures (latence, boucle de nuit avec le vrai modèle). |

## Mise en place

```bash
bun teamstore/local-server.ts                      # ou Supabase : schema.sql + migrations/*.sql
printf 'export FRICTION_TEAMSTORE_URL=http://127.0.0.1:3001\nexport FRICTION_TEAMSTORE_ANON_KEY=\n' > ~/.config/friction-assist/team.env   # chmod 600
source ~/.config/friction-assist/team.env && bun teamstore/cli.ts verifier
bun agent/main.ts equipe-creer Support             # lien à transmettre en privé
bun agent/main.ts equipe-rejoindre "<lien>"        # chez un membre
bun agent/main.ts equipe-rotation Support          # départ : nouvelle clé, nouveau lien, l'ancien membre ne lit plus rien
```

TTL des blocs : demandes 1 jour, votes/signatures/candidats 30, solutions/certifications 180.

## Tests

```bash
./teamstore/tests.sh              # nuit + board (35), bout en bout sur le serveur local (41), circuit de l'agent (8)
./teamstore/tests.sh --supabase   # idem sur le Supabase de team.env
bun teamstore/nuit-eval.ts        # boucle de nuit, vrai modèle
bun teamstore/perf.ts --local
```
