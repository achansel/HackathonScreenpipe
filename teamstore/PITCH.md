# Pitch : 3 minutes, illustré par le parcours guidé

> Texte d'environ 430 mots, calé sur le parcours guidé (`http://127.0.0.1:4322/parcours`, voir [PARCOURS.md](PARCOURS.md)).
> La démo réelle avec les vrais outils reste le déroulé d'Andrea ([andrea/docs/demo.md](../andrea/docs/demo.md)). Le parcours sert à illustrer le récit.

## Avant de commencer

- Ouvrir `http://127.0.0.1:4322/parcours` et **recharger la page** juste avant de monter sur scène, pour repartir d'une équipe neuve.
- Cocher **« Notifications Screenpipe réelles »**, avec Screenpipe visible à l'écran.
- **Ne pas utiliser le mode présentation automatique**, qui impose son propre rythme. Une deuxième personne clique le bouton bleu au signal **[clic]**, pendant que l'orateur parle.

## Le texte, minute par minute

| Temps | À l'écran | Texte |
| --- | --- | --- |
| **0:00** | Chapitre 1 affiché, rien cliqué | « **Une friction se paie une fois, pas dix.** Mais de quelle friction parlons-nous ? Imaginez Léa, arrivée il y a deux semaines chez PipingTable, une start-up qui vend un logiciel de réservation aux restaurants. Neuf heures cinq : un client, Jean Dupont, lui écrit sur Crisp. Sa page de réservation est en panne. Léa le cherche dans HubSpot… » |
| **0:15** | **[clic]** « Léa cherche… dans HubSpot » : 0 résultat, puis l'agent s'allume | « … zéro résultat. Il a écrit avec une autre adresse que celle du contrat. Normalement, Léa cherche dix minutes, demande sur Slack, attend. Et demain, Yasmine fera exactement pareil. Ces règles ne sont écrites nulle part : elles vivent dans la tête de Karim, trois ans de maison. » |
| **0:30** | La notification apparaît sur l'écran de Léa | « Avec friction-assist, **Screenpipe voit l'écran de Léa**. Notre agent reconnaît la friction, et la solution que Karim a trouvée hier arrive dans une notification Screenpipe. Deux secondes, et rien n'a quitté son poste. » |
| **0:45** | **[clic]** « Ça m'a aidé » ; chapitre 2, **[clic]** « Léa demande sur Slack » | « Onze heures. Jean veut un dédommagement. Cette fois, Léa n'a pas la réponse. L'agent envoie alors à l'équipe une **demande anonyme** : seulement l'étape, ni son nom, ni celui du client. » |
| **1:00** | Montrer le panneau « Ce que lit l'équipe / Ce que voit le serveur », puis la bande noire | « Regardez ce que voit notre serveur : des blocs chiffrés, tous de la même taille. Il ne sait ni qui, ni quoi. » |
| **1:10** | **[clic]** « Claire clique Partager » : la solution arrive chez Léa | « Claire, la responsable, reçoit "un collègue bloque" et clique Partager. Quelques secondes plus tard, Léa a la réponse. Claire ne saura jamais qui demandait. » |
| **1:25** | **[clic]** « Léa répond » ; chapitre 3, Notion barré contre Slack, **[clic]** « Claire certifie » | « Mais qui croire ? La doc Notion dit deux mois, Slack dit un mois. Claire **certifie** la bonne règle, avec une signature que personne d'autre ne peut fabriquer. » |
| **1:40** | **[clic]** « Suite » ; chapitre 4, **[clic]** recherche, compte à rebours, puis la notification Slack | « Et si personne ne sait ? L'outil propose le bon canal Slack, avec la question déjà rédigée. Léa n'est jamais seule. » |
| **1:55** | **[clic]** ; chapitre 5 « La nuit », **[clic]** « Lancer la boucle de nuit » | « C'est là que notre agent **se souvient**. La nuit, le poste de Léa relit ce qui a suivi son blocage. L'IA voit qu'elle s'en est sortie, écrit la règle sans aucun nom, et la propose à Claire. » |
| **2:10** | **[clic]** « Claire certifie la proposition » | « Le matin, Claire relit, clique, et la règle entre dans la mémoire de toute l'équipe. Personne n'a écrit de documentation. » |
| **2:20** | **[clic]** ; chapitre 6 « Le lendemain », **[clic]** « Yasmine ouvre la conversation » | « Le lendemain, Yasmine bloque au même endroit. La réponse est déjà là. **La friction ne s'est payée qu'une fois.** » |
| **2:30** | **[clic]** jusqu'à la carte (chapitre 8 ; passer vite sur le 7) | « Et la responsable voit **où** son process coince. Jamais **qui** : on mesure le process, pas la personne. » |
| **2:40** | Rester sur la carte, puis Screenpipe | « Tout ce que Léa voit vit dans Screenpipe : les notifications, les Live Views, le modèle qu'elle a choisi. Notre agent s'appuie sur leur API ouverte, et nous leur proposons trois évolutions pour l'embarquer. Consentement, pause, chiffrement de bout en bout. Et ce n'est pas une maquette : la détection tourne en direct, le partage passe par une vraie base chiffrée, et chaque étape est mesurée. » |
| **2:55** | — | « friction-assist : **chaque friction ne se paie qu'une fois.** » |

## Pour tenir les 3 minutes

- **Répéter deux fois avec le chronomètre.** Le chapitre 5 attend la vraie IA, environ 3 à 5 s : c'est là qu'on dit la phrase sur la nuit.
- **Si ça déborde**, on peut sacrifier le chapitre 4 (« Personne ne sait ») et le chapitre 7 (« Karim part »), sans perdre le fil.
- **Si Screenpipe n'est pas joignable**, le chapitre 5 affiche un verdict préparé, et le dit. Ne pas prétendre que c'est l'IA en direct.

## Réponses prêtes pour les 2 minutes de questions

- **« Vous surveillez les employés ? »** Non. On compte des détours par étape. Les données d'équipe n'ont aucune identité, et le serveur ne voit que du chiffré : on peut le montrer avec la vue opérateur et les attaques de la page « Équipe simulée ». Il y a aussi un consentement et un bouton pause.
- **« Ça marche vraiment ? »** Les délais sont mesurés : aide en 3 s, demande en 3 s, partage en 7 s, 59 ms entre deux postes sur Supabase. Les limites sont écrites dans `andrea/ETAT.md` et `teamstore/MESURES.md`.
- **« Et si l'IA invente une règle ? »** Elle propose seulement : rien n'entre dans la mémoire sans la responsable. Une règle qui contient un nom, un e-mail ou un téléphone est refusée.
- **« La boucle de nuit est fiable ? »** Elle juge bien 28 cas sur 28 dans nos tests, mais **sur des cas que nous avons écrits nous-mêmes**. Il faut le dire tel quel.

## À vérifier en équipe avant de le dire sur scène

- **La phrase sur les « trois évolutions »** reprend le pitch d'Andrea. Sa démo utilise un Screenpipe patché sur Mac : on ne doit donc pas dire « sans fork », mais « on leur propose le correctif ».
- **« La détection tourne en direct »** suppose que la démo réelle d'Andrea soit jouée aussi, ou au moins citée. Le parcours lui-même met en scène l'écran de Léa.
