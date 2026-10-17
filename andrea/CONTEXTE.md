# CONTEXTE — reprise de session (17/10)

> À lire en premier par une nouvelle session. Détails : [ETAT.md](ETAT.md) (ce qui tourne, limites, à faire), [PROPOSITION.md](PROPOSITION.md) (architecture), [docs/demo.md](docs/demo.md).

## Le projet

Hackathon Screenpipe (42 Paris, 16–18/10, finale dimanche : 3 min de démo + 2 min de questions ; note : 30 % intégration Screenpipe, 30 % innovation, 20 % « marche en direct », 20 % pitch). **friction-assist** : repère une friction de process, apporte la solution qu'un collègue a déjà trouvée (notification Screenpipe), demande anonymement à l'équipe sinon, apprend la nuit, alimente une carte d'équipe. On mesure le process, jamais la personne. Cas d'usage : support client Crisp + HubSpot + Slack (journée de Léa, `UseCase.md` à la racine).

## Décisions prises (ne pas rouvrir)

- Code et docs d'Andrea dans `andrea/` ; les fichiers d'équipe à la racine ne sont pas modifiés (proposition de VISION dans `andrea/VISION.md`).
- Détection agnostique (pas de règle propre à une appli pour classer) ; apprentissage **hors ligne**, détection rapide en direct.
- **Détecteur écrit en code la nuit : évolution prévue, figée et hors démo (17/10 au soir)** ; en direct, tout passe par l'inférence. Détail : ETAT.md § « Évolution prévue ».
- IA via la passerelle de Screenpipe (`/v1/chat/completions`, `claude-haiku-4-5`), cloud « comme Screenpipe » ; messages clients lisibles ; debounce sur la frappe.
- **Choix techniques pour la démo (boutons, Mac patché, autorité du démon sur le code de Minguk)** : fixés dans [docs/demo.md § Choix techniques](docs/demo.md#choix-techniques-pour-la-démo-fixés-le-1710-ne-pas-rouvrir). Ne pas rouvrir.
- Retour par nos propres boutons [Ça m'a aidé] [Pas ça] (les 👍/👎 Screenpipe sont cachés sous Windows).
- Partage entre collègues = cœur du produit. Stockage d'équipe **Supabase temporaire**, blocs chiffrés côté client, aucune identité ; cible : mémoire d'équipe Screenpipe.
- Carte : on compte des détours, une seule personne peut faire apparaître une étape.
- Vocabulaire Screenpipe des frictions (`type` waiting/switching/rework/handoff/unclear, `control` direct/influence/external/required) + notre `detour`.
- Démo sous Bun (pas d'exécutable). Délai d'anonymat : 10–60 s (0 en démo/simulation).
- Pitch : « tout ce que l'utilisateur voit vit dans Screenpipe ; notre agent n'utilise que leur API ouverte (leur vision : context layer for AI agents) ; 3 évolutions proposées pour l'embarquer » (pipe « code », écriture membres dans la mémoire d'équipe, bouton `callback` / `api` sur Mac).

## Environnement (poste Windows d'Andrea, code dans WSL)

- WSL `networkingMode=mirrored` : `127.0.0.1` partagé avec Windows. Screenpipe tourne sous Windows (app 2.7.109, moteur 0.4.52). Bun 1.4.3 dans WSL.
- Secrets **hors dépôt** (droits 600) : `~/.config/screenpipe/env` (jeton, via `scripts/screenpipe-env.sh`), `~/.config/friction-assist/team.env` (`FRICTION_DATABASE_URL`, pooler IPv4 `aws-0-eu-west-1` : l'hôte direct Supabase est IPv6 seul), `~/.config/friction-assist/team.key` (clé d'équipe). Ne jamais les commiter ni les afficher.
- Avant toute commande : `source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env`.
- Git : remote SSH ; la signature GPG échoue en non interactif → `git commit --no-gpg-sign` (accepté par Andrea). Andrea veut que je commite et pousse.
- Code source Screenpipe : cloner `github.com/screenpipe/screenpipe` (lu à `30b50bb`, `main` du 16/10) pour vérifier un comportement plutôt que supposer.

## Faits Screenpipe vérifiés (mesurés ou lus dans le code)

- `/search` : retard ~1 s ; une page courte n'est pas la fin (déduplication) ; `content_type=input` = changements d'appli/fenêtre (~2 s) ; texte tapé visible via « typing pause ».
- `/ws/events` : aucun texte d'écran. Pipes : agents `pi`/`acp` seulement ; triggers `pipe_completed:<pipe>`, réunions, workflows, connexions. **Agent des pipes en panne sur ce poste** (`pi-subagents … toToolDeclaration`).
- Notifications : `/notify` 200 ≠ affichée (panneau Windows parfois vide → relancer l'app) ; anti-doublon 90 s ; `api` limité au port 3030 ; Mac : `api` non traité en Rust.
- Relais : `PUT /connections/n8n/instances/<nom>` + `POST /connections/n8n/proxy?instance=<nom>` → vers `127.0.0.1:PORT`, sans `Authorization` **[mesuré]**.
- Live View : `PUT /live-views/:id` ; un client local remplit un bloc via `POST /outputs/targets/:id/submit` avec `source_pipe`, sans pipe.
- `filter_pii` sans effet chez nous. App fermée → 409 `search_only`.
- Firefox : texte d'accessibilité parfois d'un autre onglet, `browser_url` périmé → Chrome. Titres parfois attribués à une autre appli.

## Où on en est (17/10, 20 h)

- **Ouverture de la démo jouée en direct, réussie** (19:14) : Jean écrit (Crisp) → Léa colle son adresse dans HubSpot, « 0 contacts » → fiche « Client : Jean Dupont · Le Bistro · Premium » avec [Y aller]. Déroulé exact et cases à cocher : `docs/demo.md`.
- Démon : **`claude-opus-5`, seuil 0,72** (haiku n'est pas autorisé par la passerelle, il était remplacé en silence). Éval sur 172 épisodes : précision 0,71, rappel 0,46. Lecture Crisp de Minguk branchée (contexte du dossier, fiche HubSpot), corrigée pour Windows (OCR et accessibilité). Recherches dans l'URL = épisodes. Demandes anonymes seulement sur question explicite, ancrées dans le texte. Détails et limites : `ETAT.md`.
- Étiquettes de référence : 22 d'Andrea + 150 de Claude (`andrea/daemon/.state/labels.human.json`, origine dans `labels.provenance.json`) : **pas une vérité humaine**, le dire.
- Détecteur écrit en code la nuit : **figé, hors démo**.
- Tests : `bun test andrea/` 23/23, `cd minguk && bun test` 118/118.

## Prochaines étapes

1. **Répéter l'ouverture avec opus-5** (jamais rejouée avec ce modèle) : Jean écrit (`scratchpad` : `send-one.ts`, ou simulateur de Minguk `--sans-aide`), recherche collée, fiche attendue.
2. **Demande anonyme → Karim partage, sur deux vraies machines** (jamais joué) ; Mac : correctif compilé par Minguk (`reponse-minguk.md`).
3. Slide « nos chiffres » pour Louis (éval, limites, « notifier peu, compter beaucoup »).
4. Voir la carte à l'écran (`screenpipe://live-view/friction-map`).
5. Après le hackathon : régénérer le mot de passe Supabase et la clé HubSpot (passée en clair dans la conversation).

## Façon de travailler avec Andrea

Français, concis, « de dev à dev ». Vérifier dans le code/les mesures plutôt qu'empiler des hypothèses ; dire clairement ce qui est mesuré ou non. Pas d'emoji ni de « ! » dans les textes produits par l'outil (règle de design Screenpipe).
