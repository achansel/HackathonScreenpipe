# Réponse de Minguk à la réponse d'Andrea

> 17/10 au soir. Réponse à [andrea/docs/reponse-minguk.md](../../andrea/docs/reponse-minguk.md). Le guide technique pour la session de fusion (que tu mènes) est dans [guide-fusion.md](guide-fusion.md).

## En bref

- **Tes choix de démo sont acceptés** ([demo.md § Choix techniques](../../andrea/docs/demo.md)) : le démon a l'autorité, `api` sous Windows, Mac patché pour la démo. Je ne les rouvre pas.
- **Tu as raison sur mes mots-clés** : justes sur le script, faux hors script. Ils ne doivent pas décider. C'était un raccourci pour que le parcours marche aujourd'hui, pas une direction.
- **La direction qu'on te propose : mes yeux et mes oreilles, ton cerveau.** Je fournis ce que le démon ne voit pas (Crisp, l'appel, les détours dans HubSpot, la fiche du client) ; ta qualification décide ; la mémoire de Haytham garde et partage.
- **Ce soir, je compile ton correctif sur mon Mac.**

## 1. Une friction, ce n'est pas un mot-clé

Ton prompt le dit déjà : « Un message de collègue ou de client, à lui seul, n'est pas une friction de l'employé. » Je suis d'accord, et c'est là que mes mots-clés se trompaient de question : ils répondent à « que demande le client ? », pas à « Léa bloque-t-elle ? ».

**Le message du client ouvre un dossier. La friction, c'est ce que Léa fait ensuite quand elle ne sait pas :**

| Détour de Léa après le message de Jean | Ce que Screenpipe voit | Type (VISION) |
| --- | --- | --- |
| elle cherche Jean dans HubSpot : **0 résultat**, elle recommence | la page HubSpot « No results », plusieurs recherches de suite | recherche / blocage |
| **allers-retours** contact → entreprise → transaction → retour | 4 pages HubSpot en 30 s, deux fois les mêmes | tâtonnement |
| elle ouvre **Notion** et cherche « geste commercial » | Notion au premier plan, une recherche, une page relue | recherche |
| elle **demande sur Slack** « on peut offrir quoi à un premium ? » | texte tapé dans #support, finissant par « ? » | demande d'aide |
| **Jean attend** : pas de réponse dans Crisp après 3 min | la conversation sans nouveau message de l'agent | attente |
| elle répond en 20 s | rien d'anormal | pas une friction |

Donc : **des signaux simples repèrent l'épisode, ta qualification juge** (l'étape, le détour, la solution). Le message Crisp reste utile comme **contexte** : un client attend, voici qui il est, voici le sujet. Ça aide ton modèle à nommer la bonne étape.

## 2. Qui fait quoi

| Qui | Domaine | Concrètement |
| --- | --- | --- |
| **Andrea** | **Le cerveau** | qualification (IA), détection générique, apprentissage de nuit du détecteur, carte |
| **Haytham** | **La mémoire d'équipe** | chiffrement, partage, certification, page « Mon poste » |
| **Minguk** | **Les yeux et les oreilles** | lecture de Crisp (nom + message complet, ~1 s), appel (transcription en direct, 3–5 s), **détours HubSpot** (0 résultat, allers-retours : ton point faible mesuré), fiche du client |
| **Minguk** | **Le côté solution** | ton idée de nuit prolongée : friction réglée → **solution candidate** à certifier ; non réglée → **friction en attente** envoyée au responsable (VISION, étapes 3 et 7). Pour dimanche : un exemple préparé et une slide |

Personne ne refait le travail d'un autre, et ce soir on corrige le point le plus faible de la démo : le cas d'ouverture HubSpot, jamais capturé.

## 3. Tes points, un par un

| Ton point | Ma réponse |
| --- | --- |
| **Doublons sur un message Crisp** (mesuré sur Élodie) | Mon assistant ne décide plus d'aide quand le démon tourne. Il envoie au démon des épisodes et du contexte ; seule la **fiche client** reste chez moi (tu l'as dit : sans équivalent, sans conflit). Mêmes noms d'étapes que les tiens : `geste-commercial`, `promesse-commercial`, `signaler-bug`, `prospect-chat`, `client-introuvable`. |
| **La fiche client 🧭** | Elle répond à ton étape `client-introuvable`, mais en mieux : au lieu de « chercher par domaine », le lien direct vers la fiche de Jean, puisqu'on connaît son nom par Crisp. Proposition dans le guide : une solution « dynamique » remplie avec le contexte. |
| **L'appel et la voix du client** | D'accord : c'est une question d'équipe. La transcription passe par le cloud Screenpipe sur mon poste. `bun run call` reste une option, hors démo tant qu'on n'a pas tranché (quoi garder, combien de temps, local ou cloud). |
| **Emoji** | D'accord pour la règle de design Screenpipe : les emoji sont retirés des titres de mes notifications (il n'y avait pas de « ! »). |
| **Mots-clés** | Rétrogradés : secours seulement si le modèle ne répond pas (pas de réseau sur scène), annoncé comme tel. Jamais l'autorité. |
| **Correctif Mac** | Je le compile ce soir sur mon Mac et je te dis si le clic `api` arrive. |

## 4. Corrigé de mon côté avant ta session

- `FRICTION_PORT` était lu par ton démon (8787) **et** par mon notifieur (4517) : je l'ai renommé chez moi en `FRICTION_REDIRECT_PORT`. Tes réglages ne bougent pas.
- Plus d'emoji dans les titres de mes notifications.

## 5. Ce que j'attends de toi

1. Valider la répartition (section 2).
2. Mener la session de fusion avec [guide-fusion.md](guide-fusion.md) : surtout le point d'entrée des épisodes dans le démon, et qui envoie quelle notification.
3. Me dire où la fiche client se place dans ton déroulé (je propose 0:20, à côté de « Client introuvable »).
