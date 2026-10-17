# Démo finale : ce que teamstore apporte au déroulé d'Andrea

> **Le déroulé de référence est celui d'Andrea : [andrea/docs/demo.md](../andrea/docs/demo.md)** (choix fixés le 17/10, ouverture répétée de bout en bout à 19:14). En cas de doute, c'est lui qui fait foi. Ce guide dit seulement **où s'emboîtent les pièces de `teamstore/`**, sans rien changer à ses choix.

## Les choix d'Andrea qu'on respecte

- **Un seul décideur : le démon d'Andrea.** Il intègre la lecture Crisp et la fiche HubSpot de Minguk. Donc **pas** de `teamstore/start.sh moi --crisp` en même temps (deux décideurs, et des recherches Screenpipe en plus : erreurs « search is busy »). La régie vérifie ce point.
- **Karim joue sur le démon** (Mac : Screenpipe patché pour les boutons `api`). La page « Mon poste » sert seulement de **repli** si le patch n'est pas là.
- **Jean Dupont écrit depuis `jd.resto75@resa-paris.test`** (une adresse en `@example.com` ramène tous les contacts HubSpot). Pour rejouer sans tomber dans l'anti-répétition de 10 min du démon, prendre les clients de répétition : Kenji Mori, Élodie Marchand, Luc Fabre (`docs/crisp.md`).
- **Le simulateur de Minguk** se lance avec `--sans-aide`.

## Ce que teamstore ajoute

| Pièce | Quand | Commande |
| --- | --- | --- |
| **Stockage d'équipe chiffré** (Supabase, une clé par équipe) | toujours : c'est par là que passent la demande anonyme de Léa et le partage de Karim | `team.env` puis `bun andrea/daemon/main.ts equipe-rejoindre "<lien>"` sur chaque poste |
| **Régie de répétition** (`/repetition`) | **les répétitions** : on joue le déroulé avec les vrais outils, et la page coche chaque étape quand la vraie réaction arrive, chronomètre en main | `./teamstore/start.sh`, puis « Répétition (vrais outils) » |
| **« Frictions en direct »** (Live View Screenpipe) | en démo, à côté de la carte d'Andrea : ce qui est en attente, résolu ou certifié, maintenant | case cochée dans la régie : `screenpipe://live-view/friction-live` |
| **Parcours guidé** (`/parcours`) | pour faire comprendre le produit en 1 minute (jury, nouveau coéquipier), avant ou après la démo | `./teamstore/start.sh`, puis « Parcours guidé » |
| **Vue opérateur et attaques** (`/equipe`) | question du jury « vous surveillez ? » : ce que voit le serveur, et les 3 attaques qui échouent | `./teamstore/start.sh`, puis « Équipe simulée » |
| **Certification par la responsable** | phrase de pitch : la page Notion de PipingTable est périmée (« 2 mois »), la règle certifiée dit « 1 mois » | page « Mon poste » de la responsable, ou `bun andrea/daemon/main.ts equipe-certifier Support geste-commercial` |

## La régie de répétition, en pratique

1. Sur **chaque poste**, préparer comme dans le déroulé d'Andrea (« Avant de monter sur scène »), puis `./teamstore/start.sh` et ouvrir **Répétition (vrais outils)**.
2. Choisir **le rôle** (Léa ou Karim) et **le client** (Jean pour la démo, un client de répétition sinon), puis **Démarrer la répétition**.
3. La colonne **Vérifications** dit ce qui manque :
   - Screenpipe et ses notifications ;
   - le démon d'Andrea ;
   - l'équipe chiffrée ;
   - la clé HubSpot ;
   - le simulateur de Minguk ;
   - la carte ;
   - un seul décideur.
4. Le **déroulé** donne chaque geste, avec les vrais liens :
   - le chat Crisp du client ;
   - la liste des contacts HubSpot, ou la recherche déjà remplie ;
   - Slack #support ;
   - les messages à copier.

   Puis il **attend la vraie réaction** :

   | Rôle | Étape | Réaction attendue |
   | --- | --- | --- |
   | Léa | recherche HubSpot | notification « Client : … » ou « Client introuvable », en ≈ 10 s |
   | Léa | « Ça m'a aidé » | le clic arrive à Screenpipe ou au démon |
   | Léa | question sur Slack | le démon envoie la demande anonyme |
   | Léa | réponse de l'équipe | notification « Geste commercial » |
   | Karim | demande reçue | notification « Un collègue bloque » |
   | Karim | partage | son clic sur « Partager » |

   Chaque étape est cochée **avec son délai mesuré**. Si rien n'arrive, le repli d'Andrea s'affiche.
5. La colonne **Réactions réelles** montre tout ce qui se passe :
   - 🔔 les notifications réellement affichées par Screenpipe ;
   - 👆 les clics sur les boutons ;
   - ⚙️ les actions du démon.
6. **Copier le compte rendu** donne les délais mesurés, à coller dans le canal de l'équipe.

La régie **ne décide rien et ne lit pas l'écran**, donc elle n'ajoute aucune recherche Screenpipe. Elle lit :
- l'historique des notifications de Screenpipe (`127.0.0.1:11435/notifications`) ;
- le journal de l'app Screenpipe, pour les clics (sur Mac) ;
- les événements du démon (`andrea/daemon/.state/**/events.jsonl`) ;
- les blocs de l'équipe, avec les clés du démon de ce poste.

## Ce qui a été vérifié (17/10, Mac de Haytham, Supabase de l'équipe)

- **Répétition complète de la chaîne réelle avec la régie :**
  - Léa est le démon d'Andrea, en simulation, avec la vraie IA de Screenpipe et des épisodes injectés (son repli) ;
  - Claire est la page « Mon poste » ;
  - la régie, en rôle Léa, a coché seule, à partir des vraies réactions :
    - la recherche HubSpot : « Client introuvable : chercher par domaine » affichée par Screenpipe, **3 s** ;
    - la demande anonyme, avec l'étape formulée par l'IA (« Déterminer le dédommagement autorisé pour client premium »), **3 s** ;
    - la réponse de l'équipe : « Geste commercial : 1 mois offert maximum » affichée chez Léa, **7 s** après la demande.
  - Un vrai clic sur « Ça m'a aidé » a aussi été relevé dans le journal de Screenpipe.
- **Pas joué ici :**
  - la détection à l'écran par le démon (il faut le consentement `activer` sur le poste de Léa) ;
  - un vrai message Crisp ;
  - la fiche HubSpot (clé absente sur ce Mac).

  C'est exactement ce que la régie permet de répéter sur les vrais postes.

## Correctif trouvé pendant ce travail

Quand le serveur tournait en mode démo (`./teamstore/start.sh`), la page « Mon poste » utilisait le stockage **local**, alors que les démons publient sur **Supabase** : elle ne voyait jamais leurs demandes. « Mon poste » utilise maintenant toujours le stockage de l'équipe (`team.env`) quand il est configuré.
