# MESURES — teamstore (17/10, soir)

> Tests et mesures du stockage d'équipe chiffré, du tableau « Frictions en direct » et de la boucle de nuit.
>
> Niveau de preuve, comme dans [andrea/ETAT.md](../andrea/ETAT.md) :
> - **[mesuré]** sur le Mac de Haytham (Apple Silicon, Bun 1.4.3), contre le Supabase de l'équipe (UE) ou le stockage local ;
> - **[non testé]** : ce qui n'a pas été joué.
>
> Données brutes : `mesures/*.json`. Tout relancer : `./teamstore/tests.sh --supabase --ia --perf`.

## En bref

| Quoi | Résultat | Preuve |
| --- | --- | --- |
| Tests unitaires (boucle de nuit, tableau) | **35/35** (24 + 11), 30 ms, sans réseau ni modèle | [mesuré] |
| Bout en bout du stockage (`test.ts`) | **41/41** en local **et** sur Supabase | [mesuré] |
| Circuit du démon d'Andrea sur notre stockage (`daemon.test.ts`) | **8/8** en local **et** sur Supabase | [mesuré] |
| Tests d'Andrea et de Minguk (inchangés) | **23/23** et **118/118** | [mesuré] |
| Boucle de nuit, vrai modèle (`claude-opus-5`), jeu de réglage | précision **1,00**, rappel **1,00** sur 20 cas, **0 fuite** | [mesuré], étiquettes de Claude |
| Boucle de nuit, vrai modèle, **jeu réservé** | précision **1,00**, rappel **1,00** sur 8 cas, **0 fuite** | [mesuré], étiquettes de Claude |
| Temps d'un jugement de nuit | **p50 3,1 s**, p95 4,1 s (réglage) ; p50 3,2 s, p95 5,9 s (réservé) | [mesuré] |
| Supabase : écrire / relire 30 blocs | **32 ms** / **46 ms** (p50) | [mesuré] |
| Supabase : publié par un membre → vu par un autre | **59 ms** (p50), 73 ms (p95) | [mesuré] |
| Chiffrer / déchiffrer un bloc | **41 µs** / **31 µs** (p50) | [mesuré] |

## 1. Tests unitaires : `bun test ./nuit.test.ts ./board.test.ts` — 35/35

Le modèle, Screenpipe et le réseau sont simulés : on teste la logique, de façon déterministe.

**Boucle de nuit (24)** :
- **Verdict du modèle** : règle claire retenue ; sous 0,7 de confiance, en attente ; « non résolue » ; sans titre ; réponse illisible, rien n'est publié ; titre et texte tronqués (80 / 400 caractères) ; contexte borné à 8 000 caractères.
- **Anonymat** : une règle avec un prénom de collègue, un nom de client, un e-mail ou un téléphone est refusée. Le contexte passe par le masquage d'Andrea avant d'aller au modèle.
- **Frictions du jour** (`dayCases`, journal du démon) : on garde les demandes sans solution, de toutes les instances ; on écarte celles d'avant la période et celles que l'équipe a résolues ; sans journal, rien.
- **Contexte après la friction** (`contextAfter`) : outils de travail seulement (pas Spotify), dans l'ordre, sans doublon ; fenêtre exacte de 15 minutes.
- **Publication** : propositions et attentes vont à l'équipe du bon périmètre, et à aucune autre. L'id d'une règle est stable, donc pas de doublon. **Seuls** l'étape, la règle, le jour et la confiance partent : ni texte d'écran, ni nom.

**Tableau « Frictions en direct » (11)** :
- en attente et résolues ; signatures du jour seulement ; un bloc relu deux fois ne compte pas double ;
- règle certifiée ; étape formulée autrement par l'IA, mais résolue ;
- **changement de clé** : pas de double compte, et l'attente garde son heure de départ ;
- boucle de nuit : une proposition certifiée disparaît de la liste ;
- période de répétition ;
- **formats de la Live View** : les 9 blocs, list ≤ 20, titres ≤ 200 caractères.

**Défauts trouvés par ces tests, et corrigés :**
1. **Téléphones.** Le filtre d'anonymat ne reconnaissait que les numéros `+33` / `0033`. « 06 39 98 12 34 » passait.
2. **Prénoms.** Le filtre ignorait les majuscules : « 1 mois offert **max** » était pris pour le prénom **Max**. La bonne règle du geste commercial n'était donc **jamais proposée**. C'est l'évaluation avec le vrai modèle qui l'a révélé ; un test unitaire le verrouille maintenant.

## 2. Bout en bout du stockage — 41/41, local et Supabase

`bun test.ts` contre le vrai serveur : création d'équipes, invitations, isolation, routage, chiffrement et rembourrage (blocs de 1 403 caractères), données associées, certification et falsification, rotation (demandes encore en attente republiées, résolues non), purge, **boucle de nuit** (proposition publiée, relue, retirée), types refusés, **accès direct aux tables refusé (401)**.

Sur Supabase, après la migration `migrations/2026-10-17-boucle-de-nuit.sql` : **41/41**.

## 3. Boucle de nuit avec le vrai modèle — `bun teamstore/nuit-eval.ts`

- **Modèle :** celui du démon d'Andrea, via la passerelle de Screenpipe (`claude-opus-5`).
- **Question posée :** la personne s'en est-elle sortie dans les 15 minutes qui ont suivi, et quelle est la règle générale ?
- **Étiquettes :** écrites par **Claude** d'après les scénarios PipingTable. **Ce n'est pas une vérité humaine**, à dire tel quel.

### Jeu de réglage : 20 cas (10 résolues, 10 non résolues)

Les contextes contiennent volontairement des noms, des e-mails et des téléphones. Les cas « non résolue » sont des pièges :
- « je reviens vers vous » ;
- une réponse sans contenu (« demande à quelqu'un d'autre ») ;
- une personne passée à autre chose ;
- « ça dépend » ;
- un emoji pour toute réponse ;
- une exception ponctuelle ;
- du bruit d'OCR ;
- un contexte vide ;
- deux collègues en désaccord ;
- la doc périmée seule.

| Mesure | Premier passage | Après correction |
| --- | --- | --- |
| Précision / rappel | 0,90 / 0,90 | **1,00 / 1,00** |
| Erreurs | « dédommagement » refusé (faux « Max »), « exception ponctuelle » prise pour une règle | aucune |
| Fuites dans la sortie brute du modèle | 3 (toutes le faux « Max ») | **0** |
| Fuites publiées après filtre | 0 | **0** |
| Titres > 60 caractères | 1 | **0** |
| Latence d'un jugement | p50 3,2 s · p95 7,9 s | **p50 3,1 s · p95 4,1 s** |

**Corrections apportées entre les deux passages :**
- le filtre des prénoms est maintenant sensible aux majuscules ;
- la consigne dit qu'une exception accordée une seule fois n'est pas une règle.

**Biais :** cette consigne a été réglée **sur ces mêmes 20 cas**. D'où le jeu réservé.

### Jeu réservé : 8 cas (4 / 4), écrits après le réglage, jamais utilisés pour régler

Cas : changement d'offre, acompte remboursé, ajout d'un établissement, résiliation (avec un e-mail dans le contexte) ; renvoi vers une doc vide, page marquée obsolète, remise ponctuelle validée « cette fois », réponse coupée par la capture.

**Précision 1,00, rappel 1,00, 0 fuite, latence p50 3,2 s, p95 5,9 s.**

### Ce que ces chiffres ne disent pas

- **28 cas courts et propres.** Une vraie journée a plus de bruit (OCR, fenêtres mélangées) et des cas plus ambigus. Andrea mesure 0,53 de précision sur 172 vrais épisodes pour la *détection*, une tâche plus difficile. La boucle de nuit n'a **pas encore** été mesurée sur de vrais épisodes [non testé].
- **Un tirage par cas.** Les tirages répétés sont **mis en cache** par la passerelle de Screenpipe (température 0, même requête) : le 2e et le 3e passage sont revenus en 221 ms par jugement. Ils ne sont donc pas indépendants, et seul le premier passage compte pour la latence.
- **Garde-fou final :** la responsable relit et certifie chaque proposition. Rien n'entre dans la mémoire d'équipe sans elle.

### Règles produites (jeu de réglage, publiables telles quelles)

> HubSpot : voir l'offre via la fiche entreprise · Dédommagement client : 1 mois offert max selon l'offre · HubSpot : chercher par téléphone ou domaine, pas l'e-mail · Prospect chat belge : contact en Lead + post #new-leads · Bug client : poster dans #bugs + ticket HubSpot Support · Remise >15 % : validation dans le canal deal desk · Tickets HubSpot : utiliser le pipeline « Support » · Promesse commerciale : vérifier les conditions particulières · Prix des options : consulter la grille tarifaire Notion · HubSpot : chercher par nom ou domaine, pas par e-mail

## 4. Performance du stockage — `bun teamstore/perf.ts`

| Opération | Supabase (UE, depuis Paris) | Local (SQLite) |
| --- | --- | --- |
| Chiffrer un bloc (AES-256-GCM + rembourrage) | 41 µs (p95 86 µs) | 42 µs |
| Déchiffrer un bloc | 31 µs (p95 79 µs) | 32 µs |
| Dériver les clés d'une équipe (HKDF) | 0,11 ms | 0,12 ms |
| Créer une équipe | 36 ms | 0,5 ms |
| Écrire un bloc (`put_blob`) | **32 ms** (p95 57) | 0,3 ms |
| Relire 30 blocs et les déchiffrer | **46 ms** (p95 120) | 1,5 ms |
| Relire un seul type de bloc | 27 ms | 0,2 ms |
| **Publié par un membre → vu par un autre** | **59 ms** (p95 73) | 0,5 ms |
| Changement de clé (relire, tourner, republier 30 blocs) | **1,2 s** | 12 ms |

**Lecture :**
- **Le chiffrement ne coûte rien** : 0,04 ms, contre ~30 ms de réseau.
- **Le délai ressenti vient du rythme de relecture**, pas du stockage : la page relit toutes les 2 s, le démon toutes les 5 s, Screenpipe capture toutes les ~3 s, le modèle répond en ~3 s. C'est cohérent avec les **7 s** mesurés entre « Partager » et l'aide chez Léa.
- **Le changement de clé** est séquentiel (un appel par bloc) : 1,2 s pour 30 blocs, donc environ 40 s pour 1 000. C'est acceptable pour une action rare ; à paralléliser au-delà.

## 5. Répétitions mesurées avec la régie (rappel)

[mesuré] Démon d'Andrea (simulation, vraie IA), page « Mon poste » et Supabase. Délais cochés par la régie à partir des vraies notifications Screenpipe :

| Étape | Délai |
| --- | --- |
| Recherche HubSpot → aide affichée | 3 s |
| Question Slack → demande anonyme | 3 s |
| Partage → aide chez Léa | 7 s |

## Relancer

```bash
./teamstore/tests.sh                       # unitaires + bout en bout local + démon (≈ 10 s)
./teamstore/tests.sh --supabase            # + Supabase (team.env)
./teamstore/tests.sh --ia                  # + boucle de nuit avec le vrai modèle (≈ 25 s, jeton Screenpipe)
./teamstore/tests.sh --perf                # + banc de performance
```
