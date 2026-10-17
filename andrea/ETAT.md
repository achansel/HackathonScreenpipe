# ÉTAT — friction-assist (17/10, fin de matinée)

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
- Jamais lancée en continu sur une vraie journée : uniquement rejeu de l'historique et épisodes injectés.
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

**Avant la démo**
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
- [ ] Étiqueter à la main des épisodes réels (`andrea/daemon/.state/labels.human.json`), puis `apprendre`, lire `rapport`, `approuver` si c'est mieux.
- [ ] Remplacer les 5 solutions fictives (`solutions.seed.json`) par de vraies règles, ou laisser les partages s'accumuler ; tenir `owner` et `reviewed` à jour.
- [ ] Jouer les scénarios de UseCase.md en conditions réelles (`--debug`) et noter ce qui rate.

**Documents d'équipe**
- [ ] Fusionner `andrea/VISION.md` dans `VISION.md` après validation ; y corriger : bouton `api` vers notre serveur (passe par le relais), « le texte ne quitte pas la machine » (part vers le modèle choisi), « sans fork » (un correctif Mac proposé upstream).

**Sécurité**
- [ ] Régénérer le mot de passe Supabase après le hackathon (il a circulé en clair) et mettre à jour `team.env` sur chaque poste.

## Questions à poser à Louis / Ezra

1. Appeler `/v1/chat/completions` depuis un programme externe : d'accord, et quel quota sur l'accès Business ?
2. Écriture par les membres dans la mémoire d'équipe (pour remplacer Supabase) ?
3. Un bouton `callback` (POST local sans la clé, traité en Rust) — ou notre correctif `api` sur Mac en PR ?
4. Bugs constatés : panneau Windows vide, agent des pipes (`pi-subagents`), `filter_pii` sans effet, aucun événement d'écran sur `/ws/events`.
