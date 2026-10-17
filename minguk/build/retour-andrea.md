# Retour de Minguk sur le démon d'Andrea : pour fusionner nos deux visions

> 17 octobre, fin d'après-midi. Lu : `andrea/ETAT.md`, `CONTEXTE.md`, `PROPOSITION.md`, `offline/`, `pipes/`, et `teamstore/DEMO.md` de Haytham.
> But : qu'on parte en démo avec **un seul parcours**, et que chacun voie où sa brique s'emboîte.

## En bref

- **On vise la même chose** : la journée de Léa, la même boucle (repérer → aider → demander anonymement → se souvenir → carte), le même vocabulaire d'étapes.
- **Ton démon est le cerveau générique** (détection sans règle par appli, IA, équipe, apprentissage de nuit, carte). **Mes briques sont la partie « ça marche à coup sûr devant le jury »** sur le cas d'ouverture : lecture de Crisp, fiche HubSpot, aides prêtes, simulateur.
- **Trois points à trancher** avant la répétition : les boutons (`api` + correctif = fork), la détection du cas d'ouverture, et un seul envoi des notifications.
- **Une idée pour la nuit** qui ferait de ta collecte une vraie mémoire qui se nourrit seule (section 4).

## 1. Ce qui est fort dans ce que tu construis

- **Détection agnostique + qualification par l'IA**, mesurée en direct (geste commercial, prospect belge, remise 20 %), avec les limites écrites honnêtement (ETAT). C'est exactement « une aide sans prompt » qui parlera à Louis.
- **L'apprentissage de nuit avec porte de validation et approbation humaine** : c'est la bonne philosophie (« fixed code, not AI-generated instructions »), et c'est rare dans un hackathon.
- **Le partage d'équipe mesuré** (7 s → « Un collègue bloque », 4 s → aide), et le refus de Slack comme bus pour ne pas identifier Léa : très juste.
- **La carte en Live View** remplie par l'API, sans pipe : une surface Screenpipe de plus pour la note d'intégration.
- **Le niveau de preuve** ([mesuré] / [code] / [non testé]) : ça nous évite de nous raconter des histoires.

## 2. Où mes briques s'emboîtent

| Brique | Ce qu'elle fait | Preuve |
| --- | --- | --- |
| Lecture de Crisp (`minguk/src/detect/`) | nouveau message client : nom, texte **complet**, depuis la liste et la conversation ouverte ; compteur de non-lus vu même depuis l'onglet HubSpot | **[mesuré]** ~1 s après la capture, sur 4 vraies captures en test |
| Fiche HubSpot (`minguk/src/assist/hubspot-lookup.ts`) | retrouve Jean Dupont **par son nom** alors qu'il écrit avec une autre adresse (et que Screenpipe masque les e-mails : `[EMAIL]`) | **[mesuré]** sur le HubSpot PipingTable |
| Aides 🧭 💬 📘 (`minguk/src/notify/`) | gabarits vérifiés pour le panneau Mac, une notification à la fois, plafond, gestion du filtre anti-doublon 90 s, clics suivis par une redirection locale (`link`), 👍/👎 lus dans `/feedback` | **[mesuré]** sur Mac, test-mac B/C/D |
| Simulateur (`bun run simulate`) | Jean, Élodie, Pieter… écrivent dans la vraie boîte Crisp, en un clic ; affiche le délai de détection | **[mesuré]** de bout en bout : message « panne » → 🧭 Jean Dupont · Le Bistro + 💬 #bugs à l'écran |
| Environnement PipingTable | 30 clients HubSpot, 5 canaux Slack et 24 messages, 4 pages Notion dont une périmée | en place |

## 3. Trois points à trancher

**a. Les boutons : `link` plutôt que `api` + correctif.**
Le correctif Mac (`screenpipe-patch/`) est une modification de Screenpipe : c'est un fork, ce qui contredit « tout dans Screenpipe, sans fork » (30 % de la note). Sur Mac non patché, `api` ne fait rien (**[mesuré]**, test-mac A), alors que `link` marche partout (B). Haytham a d'ailleurs fait passer [Partager] par un lien. Proposition : `link` vers une redirection locale pour tous les boutons, et le correctif présenté comme **une des 3 évolutions proposées à Screenpipe**, pas utilisé en démo.

**b. Le cas d'ouverture : la détection de Crisp en premier, l'IA pour le reste.**
ETAT le dit : la recherche HubSpot à 0 résultat (le cas d'ouverture) n'a **jamais été jouée**, et le modèle varie d'un tirage à l'autre (1/5 puis 5/5). Pour les 30 premières secondes devant le jury, je propose que le message Crisp soit le déclencheur (déterministe, ~1 s, avec le nom du client), et que ton démon qualifie tout ce qui n'est pas Crisp (question Slack, recherche HubSpot, remise). Concrètement : ma lecture de Crisp peut te fournir des épisodes déjà nommés, ou mon assistant tourne à côté sur le même poste.

**c. Un seul envoi des notifications.**
Ton démon construit ses propres notifications, moi aussi. Deux producteurs = deux styles, et le filtre anti-doublon de 90 s de Screenpipe qui peut en manger une. Proposition : ton démon décide **quoi** aider, mon notifieur gère **comment** l'afficher (`requestHelp(episode)` : gabarit, file, suivi des clics et des 👍/👎). Haytham a déjà importé mes gabarits sans rien changer : ça marche.
Pour les retours : sur Mac, les 👍/👎 natifs fonctionnent (**[mesuré]**, test D, commentaire compris) ; sous Windows, tes [Ça m'a aidé] [Pas ça]. À choisir par système, plutôt que d'ajouter deux boutons partout (le panneau en tient 3).

## 4. Une idée pour la nuit : la mémoire qui se nourrit seule

Ta nuit améliore aujourd'hui **la détection**. Avec la même collecte, elle pourrait aussi construire **les solutions** :

1. Pour chaque friction de la journée, l'IA lit les minutes **après** le signal : la personne s'en est-elle sortie, et comment (un fil Slack, une page, un chemin dans HubSpot) ? C'est le champ « résolution » de VISION, étape 3.
2. **Résolue** → une **solution candidate** (au format team-memory), en attente de certification par le responsable. Le lendemain matin, Claire certifie en un clic : elle devient l'aide de toute l'équipe.
3. **Non résolue** → une **friction en attente**, envoyée au responsable du process avec les preuves (VISION, étape 7 : « la demande de correction au responsable »). Exemple : « Geste commercial : 7 détours cette semaine, la page Notion dit 2 mois, le fil Slack dit 1 mois ».

Tout le reste existe déjà chez toi (collecte, étiquettes, porte de validation, approbation humaine). Pour dimanche : au moins **une slide**, ou un exemple préparé (« cette nuit : 3 solutions trouvées, 1 friction en attente pour Claire »). C'est la phrase qui fait passer « Agents That Remember » de l'idée au produit.

## 5. Ma proposition pour la démo

Un seul parcours, chacun sa brique, en partant du DEMO.md de Haytham :

| Temps | Ce qu'on voit | Brique |
| --- | --- | --- |
| 0:15 | Jean écrit dans Crisp (simulateur) | Minguk |
| 0:20 | 🧭 **Jean Dupont · Le Bistro · Premium**, [Y aller] → sa fiche HubSpot | Minguk (lecture Crisp + fiche) |
| 0:50 | « je veux un dédommagement » : rien en cache → **demande anonyme** → Karim [Partager] → l'aide arrive | Andrea (démon, équipe) + Haytham (stockage chiffré) |
| 1:30 | Claire **certifie** la règle ; le Notion périmé à côté | Haytham |
| 1:50 | **Carte des frictions** | Andrea |
| 2:10 | Ce que voit le serveur : des blocs illisibles | Haytham |
| 2:30 | Vie privée, sans fork, la nuit qui construit la mémoire (slide) | tous |

## Questions pour toi

1. D'accord pour `link` partout en démo, et le correctif `api` en « évolution proposée » ?
2. Tu préfères recevoir mes épisodes Crisp dans ton démon, ou que mon assistant tourne à côté pour l'ouverture ?
3. La « nuit qui construit les solutions » : c'est ce que tu avais en tête ? Si oui, qui écrit la slide ?
4. Quelle machine pour Léa le jour J : ton Windows (démon) ou mon Mac (Crisp mesuré, pas de correctif) ?
