# teamstore : la mémoire d'équipe chiffrée

Ce que l'agent partage avec l'équipe (demandes anonymes, solutions, signatures pour la carte, certifications, propositions de la nuit) passe par un stockage de **blocs chiffrés côté poste**. Le serveur ne voit ni le contenu, ni l'auteur : une table `blobs` sans colonne d'identité, AES-256-GCM avec une clé d'équipe qui ne quitte jamais les postes, et des fonctions RPC qui vérifient une empreinte de jeton. Aucun accès direct aux tables.

| Fichier | Rôle |
| --- | --- |
| `schema.sql`, `migrations/` | Le schéma Supabase (Postgres + RPC). À coller dans l'éditeur SQL. |
| `local-server.ts` | Les 6 mêmes fonctions sur un fichier SQLite, sans compte : `bun teamstore/local-server.ts` (port 3001 ; `--heberger` pour l'équipe sur le même réseau). |
| `crypto.ts`, `client.ts` | Clés d'équipe, invitation, chiffrement, signature de certification (clé de la responsable), rotation de clé ; une équipe vue d'un poste. Utilisés par l'agent (`andrea/daemon/teamstore.ts`). |
| `nuit.ts` | La boucle de nuit : pour chaque friction restée sans réponse, relit dans Screenpipe les 15 minutes qui ont suivi, et l'IA propose une règle sans nom (bloc `candidate`), que la responsable certifie depuis une notification. |
| `board.ts` | Le tableau d'équipe (en attente, résolues, certifiées, fil) qui alimente la Live View « Frictions de l'équipe ». |
| `cli.ts` | `verifier` (le stockage est-il prêt), `nuit [--exemple]`, `equipe-demo` (deux postes simulés). |

## Mettre en place

```bash
bun teamstore/local-server.ts                     # ou Supabase : schema.sql + migrations/*.sql
cat > ~/.config/friction-assist/team.env <<'EOF'   # chmod 600 ; jamais dans le dépôt
export FRICTION_TEAMSTORE_URL=http://127.0.0.1:3001   # ou https://<projet>.supabase.co
export FRICTION_TEAMSTORE_ANON_KEY=                   # clé publique Supabase, vide en local
EOF
source ~/.config/friction-assist/team.env && bun teamstore/cli.ts verifier
```

Puis, côté agent : `bun andrea/daemon/main.ts equipe-creer Support` (la responsable) et `equipe-rejoindre "<lien>"` (les membres). Le lien d'invitation contient la clé de l'équipe : à transmettre en privé. `equipe-rotation Support` change la clé après un départ : l'ancien membre ne lit plus rien, les autres reçoivent un nouveau lien.

## Ce que garantit le serveur

- Il ne stocke que `seq, team, kind, epoch, ciphertext` et des empreintes de jetons.
- Lecture et écriture exigent le jeton d'accès de l'équipe ; rotation et purge exigent le jeton de la responsable.
- Une certification est une signature Ed25519 de la responsable, vérifiée sur chaque poste : personne d'autre ne peut la fabriquer.
- Les blocs expirent (demandes : 1 jour, solutions : 180 jours).

## Tests et mesures

```bash
./teamstore/tests.sh              # unitaires (nuit, tableau), bout en bout sur le serveur local, circuit de l'agent
./teamstore/tests.sh --supabase   # + les mêmes sur le Supabase de team.env
bun teamstore/nuit-eval.ts        # boucle de nuit avec le vrai modèle (résultats : mesures/)
bun teamstore/perf.ts --local     # performance du stockage
```

Résultats enregistrés dans [mesures/](mesures/) ; synthèse dans [docs/etat.md](../docs/etat.md).
