# État au 18/10/2026

Mesuré sur un poste Windows (Screenpipe côté Windows, code dans WSL) sauf mention contraire.

## Ça marche

| Quoi | Preuve |
| --- | --- |
| Crisp lu → modèle → fiche HubSpot → notification | 17/10 23:43. Message client 23:43:12, lu 23:43:24. Jugé en 3 s, confiance 0,85, contexte Crisp. Fiche « Le Bistro · Premium » par le nom. Notification 10 s après la recherche HubSpot. |
| Lecture Crisp sur capture partielle | 17/10 23:31 : message visible seulement dans une capture Alt+Tab. Corrigé, validé en rejouant l'historique Screenpipe. 122/122 tests `integrations/`. |
| [Ça m'a aidé] / [Pas ça], relais des clics avec nonce | Faux clic refusé (403). Une aide à score ≤ -2 ne part plus qu'à 0,95 de confiance. |
| Demande anonyme → [Partager] → aide | Deux agents sur une machine (`simuler`) : « Un collègue bloque » en 7 s, aide 4 s après le partage. 59 ms entre deux postes sur Supabase. |
| Boucle de nuit → [Certifier] | 17/10 23:22:16 : règle écrite par l'IA, certifiée d'un clic, devenue l'aide de l'équipe. |
| Live View « Mon agent, en direct » | 17/10 23:43 : 5 étapes ✅ (Crisp, modèle, fiche, aide, envoi chiffré avec le clair côté équipe et le chiffré côté serveur). Publiée < 150 ms après chaque changement. |
| Live View « Frictions de l'équipe » | Republiée toutes les 30 s. |
| Mémoire d'équipe chiffrée | 35 + 41 + 8 tests. Lecture directe des tables refusée, faux jeton refusé, rotation : un membre retiré ne lit plus rien. |
| Screenpipe fermé | L'agent attend et reprend. |

## Pas prouvé

- Deux vraies machines sur le stockage actuel (seulement deux agents sur une machine).
- Mac : `screenpipe-patch/` n'a pas tourné en conditions réelles. Sans lui, un clic `api` sur Mac n'arrive jamais (mesuré).
- Appel téléphonique (réunion Screenpipe) : branché, pas répété.

## Démo vs après

| | Démo | Après |
| --- | --- | --- |
| Détection | Un appel `claude-opus-5` par épisode, seuil 0,72 | Détecteur en code généré la nuit (`agent/offline/`), validé sur les étiquettes, approuvé par un humain. Construit, testé ; le candidat du 17/10 ne filtrait que 0,7 % du travail normal. |
| Apprentissage | Retours boutons ; boucle de nuit : l'IA propose, la responsable certifie | Apprentissage du détecteur sur les étiquettes |
| Contexte | Dernier message Crisp (10 min), fiche HubSpot, appel en cours | Slack, Notion |
| Équipe | Certification en direct. Demande anonyme et [Partager] : montrés avec le dashboard ou le film, reproduits sur une machine avec `simuler` (pas de second poste : correctif Mac non compilé) | Délai aléatoire d'anonymat (10–60 s), à 0 en simulation |
| Live Views | Lecture seule, actions par notification | Actions sur les items de liste (l'API existe, affichage non vérifié) |
| Dashboard web | Ébauche (`teamstore/dashboard/`), sert à illustrer | Rien : le produit, c'est les Live Views |
| Mac | Screenpipe patché | PR |

## Chiffres

Détail, méthode et fichiers sources : [mesures.md](mesures.md).

- Détection : 172 épisodes réels, 26 frictions, étiquettes posées surtout par Claude puis relues. `claude-opus-5` au seuil 0,72 : précision 0,71, rappel 0,46 (12 justes, 5 fausses alertes, 14 manquées). Le seuil est choisi sur ce même jeu ; à 0,70 c'est 0,54 / 0,50, à 0,75 c'est 0,89 / 0,31.
- Modèle : médiane 2,6 s. Aide 10 s après le geste le 17/10 à 23:43 ; budget typique 10–12 s.
- Mots-clés : 4/5 justes sur les messages du script, 0/5 hors script.
- Boucle de nuit : 28/28 sur des cas écrits par nous.
- Stockage d'équipe : 58,5 ms entre deux postes sur Supabase.

## Choix

- Un seul décideur : l'agent. `integrations/` lit Crisp, écoute les appels, retrouve la fiche ; il ne choisit plus l'aide (mots-clés : 4/5 justes sur le script, 0/5 hors script).
- `claude-haiku-4-5` absent de la liste autorisée de la passerelle Screenpipe : remplacé en silence. D'où Opus.
- Le message Crisp est du contexte, jamais une friction seul. Question Slack « geste commercial » : 2/5 → 5/5 avec le contexte ; Opus 5/5 contre Haiku 0/5 sur la même question.
- Boutons `api` relayés pour les actions ; `link` pour [Y aller].

## Limites

- Il faut une capture de la liste Crisp qui montre le message : rester 1–2 s dessus avant de changer d'onglet.
- Une aide générique « client introuvable » bloque la fiche du même client 10 min.
- Le serveur de notifications de Screenpipe se fige parfois : relancer l'app.
- L'OCR lit tout ce qui est visible : terminaux hors écran.
