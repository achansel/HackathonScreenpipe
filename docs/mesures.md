# Mesures

Tout ce qui est chiffré ailleurs dans le dépôt vient d'ici. Pour chaque nombre : la méthode, le fichier source, ce qu'il ne dit pas. Les scripts de `docs/mesures/` se relancent sans réseau.

## 1. Détection : le modèle juge-t-il bien un épisode ?

**Jeu.** 172 épisodes réels enregistrés par Screenpipe sur un poste Windows le 17/10 entre 15:50 et 17:10, pendant une session de scénarios joués à la main dans Crisp, HubSpot et Slack (boîte fictive PipingTable). 26 frictions (13 recherches, 9 demandes d'aide, 3 parcours, 1 tâtonnement), 146 épisodes de travail normal. Les épisodes eux-mêmes (texte d'écran) restent sur le poste ; le dépôt contient fenêtre, vérité, prédiction, confiance et latence : `docs/mesures/detection-<modèle>.json`.

**Étiquettes.** 22 posées à la main (relues par Claude), 150 posées par Claude (Opus) avec la feuille des scénarios comme contexte, puis relues par un humain. Ce n'est pas une vérité terrain indépendante : le même type de modèle a étiqueté et est évalué.

**Méthode.** Chaque épisode passe par `agent/qualify.ts` (la consigne de production) avec les solutions de démo, 4 modèles de la passerelle Screenpipe, un tirage par épisode. Une alerte compte si le modèle dit « friction » avec une confiance ≥ seuil. Recalcul : `bun docs/mesures/detection.ts`.

| Modèle | Seuil 0,70 | **Seuil 0,72** (prod) | Seuil 0,75 | Seuil 0,80 | Médiane | p90 |
| --- | --- | --- | --- | --- | --- | --- |
| claude-opus-5 | P 0,54 · R 0,50 | **P 0,71 · R 0,46** (12 justes, 5 fausses, 14 manquées) | P 0,89 · R 0,31 | P 0,89 · R 0,31 | 2,6 s | 4,3 s |
| claude-fable-5 | P 0,57 · R 0,50 | P 0,71 · R 0,46 | P 0,89 · R 0,31 | P 0,89 · R 0,31 | 2,9 s | 4,2 s |
| claude-sonnet-5 | P 0,48 · R 0,46 | P 0,56 · R 0,35 | P 0,56 · R 0,35 | P 0,64 · R 0,27 | 1,8 s | 2,5 s |
| claude-haiku-4-5 | P 0,41 · R 0,50 | P 0,41 · R 0,50 | P 0,43 · R 0,50 | P 0,46 · R 0,50 | 2,4 s | 3,3 s |

**À lire avec.**
- 26 positifs seulement : une alerte juste de plus ou de moins déplace la précision de ~0,05. Les deux décimales sont une illusion de précision.
- Le seuil 0,72 a été choisi sur ce même jeu. Il est optimiste ; entre 0,70 et 0,75 la précision d'Opus va de 0,54 à 0,89, le rappel de 0,50 à 0,31.
- Un tirage par épisode : le modèle n'est pas déterministe (voir § 3).
- `claude-haiku-4-5` n'est pas dans la liste autorisée de la passerelle : il a été utilisé via un remplacement silencieux. Retenu pour mémoire, pas comme candidat.

## 2. Mots-clés : le classifieur déterministe sur le message client

`integrations/src/assist/crisp-assist.ts` (`classify`) : regex sur le texte du message client, utilisé au début comme décideur, gardé comme lecteur. 15 messages : 10 du script de la démo, 5 hors script. Relancer : `bun docs/mesures/mots-cles.ts`.

| | Juste | Détail |
| --- | --- | --- |
| Script, 5 messages qui attendent une aide | 4/5 | manque « les rappels SMS sont inclus dans notre contrat ? » (offre) |
| Script, 5 messages sans aide attendue | 5/5 | silence, correct |
| Hors script, 5 messages | 0/5 | 4 mauvaises aides (« facture fausse » → prospect, « erreur de ma part » → bug, « devis formation » → prospect, « SMS Toulon » → bug), 1 manqué |

C'est pourquoi le classifieur ne décide plus : juste sur ce qu'on lui a écrit, faux dès qu'on sort du script.

## 3. L'épisode Slack de la démo : contexte et modèle

Léa écrit dans `#support` « On peut offrir qqchose a un client premium ou quoi ? », sans solution locale pour ça. Attendu : friction, `demande_aide`, pas de solution → demande anonyme. Cinq tirages par modèle (`docs/mesures/question-slack.json`), relancé le 18/10.

| Modèle | 5 tirages |
| --- | --- |
| claude-opus-5 | 5/5 `demande_aide`, pas de solution (confiance 0,75–0,80) |
| claude-haiku-4-5 | 0/5 : 3 fois une mauvaise aide (`client-introuvable`), 2 fois « pas de friction » |

Contexte Crisp (le 17/10, Opus, même épisode rejoué 5 fois sans puis avec le dernier message de Jean) : 2/5 → 5/5. Sur 9 autres épisodes rejoués pareil, le contexte ne change pas le verdict.

## 4. Délais de bout en bout

| Mesure | Valeur | Source |
| --- | --- | --- |
| Recherche HubSpot → notification « fiche client » | 10 s (17/10 23:43 : message Crisp lu à 23:43:24, modèle 3 s, notification 23:43:55) | journal de l'agent, Live View « Mon agent, en direct » |
| Budget typique | capture Screenpipe 1–3 s + 6 s d'attente que la recherche soit finie (`SEARCH_SETTLE_MS`) + modèle 2,6 s médiane → 10–12 s | `agent/episodes.ts`, `agent/config.ts` |
| Demande anonyme → « Un collègue bloque » chez Karim | 6,5 s (17/10 10:37:35.8 → 10:37:42.3) | `agent/.state/{lea,karim}/events.jsonl`, deux agents sur une machine (`simuler`), stockage Postgres direct de l'époque |
| [Partager] → aide chez Léa | 3,7 s (10:38:22.3 → 10:38:26.0) | idem |
| Stockage d'équipe, publication → lecture par un autre poste | Supabase p50 58,5 ms, p95 72,6 ms (10 essais, lecteur toutes les 100 ms) ; serveur local 0,5 ms | `teamstore/mesures/perf-supabase.json`, `perf-local.json` |
| Chiffrement d'un bloc (1 403 caractères) | seal p50 41 µs, open p50 31 µs | idem |

Les 6,5 s et 3,7 s sont dominés par l'intervalle de relecture de l'agent (5 s), pas par le stockage.

## 5. Boucle de nuit

`teamstore/nuit/`, claude-opus-5, 17/10. Jeu de réglage : 20 cas (10 résolus, 10 non résolus, avec des pièges : nom de client dans le contexte, doc périmée, réponse vague, bruit OCR). Jeu réservé, écrit après le réglage : 8 cas (4/4). Résultat : 28/28, aucune fuite de nom, e-mail ou téléphone dans les règles produites, p50 3,1 s. Fichiers : `teamstore/mesures/nuit-eval.json`, `nuit-eval-reserve.json` ; relancer avec `bun teamstore/nuit/eval.ts [--reserve]`.

Les 28 cas ont été écrits par nous, à partir des fils Slack de PipingTable. Ça valide la consigne et le masquage, pas la boucle sur de vraies journées.

## 6. Détecteur en code (hors démo)

`agent/offline/learn.ts`, 17/10 19:27 : 470 épisodes collectés, 448 étiquetés (276 pour générer, 172 pour tester : le jeu du § 1). Le candidat généré garde 26/26 frictions (0 manquée) mais n'écarte que 0,68 % du travail normal (1/146) : il ne filtre rien. C'est pour ça qu'il n'est pas approuvé et que la démo tourne en inférence. Source : `agent/.state/report.json` (local).

## 7. Tests automatiques

| Suite | Nombre |
| --- | --- |
| `bun test agent/` | 24 |
| `cd integrations && bun test` | 122 |
| `./teamstore/tests/tests.sh` | 35 unitaires + 41 bout en bout (serveur local) + 8 circuit de l'agent |

Tous verts au 18/10.
