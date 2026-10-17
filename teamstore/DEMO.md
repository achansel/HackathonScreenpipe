# Démo finale avec le stockage chiffré : le travail de toute l'équipe, assemblé

> Ce guide **assemble** sans les modifier :
> - le démon d'Andrea (`andrea/`) ;
> - l'environnement PipingTable, le simulateur Crisp et les notifications de Minguk (`minguk/`) ;
> - le stockage chiffré (`teamstore/`).
>
> Il complète le déroulé d'Andrea ([andrea/docs/demo.md](../andrea/docs/demo.md)) avec le stockage Supabase par équipe, et il marche avec des Mac.
> **Mesuré le 17/10 sur le Supabase de l'équipe**, voir « Ce qui a été vérifié » en bas.

## Qui joue quoi

| Rôle | Machine | Outil | Pourquoi |
| --- | --- | --- | --- |
| **Léa** (la personne qui présente) | Windows de préférence | **démon d'Andrea** (détection à l'écran, vraie IA) | la détection automatique est le cœur du produit |
| **Karim Bensaïd** | Mac ou Windows | **page « Mon poste »**, profil Karim | sur Mac, les boutons `api` du démon ne marchent pas sans patch ; les boutons de la page sont des liens, qui marchent partout |
| **Claire Morin** (responsable) | n'importe laquelle | page « Mon poste », profil Claire | crée l'équipe, certifie la règle |
| Le client Jean Dupont | n'importe laquelle | **simulateur Crisp de Minguk** | envoie un vrai message dans la vraie boîte Crisp |

Le démon et la page **parlent la même langue** : mêmes demandes, mêmes solutions, même chiffrement. Une demande de Léa (démon) arrive chez Karim (page), et la solution de Karim revient chez Léa (démon).

## Avant de commencer : faire comprendre en 1 minute

Si le jury (ou un coéquipier) ne connaît pas le produit, ouvrir **`/parcours`** (page d'accueil → Parcours guidé) et cocher « Mode présentation ». La journée de Léa défile en 7 chapitres, avec l'écran, l'agent, l'équipe et le serveur côte à côte.

## La veille (20 min)

Sur **chaque** machine, depuis la racine du dépôt (`git pull` sur `main`) :

1. Jeton Screenpipe : `scripts/screenpipe-env.sh`.
2. Accès au stockage d'équipe : `~/.config/friction-assist/team.env` avec `FRICTION_TEAMSTORE_URL` et `FRICTION_TEAMSTORE_ANON_KEY`, envoyés en privé par Haytham ([README §3](README.md)).
3. `./teamstore/start.sh verifier` doit afficher « Le stockage est prêt pour l'équipe ».

Ensuite :

4. **Claire** : `./teamstore/start.sh moi`, puis « Je joue : Claire Morin », puis « Créer une équipe » `Support` (périmètre « Tout »). Copier le lien et l'envoyer **en privé** à Léa et Karim.
5. **Karim** : `./teamstore/start.sh moi --escalade 60`, puis « Je joue : Karim Bensaïd », puis coller le lien dans « Rejoindre ».
   - Variante sans le démon d'Andrea : Léa lance `./teamstore/start.sh moi --crisp`, et la détection Crisp de Minguk déclenche les frictions depuis les vrais messages Crisp.
6. **Léa** (démon d'Andrea) :
   ```bash
   source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env
   bun andrea/daemon/main.ts equipe-rejoindre "<lien de Claire>"
   bun andrea/daemon/main.ts activer        # consentement, une fois
   ```
7. **Carte** : `./teamstore/start.sh carte` sur la machine de Léa. Elle installe la Live View d'Andrea et la remplit à partir des signatures chiffrées de l'équipe.

## 15 minutes avant

- [ ] Relancer Screenpipe sur chaque machine et voir **à l'œil** une notification de test (le panneau Windows peut rester vide alors que l'API répond « sent »).
- [ ] Léa : `FRICTION_SEED_IDS=client-introuvable FRICTION_REQUEST_JITTER=0 bun andrea/daemon/main.ts`. Léa connaît une seule règle, ce qui montre l'aide immédiate, puis le partage sur le reste.
- [ ] Simulateur de Minguk : `cd minguk && bun install && bun run simulate`, puis ouvrir http://127.0.0.1:4518.
- [ ] Chrome (pas Firefox) sur Crisp, HubSpot et Slack chez Léa.
- [ ] Ne pas répéter la même notification en moins de 90 s (filtre anti-doublon de Screenpipe).

## Déroulé (3 min)

| Temps | Où | Geste | Ce qu'on voit / dit |
| --- | --- | --- | --- |
| 0:00 | — | — | « Quand un process coince, on cherche, on demande sur Slack, on attend. Et le suivant recommence. » |
| 0:15 | simulateur | Jean Dupont envoie son message dans Crisp | Un **vrai** message arrive dans la boîte Crisp de Léa. |
| 0:25 | Léa | elle cherche `jd.resto75@resa-paris.test` dans HubSpot : 0 résultat | Le démon détecte la friction. Léa connaît la règle : **« Client introuvable : chercher par domaine »** s'affiche tout de suite. |
| 0:50 | simulateur, puis Léa | Jean : « Je veux un dédommagement ». Léa demande dans Slack #support | Le démon n'a pas la solution : une **demande anonyme** part à l'équipe. |
| 1:05 | Karim | notification **« Un collègue bloque… »**, il clique **Partager** (c'est un lien, il marche sur Mac) | « Karim ne sait pas qui demande. » |
| 1:15 | Léa | — | Quelques secondes plus tard, la solution arrive dans Screenpipe. Léa répond à Jean. |
| 1:30 | Claire | « Certifier » sur la règle du geste commercial | « La page Notion de PipingTable dit "2 mois offerts" : elle est périmée. La vraie règle était enfouie dans un fil Slack. Maintenant elle est **certifiée par la responsable**, et personne d'autre ne peut fabriquer ce badge. » |
| 1:50 | Léa | `screenpipe://live-view/friction-map` | La **carte des frictions** dans Screenpipe : des détours par étape, jamais par personne. |
| 2:10 | page « Mon poste » | vue opérateur, puis les 3 attaques | « Voilà tout ce que voit Supabase : des blocs illisibles, de la même taille, sans nom ni heure. La clé publique n'ouvre rien. » |
| 2:30 | — | — | Vie privée, « tout ce que l'utilisateur voit vit dans Screenpipe », les 3 évolutions proposées (voir le déroulé d'Andrea). |

**Si personne ne sait** (question du jury, ou en démo) : au bout de 60 s, la page transforme la demande en aide **« 💬 Sans réponse → #deal-desk »** de Minguk, avec le bon canal du Slack PipingTable et un message prêt à coller.

## Si ça coince

| Problème | Repli |
| --- | --- |
| Pas de deuxième machine | Une seule machine : `./teamstore/start.sh equipe-demo`, puis `FRICTION_REQUEST_JITTER=0 bun andrea/daemon/main.ts simuler` et `bun andrea/daemon/main.ts injecter lea "…"`. Ou la démo à 5 postes : `./teamstore/start.sh`. |
| Clic « Partager » sans effet | Karim est sur le démon Mac non patché : passer Karim sur la page « Mon poste ». |
| La détection ne se déclenche pas | `injecter` en simulation (le dire au jury), ou « Je bloque sur… » dans la page. |
| Supabase injoignable (réseau) | `./teamstore/start.sh moi --heberger` sur une machine, `--serveur http://IP:3001` sur les autres. Si le wifi isole les machines : la démo à 5 postes sur une machine. |
| Notification invisible | Relancer Screenpipe ; montrer la toast dans la page. |

## Ce qui a été vérifié (17/10, Mac de Haytham, Supabase de l'équipe)

- **Démon d'Andrea (Léa, simulation, vraie IA de Screenpipe) ↔ page « Mon poste » (Karim).**
  - Épisode « Jean Dupont introuvable » : le démon qualifie (« Retrouver un client dans HubSpot », confiance 0,98), puis publie la demande sur Supabase.
  - La page de Karim **reconnaît l'étape** (formulée autrement), grâce au `matchStep` d'Andrea importé tel quel.
  - « Partager » depuis le lien de la notification : l'onglet ouvert s'en charge, le nouvel onglet s'efface.
  - **8 s plus tard**, le démon de Léa affiche « Client introuvable : chercher par domaine » (`Notification sent successfully`).
- **Escalade** : demande sans réponse, puis l'aide « 💬 Sans réponse → #deal-desk » de Minguk, **affichée dans Screenpipe** en priorité haute (`Notification shown`).
- **Carte** : `start.sh carte` installe la Live View d'Andrea et remplit ses 5 blocs à partir des signatures chiffrées de l'équipe.
- Pas vérifié ici :
  - la chaîne avec le **simulateur Crisp de Minguk** et la détection à l'écran (il faut l'écran de Léa et Crisp ouvert dans Chrome) ;
  - le rendu de la carte à l'œil dans l'app.
