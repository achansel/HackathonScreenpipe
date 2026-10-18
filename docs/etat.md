# État : ce qui marche, mesures et limites (18/10/2026)

> Niveau de preuve : **mesuré** sur le poste Windows d'Andrea (Screenpipe côté Windows, code dans WSL), sauf mention contraire.

## Ce qui marche

| Quoi | Preuve |
| --- | --- |
| **Lecture de Crisp → modèle → fiche HubSpot → notification.** | Répétition du 17/10 à 23:43, de bout en bout. Message du client à 23:43:12, lu à 23:43:24. Épisode jugé par le modèle en 3 s, confiance 0,85, avec le contexte Crisp. Fiche « Le Bistro · Premium » retrouvée par le nom. Notification **10 s après la recherche HubSpot**. |
| **Lecture de Crisp avec une capture partielle.** | Le 17/10 à 23:31, le message n'était lisible que dans une capture Alt+Tab ; le lecteur la lit maintenant. Validé en rejouant l'historique Screenpipe ; 122/122 tests `minguk/`. |
| **Boutons [Ça m'a aidé] / [Pas ça], relais des clics avec nonce.** | Mesuré ; un faux clic est refusé (403). Une aide qui accumule les « Pas ça » ne part plus qu'à 0,95 de confiance. |
| **Demande anonyme → [Partager] → aide chez celui qui bloquait.** | Mesuré entre deux démons sur une machine (`simuler`) : « Un collègue bloque » en 7 s, aide 4 s après le partage. Sur Supabase, 59 ms entre deux postes. |
| **Boucle de nuit → certification par notification.** | Le 17/10 à 23:22:16, la règle « Dédommagement : 1 mois max Premium/Groupe, sinon bon 10 % », écrite par l'IA, a été certifiée d'un clic et est devenue l'aide de toute l'équipe. |
| **Live View « Mon agent, en direct »** (`friction-agent`). | Le 17/10 à 23:43, les 5 étapes ✅ : Crisp lu, modèle, fiche HubSpot, aide affichée, envoi chiffré (ce que lit l'équipe à côté de ce que voit le serveur). Mise à jour moins de 150 ms après chaque changement. |
| **Live View « Frictions de l'équipe »** (`friction-map`). | Republiée toutes les 30 s : en attente, résolues, détours sur 7 jours, étapes triées par état, liste « Cette nuit ». |
| **Mémoire d'équipe chiffrée.** | 35 tests unitaires, 41 de bout en bout (serveur local et Supabase), 8 sur le circuit du démon. Lecture directe des tables refusée, faux jeton refusé, rotation de clé : un membre retiré ne lit plus rien. |
| **Veille.** | Screenpipe fermé ou injoignable : l'agent attend et reprend seul. |

## Pas encore prouvé

- **Deux vraies machines** sur le stockage actuel : le partage est mesuré entre deux démons sur une machine, pas encore entre deux postes.
- **Mac** : le correctif des boutons `api` ([andrea/screenpipe-patch/](../andrea/screenpipe-patch/)) n'a pas été testé en conditions réelles. Sans lui, un clic sur Mac n'arrive jamais (mesuré).
- **Appel téléphonique** (transcription d'une réunion Screenpipe) : branché, pas répété.

## Dans la démo, et après

| Sujet | Dans la démo | Après |
| --- | --- | --- |
| Détection | Inférence : un appel à `claude-opus-5` par épisode, via la passerelle Screenpipe, seuil 0,72. | **Détecteur écrit en code la nuit** (`andrea/offline/`) : déterministe, validé sur les étiquettes puis approuvé par un humain. Construit et testé, mais le candidat du 17/10 ne filtrait que 0,7 % du travail normal : pas montré. |
| Apprentissage | Retours [Ça m'a aidé] / [Pas ça], et boucle de nuit : l'IA propose, la responsable certifie. | Apprentissage du détecteur sur les étiquettes. |
| Contexte | Dernier message client lu dans Crisp (10 min), fiche HubSpot par le nom, appel en cours. | Slack et Notion comme contexte. |
| Équipe | Demande anonyme chiffrée, partage, certification signée, rotation de clé. | Délai aléatoire d'anonymat (10–60 s), coupé pour la démo (`FRICTION_REQUEST_JITTER=0`). |
| Live Views | Lecture seule ; chaque action passe par une notification. | Actions sur les éléments de liste (l'API existe : `/outputs/targets/{id}/items/{itemId}/actions`), affichage non vérifié. |
| Mac | Screenpipe patché pour les boutons `api`. | PR vers Screenpipe. |

## Chiffres

- Détection, 172 épisodes réels étiquetés (26 frictions), `claude-opus-5` au seuil 0,72 : **précision 0,71, rappel 0,46**. Quand l'agent se déclenche, il a souvent raison ; il manque environ la moitié des frictions. Étiquettes posées par Claude, relues par Andrea. Avec `claude-haiku-4-5` : précision 0,46.
- Latence du modèle : médiane 2,6 s. Aide affichée **10 à 13 s après le geste** (capture, 6 s d'attente que la recherche soit finie, modèle).
- Boucle de nuit : 28 cas sur 28 justes, **sur des cas écrits par nous** (`teamstore/mesures/`).
- Stockage d'équipe : 59 ms entre deux postes sur Supabase (`teamstore/mesures/perf-supabase.json`).

## Choix faits pour la démo

- **Un seul décideur** : l'agent (`andrea/daemon`) juge le geste de l'employé sans règle par appli. Le code de `minguk/` voit (Crisp), entend (appels) et retrouve la fiche ; il ne choisit plus l'aide. Ses mots-clés étaient justes sur le script (4/4) mais faux hors script (3/4 sur des messages pièges).
- **Modèle** : `claude-haiku-4-5` n'est pas dans la liste autorisée de la passerelle Screenpipe et était remplacé en silence ; `claude-opus-5` est meilleur sur l'évaluation.
- **Contexte Crisp** : le message client sert de contexte au modèle, jamais de friction à lui seul. Mesuré : la question Slack « geste commercial » passe de 2/5 à 5/5 avec le contexte.
- **Boutons** : `api` relayé pour les actions, `link` pour [Y aller] (un `link` http ouvre toujours le navigateur).

## Limites connues

- Il faut qu'une capture de la liste Crisp montre le message : rester une seconde ou deux sur la liste avant de changer d'onglet.
- Une aide générique « client introuvable » bloque la fiche du même client pendant 10 min (anti-répétition).
- Le serveur de notifications de Screenpipe peut se figer ; relancer l'app.
- L'OCR prend du texte aux fenêtres visibles : garder les terminaux hors de l'écran enregistré.
- Le parcours guidé web de Haytham (mise en scène des 8 chapitres, avec ses couleurs) n'est pas sur cette branche : il reste sur `main`. Ici, le produit, c'est l'agent et les Live Views Screenpipe.
