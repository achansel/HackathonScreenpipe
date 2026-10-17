# ÉTAT — friction-assist (17/10, après-midi)

> Ce qui tourne, comment le lancer, ce qui coince, ce qu'il reste à faire **à la main**.
> Détails techniques : [PROPOSITION.md](PROPOSITION.md). Niveau de preuve : **[mesuré]** sur le poste Windows d'Andrea, **[code]** lu dans le code Screenpipe, **[non testé]**.

## En une phrase

Un daemon local par poste repère une friction de process, apporte la solution qu'un collègue a déjà trouvée (par une notification Screenpipe), demande anonymement à l'équipe quand personne n'a la réponse, apprend la nuit à mieux filtrer, et alimente une carte d'équipe dans Screenpipe. Rien n'identifie qui bloque.

## Ce qui tourne

| Étape | Code | Preuve |
| --- | --- | --- |
| 1. Aide en direct | `daemon/` | **[mesuré]** notification du daemon → clic bouton `api` → relais Screenpipe → daemon (nonce vérifié) ; faux clic refusé (403) ; qualification juste sur 3 cas fictifs, 2–3 s |
| 2. Partage d'équipe | `daemon/team.ts`, `daemon/teamstore.ts` | **[mesuré]** 2 daemons (Léa, Karim) : demande anonyme → « Un collègue bloque » chez Karim en 7 s → Partager → aide chez Léa 4 s après → solution gardée en cache. Supabase ne voit que des blocs chiffrés, sans identité, RLS active |
| 3. Apprentissage hors ligne | `offline/`, `pipes/` | **[mesuré]** rejeu de l'historique (210 épisodes en 4 s) ; détecteur généré : 97 % des frictions conservées, 15 % du travail normal écarté ; porte de validation + approbation humaine. Pipes installables ; **leur exécution échoue sur ce poste** (agent Screenpipe en panne) → repli à 3 h dans le daemon |
| 4. Carte d'équipe | `daemon/map.ts`, `daemon/steps.ts` | **[mesuré]** Live View « Carte des frictions » (5 blocs) remplie par l'API sans pipe ; libellés d'étape regroupés par le modèle (3 libellés « pipeline » → 1 étape). **Pas encore vue à l'écran** |
| Préparation démo | `daemon/solutions.seed.json`, `docs/demo.md` | 8 solutions tirées de la journée de Léa ; clients Crisp Jean Dupont et Lucas Peeters ; `FRICTION_SEED_IDS` pour choisir les solutions de départ d'un poste ; déroulé de 3 min avec replis |
| Retours et étiquettes | `daemon/main.ts`, `offline/learn.ts`, `offline/main.ts` | boutons **[Ça m'a aidé] [Pas ça]** visibles d'emblée **[mesuré]** ; clics et demandes résolues deviennent des étiquettes pour l'apprentissage (« Pas ça » ignoré : ambigu) ; `etiqueter` pour la référence humaine ; dès 20 étiquettes humaines, le détecteur est jugé sur elles |
| Anonymat et fatigue | `daemon/team.ts` | délai aléatoire 10 à 60 s avant de publier une demande (0 en simulation / démo) ; 5 sollicitations « Partager ? » max par jour et par personne |
| Robustesse | `daemon/screenpipe.ts` | Screenpipe fermé ou injoignable → veille, nouvel essai toutes les 30 s |
| Tests | `daemon/*.test.ts`, `offline/*.test.ts` | `bun test andrea/` : **15 tests** (chiffrement, découpage, périmètre, Firefox, masquage, bac à sable, étiquettes d'usage) |
| Correctif Mac | `screenpipe-patch/` | **[non testé]** boutons `api` traités en Rust ; sur Mac non patché, le clic n'arrive pas **[mesuré]** |

## Lancer (racine du dépôt)

```bash
source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env
```

| But | Commande (`bun andrea/daemon/main.ts …`) |
| --- | --- |
| Une fois par poste | `activer`, `relais`, `equipe-init --cle <clé d'équipe>`, `carte-installer` |
| Lancer | (sans argument), `--debug` pour voir le texte des épisodes |
| Couper | `pause` / `reprendre`, `desactiver` |
| Simuler l'équipe sur une machine | `simuler`, puis `injecter lea "…"` |
| Carte | `carte` ; démo : `peupler-demo` / `nettoyer-demo` |
| Hors ligne (`bun andrea/offline/main.ts …`) | `collecter`, `apprendre`, `rapport`, `approuver`, `installer-pipes` |

Secrets **hors dépôt**, droits 600 : `~/.config/screenpipe/env` (jeton), `~/.config/friction-assist/team.env` (URL de la base, avec mot de passe), `~/.config/friction-assist/team.key` (clé d'équipe). État local : `andrea/daemon/.state/` (ignoré par git).

## Limites connues

**Détection**
- Lancée en direct le 17/10 après-midi (écran d'Andrea) : scénario Jean/Julien puis 10 scénarios étiquetés à la main, jamais sur une vraie journée. Bien détectés : question Slack « on peut offrir… premium ? » (`geste-commercial`), prospect belge (`prospect-chat`), remise 20 % (`remise-15`), adresse de facturation (aucune solution → demande anonyme) ; clics reçus. **Jamais joué : une recherche HubSpot à 0 résultat** (le cas d'ouverture de la démo) — les « client introuvable » vus étaient des recherches **réussies** (« jean », « luc ») lues comme des échecs.
- Rejeu 15:10–16:06 avec 5 tirages par épisode clé (ancienne → nouvelle consigne) : vrais positifs 16/20 → 18/20, faux positifs 25/45 → 15/45. Le modèle varie d'un tirage à l'autre (même épisode : 1/5 puis 5/5 juste).
- Reste : l'historique Slack chargé d'un coup dans l'arbre d'accessibilité (220 → 750 mots) est du texte vraiment nouveau ; s'il contient une question (de l'utilisateur ou d'un collègue), le modèle peut la qualifier. Donner le nom de l'utilisateur au modèle a été essayé : il perd alors les messages consécutifs sans nom (remise 5/5 → 0/5), écarté.
- L'OCR attribue parfois à une fenêtre du texte d'une autre (mesuré : texte de la fenêtre Claude dans une fenêtre Crisp ou Slack).
- Première frame d'une fenêtre = référence : un message **déjà affiché** à l'ouverture d'une fenêtre (canal, conversation, page) ne déclenche rien ; seul ce qui change ensuite compte. Choix assumé (sinon l'historique d'un canal Slack devient « ta » friction). Référence = tous les mots déjà vus dans la fenêtre depuis 30 min (empreintes, pas de texte), car Slack alterne OCR et accessibilité ; chaque mot nouveau garde 4 voisins pour que la question reste lisible. Badges de non-lus ignorés dans l'identité de la fenêtre.
- Précision mesurée sur des cas synthétiques et sur les étiquettes **du modèle** : aucune étiquette humaine.
- Le détecteur appris filtre peu (15 % du travail normal écarté) : presque tout part au modèle (1–3 s, quota).
- Budget total ≈ 4–5 s de la frappe à la notification.
- Firefox : texte d'accessibilité parfois d'un autre onglet, `browser_url` périmé → Chrome conseillé. Titres de fenêtre parfois attribués à la mauvaise appli (géré : périmètre jugé sur l'appli).

**Vie privée**
- `filter_pii` ne filtre rien sur notre install : seuls e-mails, téléphones, IBAN sont masqués (regex). **Les noms passent** au modèle.
- Le texte d'un épisode part vers le modèle choisi dans Screenpipe (cloud Screenpipe ici), « comme Screenpipe ».
- Petite équipe : l'heure d'une demande peut suffire à deviner qui bloque. Le champ `owner` d'une solution est un rôle, pas un nom.
- Une seule identité de base partagée (accès administrateur) : temporaire.

**Équipe et carte**
- Supabase est temporaire ; hôte direct IPv6 seul → pooler IPv4 (`aws-0-eu-west-1`).
- Regroupement des étapes : cache **par poste** ; deux postes peuvent regrouper différemment.
- Pas de plafond de sollicitations pour celui qui a la solution (fatigue).
- La carte compte des détours, pas des personnes : une seule personne peut faire apparaître une étape (choix assumé).

**Screenpipe (côté app)**
- Panneau de notification Windows parfois **vide** alors que `/notify` répond « sent » : relancer l'app, vérifier à l'œil.
- Filtre anti-doublon : une notification identique dans les 90 s est supprimée.
- Bouton Feedback (👍/👎) caché dans le menu « … » sous Windows.
- Agent des pipes en panne sur ce poste (`pi-subagents … toToolDeclaration is not a function`).
- App fermée → le moteur répond 409 « search_only » (géré : message + nouvel essai).

## À faire à la main

**Avant la démo** (détail : [docs/demo.md](docs/demo.md))
- [ ] `FRICTION_REQUEST_JITTER=0` sur les postes de démo, et le dire au jury.
- [ ] Rouvrir Screenpipe, vérifier **à l'œil** qu'une notification de test s'affiche (panneau parfois vide).
- [ ] Ouvrir la carte (`screenpipe://live-view/friction-map`) et vérifier son rendu.
- [ ] Prévoir 90 s entre deux notifications identiques, ou varier le texte.
- [ ] Données de démo : les annoncer comme telles ; `nettoyer-demo` avant tout usage réel.
- [ ] Utiliser Chrome pour Crisp et HubSpot.

**Par poste**
- [ ] `activer`, `relais`, `carte-installer` ; `equipe-init --cle …` avec la ligne de connexion et la clé transmises **en privé**.
- [ ] Régler `FRICTION_SCOPE` sur l'outillage réel de l'équipe (par défaut : slack, crisp, hubspot, notion).

**Mac**
- [ ] Compiler Screenpipe patché (`andrea/screenpipe-patch/README.md`), redonner les permissions, refaire `andrea/docs/test-mac.md`.

**Qualité**
- [ ] Étiqueter ~40 épisodes réels : `bun andrea/offline/main.ts etiqueter` (~20 min, une touche par épisode), puis `apprendre`, lire `rapport`, `approuver` si c'est mieux.
- [ ] Les 8 solutions de `solutions.seed.json` sont fictives (scénario de démo) : les remplacer par de vraies règles pour un usage réel ; tenir `owner` et `reviewed` à jour.
- [ ] Jouer les scénarios de UseCase.md en conditions réelles (`--debug`) et noter ce qui rate.

**Documents d'équipe**
- [ ] Fusionner `andrea/VISION.md` dans `VISION.md` après validation ; y corriger : bouton `api` vers notre serveur (passe par le relais), « le texte ne quitte pas la machine » (part vers le modèle choisi), « sans fork » (un correctif Mac proposé upstream).

**Sécurité**
- [ ] Régénérer le mot de passe Supabase après le hackathon (il a circulé en clair) et mettre à jour `team.env` sur chaque poste.

## Questions à poser à Louis / Ezra

Message prêt à coller : [docs/discord.md](docs/discord.md).

1. Appeler `/v1/chat/completions` depuis un programme externe : d'accord, et quel quota sur l'accès Business ?
2. Écriture par les membres dans la mémoire d'équipe (pour remplacer Supabase) ?
3. Un bouton `callback` (POST local sans la clé, traité en Rust) — ou notre correctif `api` sur Mac en PR ?
4. Bugs constatés : panneau Windows vide, agent des pipes (`pi-subagents`), `filter_pii` sans effet, aucun événement d'écran sur `/ws/events`.
