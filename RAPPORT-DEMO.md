# Rapport démo : état au 18/10, 00:10 (finale du dimanche 18/10)

> **Référence unique pour la démo.** Ce qui marche (avec la preuve), ce qui reste à faire ce matin, ce qui est dans la démo et ce qui devient le futur, l'app de Haytham et son intégration dans Screenpipe.
> À mettre à jour après chaque changement ou répétition. Détails : [andrea/docs/demo.md](andrea/docs/demo.md) (déroulé réel), [teamstore/PITCH.md](teamstore/PITCH.md) (pitch sur le parcours guidé), [andrea/ETAT.md](andrea/ETAT.md), [teamstore/RAPPORT.md](teamstore/RAPPORT.md).

## En bref

Le cœur de la démo marche en vrai sur le poste Windows d'Andrea :
- l'agent lit le message client dans Crisp, juge la recherche HubSpot, puis affiche la fiche du client dans une notification Screenpipe ;
- la règle trouvée la nuit est certifiée depuis une notification ;
- deux Live Views montrent l'agent et l'équipe.

Il manque deux preuves en direct :
- le partage entre **deux vraies machines** sur le stockage actuel ;
- le **Mac** avec le Screenpipe patché.

Le parcours guidé de Haytham rejoue tout le récit de bout en bout, sans erreur. Il sert aux vidéos et au pitch.

## 1. Ce qui marche (vérifié)

| Quoi | Preuve |
| --- | --- |
| **Lecture de Crisp → modèle → fiche HubSpot → notification.** | Répété le 17/10 à 23:43, réussi de bout en bout. Message de Jean à 23:43:12, lu à 23:43:24. Épisode jugé par le modèle en 3 s, confiance 0,85, avec le contexte Crisp. Fiche « Le Bistro · Premium ». Notification **10 s après la recherche**. |
| **Lecture de Crisp, même avec une capture partielle.** | Le 17/10 à 23:31, le message n'était lisible que dans une capture Alt+Tab. Le lecteur de Minguk la lit maintenant (`de58b89`). Validé en rejouant l'historique ; la répétition de 20:21 donne le même résultat ; 122/122 tests de Minguk. |
| **Boutons [Ça m'a aidé] / [Pas ça].** | Mesuré. Une aide qui accumule les « Pas ça » ne part plus qu'à 0,95 de confiance. |
| **Boucle de nuit → certification par notification.** | Le 17/10 à 23:22:16, la règle « Dédommagement : 1 mois max Premium/Groupe, sinon bon 10 % » a été certifiée d'un clic. Elle devient l'aide de toute l'équipe. |
| **Live View « Mon agent, en direct »** (`friction-agent`). | Le 17/10 à 23:43, les 5 étapes étaient ✅ : Crisp lu, modèle, fiche HubSpot, aide affichée, envoi chiffré. On y voit ce que lit l'équipe à côté de ce que voit le serveur. Le démon la met à jour moins de 150 ms après chaque changement. Le rythme de rafraîchissement de l'app Screenpipe n'a pas été mesuré. |
| **Live View « Frictions de l'équipe »** (`friction-map`). | Republiée toutes les 30 s par le démon : en attente, résolues, détours sur 7 jours, étapes triées par état, liste « Cette nuit ». |
| **Stockage d'équipe chiffré** (RPC de Haytham, équipe « Support »). | Les tests de Haytham passent : 35 unitaires, 41 de bout en bout, 8 sur le circuit du démon. Le serveur ne voit que des blocs chiffrés sans identité. |
| **Parcours guidé de Haytham.** | Joué en entier sans navigateur visible, en mode présentation : 8 chapitres en environ 75 s, aucune erreur. Le seul 401 est voulu : Karim est exclu après le changement de clé. |
| **Code de Minguk dans l'app de Haytham.** | Aucune erreur sur les 4 pages (classification des besoins, scénario Jean Dupont, notification « Sans réponse → #canal »). La notification passe la vérification de format de Minguk avec 0 problème. |

## 2. Ce qui reste, pour ce matin (dans l'ordre)

| # | À faire | Qui | Pourquoi |
| --- | --- | --- | --- |
| 1 | **Test sur deux machines** : demande anonyme → [Partager] → aide chez Léa. Karim rejoint avec `bun andrea/daemon/main.ts equipe-rejoindre "<lien>"`. Le lien est dans `~/.config/friction-assist/invitation-support.txt` chez Andrea ; **le transmettre en privé** (il contient la clé de l'équipe). | Andrea + Karim | Mesuré sur deux démons avec l'ancien stockage (7 s puis 4 s), **pas encore entre deux vraies machines sur le stockage RPC actuel**. Tant que ce n'est pas fait, montrer cette partie avec le parcours de Haytham. |
| 2 | **Mac** : compiler le Screenpipe patché de Minguk ([andrea/screenpipe-patch/](andrea/screenpipe-patch/)), puis tester un clic sur un bouton `api`. | Minguk | Sans le correctif, un clic sur Mac n'arrive jamais. Le correctif lui-même n'a pas encore été testé. Repli : Karim sur un second Windows. |
| 3 | **Trancher le format du pitch** : déroulé réel ([demo.md](andrea/docs/demo.md)) ou parcours guidé ([PITCH.md](teamstore/PITCH.md)). Proposition : l'**ouverture en vrai** (Crisp → HubSpot → fiche, ça marche), puis le **parcours** pour l'équipe, la nuit et la carte. | Toute l'équipe | Les deux documents décrivent chacun un déroulé de 3 min complet. |
| 4 | **Enregistrer les vidéos d'illustration** avec le parcours de Haytham. **Mettre le démon en pause pendant l'enregistrement** : `bun andrea/daemon/main.ts pause`, puis `reprendre`. | Andrea | Sinon le démon peut réagir au faux HubSpot du parcours et afficher une vraie notification au milieu de la vidéo. |
| 5 | **Répétition complète chronométrée**, puis figer le code avec le tag `demo` (`git tag demo && git push --tags`). | Andrea | Plus de changement de code après le tag, sauf correctif bloquant. |
| 6 | **Diapo « nos chiffres »** (§ 5). | Andrea | Les chiffres doivent être les mêmes partout. |
| 7 | Après le hackathon : **régénérer la clé HubSpot** (donnée en clair dans le chat) et **le mot de passe Supabase**. | Andrea | Sécurité. |

## 3. Dans la démo et futur

| Sujet | Dans la démo (tourne en vrai) | Futur (pitch seulement, ne rien lancer) |
| --- | --- | --- |
| Détection | Inférence : un appel à `claude-opus-5` par épisode, via la passerelle Screenpipe, seuil de confiance 0,72. | **Détecteur écrit en code la nuit**, déterministe, validé puis approuvé par un humain. Figé le 17/10 : le candidat ne filtrait que 0,7 % du travail normal ([ETAT.md](andrea/ETAT.md#évolution-prévue--détecteur-écrit-en-code-la-nuit)). |
| Apprentissage | Retours [Ça m'a aidé] / [Pas ça] (score de chaque aide), et **boucle de nuit** de Haytham (`./teamstore/start.sh nuit`, ou `--exemple` pour l'exemple préparé). L'IA propose une règle, la responsable la **certifie**. C'est une validation, pas un vote. | Apprentissage du détecteur sur les étiquettes (le code `offline/` existe, il n'est pas montré). |
| Contexte client | Lecture de Crisp de Minguk, dans le démon (contexte de 10 min), et fiche HubSpot retrouvée par le nom. | Autres outils (Slack, Notion) comme contexte. |
| Équipe | Demande anonyme chiffrée → [Partager] → aide. Certification signée. Changement de clé. | Délai aléatoire d'anonymat (10 à 60 s) : coupé pour la démo (`FRICTION_REQUEST_JITTER=0`), à dire au jury. |
| Actions dans les Live Views | Aucune : les Live Views sont en lecture seule, chaque action passe par une notification Screenpipe. | Les actions sur les éléments de liste existent dans l'API (`/outputs/targets/{id}/items/{itemId}/actions`), mais leur affichage dans l'app n'est pas vérifié. |
| Mac | Screenpipe **patché** pour les boutons `api`. Écart assumé, pour la démo seulement. | PR du correctif vers Screenpipe : une des 3 évolutions qu'on leur propose. Ne pas dire « sans fork ». |
| Appel téléphonique | Code de Minguk branché (transcription d'une réunion Screenpipe) ; il n'a pas été répété ce soir. | — |

## 4. L'app de Haytham et son intégration dans Screenpipe

### L'app (`teamstore/`)

Pour la lancer : `./teamstore/start.sh` (Windows : `teamstore\start.cmd`), puis ouvrir `http://127.0.0.1:4322/`. Sous WSL, Chrome côté Windows l'ouvre bien (vérifié). Elle tourne sur un stockage local (SQLite) : rien ne part sur Supabase.

| Page | Rôle pour la démo |
| --- | --- |
| `/parcours` : **Parcours guidé** | **Vidéos d'illustration et pitch.** La journée de Léa en 8 chapitres : son écran (Crisp, HubSpot, Slack, Notion), ce que fait l'agent, ce que reçoivent les collègues, ce que voit le serveur. Recharger la page repart d'une équipe neuve. Le « Mode présentation » clique seul (corrigé le 17/10 : il restait bloqué au chapitre 1). Guide : [PARCOURS.md](teamstore/PARCOURS.md). |
| `/equipe` : **Équipe simulée** | Les 5 collègues côte à côte, le scénario en 10 boutons et les attaques. Pour les questions du jury sur la vie privée. |
| `/moi` : **Mon poste** | Usage réel : rejoindre une équipe, certifier, modifier ou rejeter les règles de la nuit (« 🌙 Cette nuit »). C'est la page qu'ouvre le bouton [Rédiger] des notifications de certification. |
| `/repetition` : **Régie** | Coche chaque étape de la répétition quand la vraie notification arrive, chronomètre en main. |

**À ne pas faire** : lancer `start.sh moi --crisp` pendant que le démon tourne. Cela crée deux lecteurs de Crisp, donc deux frictions pour un même message.

### Ce qui vit dans Screenpipe

| Élément Screenpipe | D'où il vient |
| --- | --- |
| Notifications (aide, fiche client, « Un collègue bloque », [Partager], règle à certifier) | Démon d'Andrea. La certification réutilise le code de Haytham (`andrea/daemon/certify.ts`). |
| Live View **« Mon agent, en direct »** (`screenpipe://live-view/friction-agent`) | Démon, `andrea/daemon/trace.ts`. Bandeau « étape par étape » repris du parcours de Haytham : icône, étape, état. |
| Live View **« Frictions de l'équipe »** (`friction-map`) | Démon, `andrea/daemon/map.ts`, construite avec le tableau de Haytham (`teamstore/demo/board.ts`). |
| Live View **« Frictions en direct »** (`friction-live`) | App de Haytham : case « Afficher aussi dans Screenpipe » du parcours. |
| Modèle | Passerelle `/v1/chat/completions` de Screenpipe (le démon et la boucle de nuit). |

**Limites de l'intégration (vérifiées)** :
- Pas de couleur dans les Live Views : le schéma n'a aucun champ de style, donc l'état se lit aux emoji (✅ ⏳ ⚠️). Les couleurs de Haytham n'existent que dans ses pages web.
- Pas de bouton dans les Live Views.
- L'app Screenpipe n'est pas prévenue quand un bloc change (rien sur `/ws/events`) : elle rafraîchit à son rythme.
- Recréer une vue remet sa disposition à zéro.

## 5. Chiffres à dire (les mêmes partout)

- Détection, évaluée sur 172 épisodes étiquetés dont 26 frictions, avec `claude-opus-5` au seuil 0,72 : **précision 0,71, rappel 0,46**. Quand l'agent se déclenche, il a souvent raison, mais il manque environ la moitié des frictions. Les étiquettes ont été posées par Claude et relues par Andrea.
- Latence du modèle : médiane 2,6 s. Aide affichée environ **10 à 13 s après le geste** (capture d'écran, 6 s d'attente que la recherche soit finie, modèle).
- Boucle de nuit : 28 cas sur 28 justes, **sur des cas écrits par nous** (le dire tel quel).
- Partage : 7 s puis 4 s, mesuré sur l'ancien stockage. À remesurer au test sur deux machines.

## 6. Pièges connus (répétition et enregistrement)

- **Crisp** : rester 1 à 2 s sur la liste des conversations après l'arrivée du message, avant de passer à HubSpot. Sinon le message peut ne pas être lu, et c'est l'aide générique qui part au lieu de la fiche.
- **Notifications** : si une notification n'apparaît pas, relancer l'app Screenpipe. Le serveur de notifications peut se figer (vu le 17/10 à 23:11).
- **Aucune recherche HubSpot avant le message de Jean** : une aide générique « client introuvable » bloquerait la fiche pendant 10 min.
- Fenêtres Claude et terminal hors de l'écran : l'OCR leur prend du texte.
