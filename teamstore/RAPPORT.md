# Rapport — teamstore : la mémoire d'équipe chiffrée de friction-assist

> **Auteur :** Haytham (avec Claude). **Date :** 17 octobre 2026, soir. **Où :** `teamstore/` sur `main`, et la branche `haytham/teamstore`.
> **Périmètre :** le partage entre collègues (stockage chiffré, équipes, certification), les outils de démonstration et de répétition, la boucle de nuit, les tests et mesures.
> Tout est dans `teamstore/`. Le code d'Andrea (`andrea/`) et de Minguk (`minguk/`) est **lancé ou importé, jamais modifié** depuis la consigne du 17/10. Exception antérieure, signalée à l'équipe : des ajouts dans 5 fichiers de `andrea/daemon/` pour brancher le démon sur ce stockage. Ses tests passent.
> Documents détaillés : [README.md](README.md) (mode d'emploi), [DEMO.md](DEMO.md) (place dans la démo), [MESURES.md](MESURES.md) (tests et chiffres), [FICHE.md](FICHE.md) (technique), [CONCEPTION.md](CONCEPTION.md) (analyse de départ).

## 1. Le problème et la réponse

Les règles de travail vivent dans la tête des anciens. La documentation est fausse ou périmée : dans PipingTable, Notion dit « 2 mois offerts », Slack dit « 1 mois ». Chaque nouveau perd du temps sur les mêmes blocages.

friction-assist voit le blocage grâce à Screenpipe (le démon d'Andrea, la lecture Crisp de Minguk) et apporte la solution d'un collègue. **Ce module est le tuyau et la mémoire entre les collègues :**
- une demande **anonyme** part à l'équipe quand personne n'a la réponse sur le poste ;
- la réponse revient, puis **reste** dans la mémoire d'équipe ;
- la responsable **certifie** les règles officielles ;
- la nuit, la mémoire **se nourrit seule** à partir de ce que les gens ont trouvé.

Et tout cela **sans que le serveur puisse lire quoi que ce soit, ni savoir qui a bloqué**.

## 2. Ce qui a été construit

| Brique | Fichiers | Ce qu'elle fait |
| --- | --- | --- |
| **Stockage chiffré** | `crypto.ts`, `client.ts`, `schema.sql`, `local-server.ts` | Le chiffrement se fait sur le poste (AES-256-GCM). Chaque équipe a sa clé, transmise dans le lien d'invitation après le `#`. Tous les blocs ont la même taille, et chaque bloc est lié à son équipe et à son type. Pas d'auteur ni d'heure précise. Supabase n'expose aucune table : seulement 6 fonctions protégées par un jeton d'équipe. Le stockage local (SQLite) reproduit exactement Supabase, sans Docker. |
| **Équipes** | `client.ts` | Plusieurs équipes par personne, avec routage par périmètre (une demande Crisp va au Support, une remise aux Ventes). Changement de clé quand quelqu'un part : les solutions, les signatures et les demandes encore en attente sont conservées. Certification par la responsable (signature Ed25519, infalsifiable). Purge. |
| **Branchement du démon d'Andrea** | `andrea/daemon/teamstore.ts` (ajout antérieur), `daemon.test.ts` | Même interface `TeamStore` : son circuit demande → partage → aide marche sur ce stockage. Commandes `equipe-creer`, `equipe-rejoindre`, `equipe-rotation`, `equipe-certifier`. Sa carte d'équipe est alimentée par ce stockage. |
| **Pages** | `demo/` | Quatre entrées. **Parcours guidé** : la journée de Léa en 8 chapitres. **Équipe simulée** : 5 postes, scénario en 10 étapes, vue opérateur et 3 attaques. **Mon poste** : l'usage réel, chacun sur sa machine. **Répétition** : la régie. |
| **Profils et environnement de Minguk** | `demo/app.ts`, `demo/parcours.ts` | Les 5 collègues de PipingTable (Léa, Claire Morin, Karim Bensaïd, Antoine Rey, Sarah Lambert), chacun avec les règles qu'il donne dans le Slack de Minguk. Les frictions de la journée de Léa. |
| **Détection Crisp de Minguk** | `start.sh moi --crisp` | Son `CrispWatcher` et son `classify`, importés : un vrai message client devient une friction. À utiliser seulement **sans** le démon, pour respecter « un seul décideur » (choix d'Andrea). |
| **Escalade Slack de Minguk** | `demo/escalade.ts` | Une demande sans réponse devient sa notification « 💬 Slack + message » : le bon canal PipingTable et un message prêt à coller. |
| **Tableau « Frictions en direct »** | `demo/board.ts`, `demo/friction-live.liveview.json` | Demandes en attente (avec leur durée), résolues (délai médian), règles certifiées, étapes et leur état, fil en direct, propositions de la nuit. Affiché dans les pages **et** publié dans une **Live View Screenpipe**. La responsable est alertée (notification Screenpipe) quand une demande attend trop longtemps. |
| **Régie de répétition** | `regie.ts`, `demo/regie-page.ts` | Elle suit le déroulé d'Andrea (`andrea/docs/demo.md`) avec les **vrais outils**, et coche chaque étape quand la **vraie réaction** arrive : notification Screenpipe affichée, clic, action du démon, bloc d'équipe. Elle mesure les délais. Elle ne lit pas l'écran et ne décide rien. |
| **Boucle de nuit** | `nuit.ts`, `start.sh nuit`, migration | L'idée de Minguk. Elle relit dans Screenpipe les 15 minutes qui ont suivi chaque friction sans réponse. Si la personne s'en est sortie, l'IA écrit la règle générale (sans nom), qui devient une **proposition** chiffrée. La responsable la **certifie le matin** dans « Mon poste ». Sinon, une **friction en attente** est publiée. |
| **Lancement** | `start.sh`, `start.cmd`, `start.ps1`, `start.ts` | Une commande sur Mac, Linux, WSL et Windows. Bun est proposé à l'installation s'il manque. Sous-commandes : `moi`, `--heberger`, `--serveur`, `verifier`, `carte`, `equipe-demo`, `nuit`. |
| **Tests et mesures** | `test.ts`, `daemon.test.ts`, `nuit.test.ts`, `board.test.ts`, `nuit-eval.ts`, `perf.ts`, `tests.sh` | Voir la section 4. |

Volume : environ 3 200 lignes de TypeScript, 15 commits sur `main` (`5d8aa2e` → `82a797d`).

## 3. Infrastructure

- **Supabase de l'équipe (UE)**, créé le 17/10 :
  - schéma installé, puis deux correctifs : droits par défaut retirés à `anon` et `authenticated` ; type « proposition » pour la boucle de nuit ;
  - l'URL et la clé publique sont partagées en message privé, jamais dans le dépôt ;
  - la clé `service_role` n'a jamais quitté le tableau de bord.
- **Sur chaque poste** : `~/.config/friction-assist/team.env` (droits 600). Le démon d'Andrea et les pages utilisent le même fichier.
- **À faire après le hackathon** : supprimer le projet Supabase (l'offre gratuite le met en pause après 7 jours d'inactivité).

## 4. Tests et mesures (détail : [MESURES.md](MESURES.md))

| Quoi | Résultat | Preuve |
| --- | --- | --- |
| Tests unitaires (boucle de nuit, tableau) | **35/35**, sans réseau ni modèle | [mesuré] |
| Bout en bout du stockage | **41/41** en local et sur Supabase | [mesuré] |
| Circuit du démon d'Andrea sur ce stockage | **8/8** en local et sur Supabase | [mesuré] |
| Tests d'Andrea / de Minguk, inchangés | 23/23 / 118/118 | [mesuré] |
| Boucle de nuit, vrai modèle (`claude-opus-5`) | précision et rappel **1,00** sur 20 cas, puis sur **8 cas réservés** ; **0 fuite** ; **3,1 s** par jugement | [mesuré], étiquettes écrites par Claude |
| Supabase | écrire 32 ms, relire 30 blocs 46 ms, **un membre voit la publication d'un autre en 59 ms** | [mesuré] |
| Chiffrement | 41 µs par bloc | [mesuré] |
| Chaîne réelle avec la régie (démon en simulation, vraie IA, page, Supabase) | recherche → aide : **3 s** ; question → demande anonyme : **3 s** ; partage → aide chez Léa : **7 s** | [mesuré] |
| Navigateur (Chrome piloté par script) | parcours, équipe simulée, deux postes reliés par le réseau, régie : aucune erreur JavaScript | [mesuré] |

**Défauts trouvés et corrigés grâce aux tests :**
- **Supabase** donnait l'exécution des fonctions à `anon` par défaut : une fonction interne restait appelable.
- **Blocs de taille différente** : la taille trahissait une règle certifiée.
- **Changement de clé** : il effaçait les signatures (la carte repartait de zéro) et les demandes encore en attente.
- **Carte d'Andrea** : elle restait vide sur ce stockage, faute de date.
- **« Mon poste » en mode démo** n'était pas sur Supabase, et ne voyait donc pas les demandes des démons.
- **Filtre d'anonymat** : les téléphones français passaient, et « max » était pris pour le prénom Max, ce qui bloquait la règle du geste commercial.

## 5. Choix faits, et pourquoi

| Choix | Pourquoi |
| --- | --- |
| Aucun accès direct aux tables, un jeton par équipe | La clé publique Supabase est forcément dans chaque client. L'ancien mode, avec l'adresse Postgres et son mot de passe sur chaque poste, donnait accès à toutes les équipes. |
| La clé dans le lien d'invitation, après le `#` | Le navigateur ne l'envoie jamais à un serveur. Le lien se partage en message privé. |
| Changement de clé avec republication | Quelqu'un part sans que l'équipe perde sa mémoire. |
| Certification par la responsable | Distinguer la règle officielle d'un tuyau ; répondre au problème de la doc périmée. |
| Pas d'auteur, pas d'heure, tailles égales | Dans une équipe de 5, l'heure ou la longueur d'un message suffisent à deviner qui l'a écrit. |
| La boucle de nuit propose, l'humaine valide | L'IA n'écrit rien dans la mémoire d'équipe sans la responsable. |
| S'aligner sur `andrea/docs/demo.md` | Un seul décideur (le démon), un seul document de référence pour la démo. |
| Ne plus modifier le code des autres | Consigne du 17/10 : on importe ou on lance leur code, on ne le change pas. |

## 6. Limites connues

**Non testé :**
- **la boucle de nuit sur une vraie journée** : il faut un poste avec le démon activé ;
- **le rendu des Live Views dans l'app** : l'API ne permet pas de relire leur contenu ;
- **Windows** sur une vraie machine (`start.cmd`).

**Mesures à prendre avec précaution :**
- les étiquettes de l'évaluation sont écrites par Claude, sur 28 cas courts ;
- les tirages répétés sont mis en cache par Screenpipe.

**Fonctionnement :**
- l'IA du démon formule une même étape de plusieurs façons, et le tableau peut la compter en double (la carte d'Andrea les regroupe avec l'IA) ;
- si la responsable perd ses clés, personne ne peut changer la clé ni certifier : il manque des co-responsables ;
- « Ça m'a aidé » n'est pas partagé avec l'équipe ;
- un changement de clé est séquentiel (environ 40 s pour 1 000 blocs) ;
- l'opérateur du stockage voit les adresses IP et le rythme des requêtes ;
- deux pages ouvertes publient tour à tour la même Live View.

## 7. Suite proposée

1. **Faire jouer** la régie de répétition sur les vrais postes (démon de Léa activé, Karim sur Screenpipe patché), et coller les comptes rendus dans le canal de l'équipe.
2. **Mesurer la boucle de nuit** sur une vraie session : `./teamstore/start.sh nuit --depuis HH:MM`.
3. **Co-responsables et transfert** de la clé admin.
4. **Partager « Ça m'a aidé »** (type `vote`, déjà prévu dans le schéma).
5. Pour le pitch : la slide « cette nuit, 3 règles trouvées, 1 étape à documenter ; Claire certifie le matin ».

## Pour essayer

```bash
git pull && ./teamstore/start.sh          # accueil : parcours guidé, équipe simulée, mon poste, répétition
./teamstore/tests.sh --supabase           # tous les tests
./teamstore/start.sh nuit --exemple       # la boucle de nuit sur l'exemple préparé (vraie IA)
```
