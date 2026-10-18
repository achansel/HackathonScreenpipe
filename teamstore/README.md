# teamstore

Stockage de blocs chiffrés côté poste pour ce que l'agent partage : demandes anonymes, solutions, signatures pour la carte, certifications, propositions de la nuit. Le serveur voit `seq, team, kind, epoch, ciphertext` et des empreintes de jetons. Pas de colonne auteur, pas d'accès direct aux tables : tout passe par des RPC qui vérifient le jeton. AES-256-GCM, clé d'équipe dans le lien d'invitation, jamais sur le serveur. Certification = signature Ed25519 de la responsable, vérifiée sur chaque poste.

| Dossier | Contenu |
| --- | --- |
| `client/` | `crypto.ts` (clés, invitation, chiffrement, signature), `index.ts` (une équipe vue d'un poste : publier, relire, rotation). Utilisé par `agent/teamstore.ts`, la boucle de nuit et le dashboard. |
| `server/` | `schema.sql` + `migrations/` (Supabase : Postgres + RPC, à coller dans l'éditeur SQL) ; `local-server.ts` (mêmes 6 RPC sur SQLite, sans compte : `bun teamstore/server/local-server.ts`, port 3001, `--heberger` pour écouter sur le réseau) ; `local-db.sh` (Postgres + PostgREST en Docker, pour tester le vrai schéma). |
| `nuit/` | `index.ts` : boucle de nuit, relit dans Screenpipe les 15 min après chaque friction sans réponse, l'IA propose une règle sans nom (bloc `candidate`), certifiée depuis une notification. `eval.ts` : évaluation avec le vrai modèle. |
| `board/` | Tableau d'équipe (attente, résolues, certifiées, fil) → Live View « Frictions de l'équipe ». |
| `cli.ts` | `verifier`, `nuit [--exemple [--cas <libellé>]] [--depuis HH:MM] [--lien <lien>] [--sans-publier]`, `equipe-demo`. |
| `tests/` | `tests.sh` lance tout : unitaires (`nuit.test.ts`, `board.test.ts`), bout en bout sur le serveur local (`e2e.ts`), circuit de l'agent (`daemon.test.ts`). |
| `mesures/` | Résultats (`*.json`) et `perf.ts`. |
| `dashboard/` | Pages web : ébauche et démo, voir [dashboard/README.md](dashboard/README.md). |

## Mise en place

```bash
bun teamstore/server/local-server.ts               # ou Supabase : server/schema.sql + server/migrations/*.sql
[ -f ~/.config/friction-assist/team.env ] || printf 'export FRICTION_TEAMSTORE_URL=http://127.0.0.1:3001\nexport FRICTION_TEAMSTORE_ANON_KEY=\n' > ~/.config/friction-assist/team.env   # chmod 600
source ~/.config/friction-assist/team.env && bun teamstore/cli.ts verifier
bun agent/main.ts equipe-creer Support             # lien à transmettre en privé
bun agent/main.ts equipe-rejoindre "<lien>"        # chez un membre
bun agent/main.ts equipe-rotation Support          # départ : nouvelle clé, nouveau lien, l'ancien membre ne lit plus rien
```

TTL des blocs : demandes 1 jour, votes/signatures/candidats 30, solutions/certifications 180.

## Tests et mesures

```bash
./teamstore/tests/tests.sh              # nuit + board (35), bout en bout sur le serveur local (41), circuit de l'agent (8)
./teamstore/tests/tests.sh --supabase   # idem sur le Supabase de team.env
./teamstore/tests/tests.sh --ia         # + boucle de nuit avec le vrai modèle
bun teamstore/mesures/perf.ts --local
```
