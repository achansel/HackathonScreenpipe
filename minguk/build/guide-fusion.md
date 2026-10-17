# Guide de fusion : les yeux et les oreilles de Minguk, le cerveau d'Andrea

> Pour la session de fusion menée par Andrea, 17–18/10. Contexte : [reponse-andrea.md](reponse-andrea.md). Choix de démo qui font foi : [andrea/docs/demo.md](../../andrea/docs/demo.md).
> Règle : **le démon décide**. Le code de `minguk/` voit, entend, retrouve le client et affiche la fiche ; il ne choisit plus l'aide.

## 1. Le principe en une image

```
 Crisp (écran) ──┐                       ┌──> aide d'équipe (démon : notification + boutons)
 Appel (voix) ───┼─> contexte du dossier ─┤
 HubSpot (écran)─┘   + épisodes ────────> qualify() du démon ──> demande anonyme (équipe chiffrée)
                                          └──> fiche client (minguk : notification [Y aller])
```

- **Contexte du dossier** : qui écrit ou appelle, sa fiche HubSpot, ce qu'il demande. Ce n'est pas une friction en soi (ton prompt : « un message de client, à lui seul, n'est pas une friction »).
- **Épisode** : un détour de Léa (recherche HubSpot à 0 résultat, allers-retours, question Slack, client qui attend). Le démon le qualifie, avec le contexte du dossier pour mieux nommer l'étape.

## 2. Inventaire de `minguk/`

| Module | Chemin | Rôle | Statut pour la fusion |
| --- | --- | --- | --- |
| Détours HubSpot | `src/detect/hubspot-detours.ts`, `bun run watch:hubspot` | recherche sans résultat, recherches successives, allers-retours → épisodes au format du démon | **prêt, à brancher** (section 3.B) |
| Lecture de Crisp | `src/detect/crisp-inbox.ts`, `crisp-watcher.ts` | nouveau message client (nom, texte complet), non-lus, conversation ouverte | **à brancher** : alimente le contexte du dossier |
| Écoute d'un appel | `src/detect/call-listener.ts` | transcription en direct d'une réunion Screenpipe (`/ws/meeting-overlay`), 3–5 s | **en attente** de la décision d'équipe sur la voix du client |
| Fiche client | `src/assist/hubspot-lookup.ts` | nom → contact, entreprise, offre, vente, URL des fiches | **à brancher** : solution « dynamique » de `client-introuvable` |
| Notifieur | `src/notify/` | gabarits vérifiés pour le panneau Mac, file (une à la fois), plafond, anti-doublon 90 s, clics par redirection `link`, 👍/👎 lus dans `/feedback` | **garder pour la fiche client seulement** |
| Mots-clés | `src/assist/crisp-assist.ts` (`classify`, `helpsFor`) | besoin lu par mots | **rétrograder** : secours si le modèle ne répond pas, jamais l'autorité |
| Assistants | `src/assist/assistant.ts`, `call-assistant.ts` | branchent capteurs → mots-clés → aides | **à remplacer** par le branchement au démon (section 3) |
| Simulateur | `src/cli/simulate.ts`, `src/sim/` | les clients écrivent dans la vraie boîte Crisp ; mesure du délai | **garder** (démo et tests), lancer avec `--sans-aide` quand le démon tourne |
| Environnement | `src/seed/`, `content/notion/` | HubSpot, Slack, Notion de PipingTable | **garder** tel quel |

## 3. Les quatre branchements

### A. Le contexte du dossier dans `qualify()`

Aujourd'hui `qualify(ep, solutions)` envoie au modèle : appli, fenêtres récentes, texte nouveau. Proposition : un argument optionnel `dossier`, ajouté en une ligne au message utilisateur.

```ts
// andrea/daemon/qualify.ts (proposition)
export async function qualify(ep: Episode, solutions: Solution[], dossier?: string): Promise<Verdict | null> {
  const user = `Solutions d'équipe :\n${catalogue}\n\n${dossier ? `Dossier en cours : ${redact(dossier)}\n` : ""}Appli : ${ep.app}\n…`;
```

Le dossier vient de la lecture de Crisp, dans `run()` du démon :

```ts
// andrea/daemon/main.ts, dans run() (proposition)
import { CrispWatcher } from "../../minguk/src/detect/crisp-watcher.ts";
let dossier: { name: string; text: string; at: number } | undefined;
const crisp = new CrispWatcher({
  screenpipeUrl: API, apiKey: KEY,
  onEvent: (e) => { if (e.kind === "message" && e.preview) dossier = { name: e.name, text: e.preview, at: e.detectedAt }; },
});
// dans la boucle, à côté de builder.ready() :
await crisp.tick().catch(() => {});
// puis qualify(ep, solutions, dossierRécent(dossier)) : « Un client attend dans Crisp : « … » »
```

Points d'attention :
- le **nom du client** est une donnée client : ton `redact` ne masque que les e-mails, téléphones et IBAN. Passer seulement le **texte** au modèle (« un client attend : … »), et garder le nom en local pour la fiche ;
- `crisp.tick()` fait **deux recherches à la suite** : en parallèle, Screenpipe répond 503 « search is busy » (mesuré). Ne pas l'appeler en même temps que les recherches du démon ;
- un dossier vieux de plus de ~10 min ne compte plus.

### B. Les détours HubSpot : prêt (17/10, 18:45)

Ton point faible mesuré : la recherche HubSpot à 0 résultat n'a jamais été capturée. Le capteur est fait : `minguk/src/detect/hubspot-detours.ts`, sur le modèle de `CrispWatcher` (un `tick()`, deux recherches Screenpipe l'une après l'autre, captures OCR de `chrome.exe` rattachées par le titre de la fenêtre sous Windows, comme ton correctif de la lecture de Crisp). Il produit **des épisodes au format de ton démon** :

| Détour de Léa | Texte de l'épisode |
| --- | --- |
| recherche sans résultat | « Recherche HubSpot dans les contacts : « jean.d@example.com » (aucun résultat). La recherche ne trouve rien. » |
| recherches successives après un échec | « Recherches HubSpot successives dans les contacts : « jean.d@example.com » (aucun résultat), puis « jean » (10 résultats). Aucune ne désigne un seul résultat. » |
| allers-retours entre fiches | « Allers-retours dans HubSpot en 20 s : contact → entreprise → transaction → contact. La même fiche est ouverte plusieurs fois. » |

**Mesuré** : rejeu de ma recherche réelle de 18:36 (`bun run watch:hubspot --rejouer 30`) → les deux premiers épisodes ; puis **ta `qualify()` telle quelle** sur ces épisodes, avec et sans dossier Crisp :

| Épisode | Verdict de ton démon |
| --- | --- |
| recherche sans résultat | friction · recherche · `client-introuvable` · 0,98 |
| recherches successives | friction · recherche · `client-introuvable` · 0,97–0,98 |
| allers-retours | friction · parcours / tâtonnement · `client-introuvable` · 0,86–0,97 (j'aurais attendu `offre-du-client` : à surveiller) |

Branchement dans `run()`, comme pour Crisp (proposition) :

```ts
import { HubSpotDetours } from "../../minguk/src/detect/hubspot-detours";
const hubspot = new HubSpotDetours({ screenpipeUrl: API, apiKey: KEY, onEpisode: (ep) => { handleEpisode(ep); } });
// dans la boucle, après crisp.tick() :
if (hubspot) await hubspot.tick().catch((e) => debug && log("HubSpot :", (e as Error).message));
```

- `handleEpisode(ep)` prend l'épisode tel quel ; ton filtre appris et `qualify()` décident.
- Le texte contient la recherche tapée (ici une adresse e-mail) : ton `redact` la masque avant le modèle.
- Mesure faite avec l'ancienne adresse Crisp de Jean (`jean.d@example.com`), qui donnait « No Contacts match » dans la liste des contacts. Tu l'as remplacée par `jd.resto75@resa-paris.test` (la recherche globale de HubSpot renvoie tous les contacts sur `@example.com`) : le capteur ne dépend pas de l'adresse, à rejouer avec la nouvelle.
- Vérifié sur Mac seulement ; sous Windows, à regarder pendant la session (`bun run watch:hubspot` sur ton poste, une recherche à 0 résultat).

### C. La fiche client comme solution « dynamique » de `client-introuvable`

Quand ton verdict donne `solution_id === "client-introuvable"` et qu'un dossier Crisp est en cours, la meilleure aide n'est pas « chercher par domaine » mais **le lien direct vers la fiche de Jean** (on connaît son nom par Crisp, et sa fiche par `hubspot-lookup.ts`, mesuré).

```ts
// andrea/daemon/main.ts, dans handleEpisode, avant notify (proposition)
if (v.solution_id === "client-introuvable" && dossier) {
  const fiche = await trouverFiche(dossier.name); // minguk/src/assist/hubspot-lookup.ts
  if (fiche) return montrerFiche(fiche);          // notification « Jean Dupont · Le Bistro » + [Y aller]
}
```

`montrerFiche` peut être mon notifieur (`createNotifier(...).requestHelp(épisode de type "path")`) ou ton `notify` avec un bouton `link` : à toi de choisir, un seul des deux.

### D. L'appel (si l'équipe garde la voix)

`listenToMeeting()` (`src/detect/call-listener.ts`) donne chaque phrase finale. Même usage que Crisp : la phrase du **client** alimente le dossier ; une phrase de **Léa** qui est une question peut devenir un épisode (`detour: demande_aide`). Rien à faire tant que la question de la voix n'est pas tranchée.

## 4. Qui envoie quelle notification

| Notification | Envoyée par | Pourquoi |
| --- | --- | --- |
| Aide d'équipe (solution, certifiée ou non) | **démon** | autorité du démon ; ses boutons [Ça m'a aidé] [Pas ça] |
| Demande anonyme, « Un collègue bloque », Partager | **démon** / page de Haytham | inchangé |
| Fiche client « Jean Dupont · Le Bistro » | **un seul** des deux (section 3.C) | pas d'équivalent chez toi |
| Aides par mots-clés (Slack, règle) | **personne** quand le démon tourne | doublons mesurés sur Élodie |

Simulateur pendant la démo : `bun run simulate --sans-aide` (il envoie les messages clients, sans aucune aide).

## 5. Noms d'étapes

Mes noms d'étape sont remplacés par les identifiants de tes solutions (`solutions.seed.json`) :

| Chez moi (à retirer) | Chez toi (fait foi) |
| --- | --- |
| `qui-est-le-client` | `client-introuvable` |
| `signaler-un-bug` | `signaler-bug` |
| `geste-commercial` | `geste-commercial` |
| `promesse-commerciale` | `promesse-commercial` |
| `nouveau-prospect` | `prospect-chat` |
| (aucun) | `offre-du-client`, `pipeline-support`, `remise-15` |

## 6. Ports, variables et secrets

| Port | Qui | Variable |
| --- | --- | --- |
| 8787 | démon d'Andrea | `FRICTION_PORT` |
| 4517 | redirection des clics de Minguk (`/go/:id`) | **`FRICTION_REDIRECT_PORT`** (renommée le 17/10 : avant, les deux lisaient `FRICTION_PORT`) |
| 4518 | simulateur Crisp | `FRICTION_SIM_PORT` |
| 4519 | redirection de `bun run call` | `FRICTION_CALL_PORT` |
| 4322 / 3001 | page « Mon poste » / stockage local de Haytham | les siennes |

| Fichier (hors dépôt, droits 600) | Contenu | Utilisé par |
| --- | --- | --- |
| `~/.config/screenpipe/env` | jeton Screenpipe | tous |
| `~/.config/friction-assist/team.env` | stockage d'équipe | démon, page de Haytham |
| `~/.config/friction/env` | `HUBSPOT_SEED_TOKEN`, `SLACK_SEED_TOKEN` | Minguk : création de l'environnement, fiche client |

Pour la fiche client sur le poste de Léa, il faut une clé HubSpot **en lecture seule** (la clé `demo-seed` peut écrire). À créer avant la démo, ou passer par la connexion HubSpot de Screenpipe.

## 7. Risques à vérifier pendant la session

| Risque | Pourquoi | Comment le vérifier |
| --- | --- | --- |
| **La lecture de Crisp n'a été mesurée que sur Mac** | Léa est sur ton Windows ; l'OCR de Windows découpe peut-être autrement les blocs de mots | lancer `bun run watch:crisp` sur ton poste, envoyer un message depuis le simulateur, regarder si « 💬 message de … » sort ; sinon, enregistrer une capture (`/frames/:id/elements`) et me l'envoyer pour un test |
| Screenpipe ne capture que **la fenêtre au premier plan** (mesuré sur Mac) | si Crisp est derrière une autre fenêtre, rien n'est vu | le client écrit depuis une autre machine ; Léa reste sur Crisp ou HubSpot (même fenêtre Chrome : le compteur de l'onglet Crisp reste lisible) |
| « Jean > Andrea » dans la liste Crisp | c'est la conversation de Jean **assignée** à Andrea, pas une réponse d'agent ; seul le prénom s'affiche | déjà géré : le nom complet est pris dans le titre quand la conversation est ouverte |
| 503 « search is busy » | trop de recherches simultanées | une recherche à la fois (section 3.A) |

## 8. Tests à garder verts

```bash
cd minguk && bun test        # 108 tests : notifications, Crisp sur 5 vraies captures, fiche, simulateur, environnement
bun test andrea/             # les tiens
# teamstore : voir teamstore/README.md
```

## 9. Ordre proposé pour la session

1. Valider la répartition et les noms d'étapes (sections 4 et 5).
2. Branchement A : la lecture de Crisp dans `run()`, le dossier passé à `qualify()`.
3. Vérifier la lecture de Crisp **sur ton Windows** (section 7).
4. Branchement C : la fiche client pour `client-introuvable`.
5. Répétition du cas d'ouverture : Jean écrit (simulateur `--sans-aide`) → Léa cherche dans HubSpot → aide.
6. Branchement B (capteur HubSpot, prêt) : quelques lignes dans `run()`, puis le cas d'ouverture complet : Jean écrit → Léa cherche → fiche de Jean.
7. Pendant ce temps, Minguk compile ton correctif Mac.

## 10. Questions ouvertes

1. Point d'entrée des épisodes externes : même processus ou `POST /episode` ?
2. La fiche client : mon notifieur ou ton `notify` ?
3. La voix du client : on la garde (local ou cloud, combien de temps) ?
4. Clé HubSpot en lecture seule : qui la crée ?
