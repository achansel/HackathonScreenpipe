# Proposition : le cas d'usage « support client » (Crisp + HubSpot + Slack)

> **Statut :** idée proposée au groupe, à discuter. Rien n'est décidé.
> Elle s'inscrit dans la vision ([VISION.md](VISION.md)) : l'assistance pendant les frictions, sans surveiller personne.

## En bref

- **Le terrain :** une start-up de 30 personnes qui utilise Crisp, HubSpot et Slack en même temps.
- **Le problème :** chaque appli ne détient qu'**un morceau** de l'information. Crisp a la question du client, HubSpot sait qui il est, et la réponse est dans la tête d'un collègue, sur Slack. La friction naît quand on doit sauter d'une appli à l'autre.
- **Notre réponse :** dès qu'un de ces sauts se produit, Screenpipe apporte la règle de l'équipe dans une notification, au bon moment.
- **Pour la démo :** une journée type de Léa, nouvelle au support, fournit 6 frictions concrètes et crédibles, dont celle déjà prévue (le remboursement).

## 1. L'entreprise type

Une start-up de 30 personnes qui vend un logiciel par abonnement mensuel, par exemple un outil de réservation pour restaurants.

| Appli | Ce que c'est | Qui y passe ses journées |
| --- | --- | --- |
| **Crisp** | la bulle de chat du site : les clients y écrivent | le support, toute la journée |
| **HubSpot** | la base clients : qui est le client, ce qu'il paie, qui s'en occupe, les notes, les ventes en cours | les commerciaux, les account managers, parfois le support |
| **Slack** | la messagerie interne entre collègues | tout le monde, pour se poser des questions |

## 2. Une journée de Léa, agente du support (2 semaines de poste)

| Heure | Situation | Ce qui se passe | Friction | Solution connue dans l'équipe |
| --- | --- | --- | --- | --- |
| 9 h 05 | **« C'est qui ? »** | Crisp : « jean.d@gmail.com » écrit « Ma page de réservation est en panne !! ». Dans HubSpot, aucun résultat : il y est enregistré en « jean.dupont@restaurant-lebistro.fr ». « Jean » donne 14 résultats, « Bistro » 3 entreprises (des doublons). Elle finit par demander sur Slack : « Quelqu'un connaît un Jean qui a un restaurant ? » | l'e-mail diffère d'une appli à l'autre | chercher par numéro de téléphone ou par domaine du site |
| 9 h 20 | **« Il paie quoi ? »** | Les clients premium ont droit à un appel. La fiche contact n'affiche pas l'offre : contact → entreprise → transactions → contrat signé → liste des produits. Elle fait 4 allers-retours. | l'info existe, mais à 4 clics de profondeur | le chemin exact, ou un champ personnalisé qui l'affiche |
| 9 h 40 | **« Je préviens qui ? »** | Le bug est grave, l'équipe tech doit le savoir. Elle poste dans #general, on lui répond : « Pas ici, dans #bugs, avec le modèle. » Elle doit aussi créer un ticket HubSpot lié au client, mais il y a deux pipelines : « Support » et « Support OLD ». | une règle d'équipe jamais écrite | le modèle de #bugs, le pipeline « Support » et *[à compléter : la fin de la règle a été coupée]* |
| 11 h 00 | **« Je peux lui faire un geste ? »** | Crisp : Jean est furieux, « J'ai perdu des réservations, je veux un dédommagement. » Elle ne connaît pas la règle, écrit à sa manager en message privé et attend 1 h 30. Pendant ce temps, Jean attend dans Crisp. | une règle que seule la manager connaît | « 1 mois offert au maximum, seulement pour les premium, ajouter la note "geste commercial" dans HubSpot » |
| 14 h 00 | **« Le commercial a promis quelque chose »** | Crisp : un nouveau client affirme « Thomas m'a promis l'installation gratuite. » Rien dans les notes de la vente sur HubSpot. Elle écrit à Thomas, qui est en réunion. Elle attend. | la promesse n'existe que dans un message privé Slack | règle d'équipe : les commerciaux notent leurs promesses dans le champ « Conditions particulières » de la vente |
| 15 h 30 | **« Un prospect, pas un client »** | Crisp : « Bonjour, combien pour 3 restaurants ? » C'est un prospect, pas du support. Elle doit créer le contact dans HubSpot, mais avec quel « lifecycle stage » ? Quel responsable ? Sur Slack : « Qui prend les prospects belges ? » | la règle de passation des prospects | Belgique → Sarah, stage « Lead », puis un message dans #new-leads |
| 17 h 00 | **« Tout recopier »** | Elle recopie chaque conversation Crisp dans la fiche HubSpot du client, à la main : l'intégration n'est pas activée. | ressaisie quotidienne | activer l'intégration Crisp → HubSpot (une correction de process, à faire par la manager) |

## 3. La journée de Thomas, commercial (en plus court)

- **Champ bloquant :** il ne peut pas clôturer une vente dans HubSpot, à cause du champ obligatoire « numéro SIREN ». Où le trouver ? Il demande sur Slack.
- **Validation qui traîne :** une remise de plus de 15 % doit être validée dans #deal-desk. Il attend 2 jours, puis relance : « Des nouvelles ? »
- **Passation floue :** après la signature, qui installe le client ? Il poste « Le Bistro a signé ! » sur Slack, mais personne ne sait qui s'en charge.
- **Réponses contradictoires :** le client contacte le support sur Crisp sans que Thomas le sache. Deux personnes lui répondent différemment.

## 4. Les frictions, classées par saut entre applis

| Saut | Frictions typiques |
| --- | --- |
| **Crisp → HubSpot** | client introuvable (e-mail différent) ; offre cachée à 4 clics ; conversation recopiée à la main ; transformer un chat en prospect |
| **HubSpot → Slack** | champ bloquant, on demande qui sait ; remise à faire valider, puis l'attente ; le responsable du compte a quitté l'entreprise |
| **Crisp → Slack** | « Est-ce que je peux promettre ça au client ? » ; quel canal et quel modèle pour un bug |
| **Slack → HubSpot** | la réponse est donnée sur Slack mais jamais notée dans HubSpot : la personne suivante repose la question |
| **Les trois** | client en colère : question dans Crisp → vérification dans HubSpot → validation sur Slack → retour dans Crisp |

Ces frictions couvrent presque tous les types de détour de la vision : **blocage** (champ obligatoire), **demande d'aide** (Slack), **recherche** (client introuvable), **tâtonnement** (les 4 allers-retours), **ressaisie** (recopier le chat), **attente et relance** (la remise).

## 5. Ce que Screenpipe apporterait

### 5.1 Des suggestions dès qu'une demande client arrive

Quand un message arrive dans Crisp et que l'agent commence à chercher, une seule notification peut proposer plusieurs aides à la fois :

1. **Le bon lien :** la page qui fait avancer (le chemin exact dans HubSpot, la page d'aide interne).
2. **Le bon interlocuteur :** si une personne doit intervenir, le canal Slack à utiliser et son modèle de message, déjà rédigé.
3. **La bonne méthode pour retrouver le client :** par exemple « cherche par domaine ou par téléphone ».

### 5.2 Mieux exploiter les notifications de Screenpipe

Ce qu'on sait déjà des notifications (testées sur Mac) :

- texte en markdown et jusqu'à 5 boutons ;
- les boutons restent actifs dans l'historique de la cloche ;
- sur Mac, c'est un panneau natif qui flotte au-dessus des fenêtres.

Pistes pour l'interaction :

- **Copier en un clic :** un bouton qui copie le modèle de message Slack ou la note HubSpot, prêt à coller.
- **Afficher l'extrait :** le texte utile directement dans le corps de la notification, pour ne pas avoir à cliquer.
- **Préparer la réponse :** un bouton qui ouvre le chat Screenpipe avec une proposition de réponse au client, à relire avant envoi.

## 6. Points de vigilance (au regard de VISION.md)

- **Ne pas recréer « Tab universel », qui a été écarté.** La suggestion de texte doit rester **une aide ponctuelle, déclenchée par une friction**, et non une autocomplétion permanente.
- **Pas de modification de l'overlay de Screenpipe, écartée elle aussi.** Tout doit passer par `/notify`, les Live Views et les pipes.
- **Les données du client ne quittent pas la machine.** Le nom, l'e-mail et la commande de Jean apparaissent à l'écran, mais n'entrent **jamais** dans la signature. Seule la règle (« chercher par domaine ») est partagée.
- **L'anonymat de Léa :** celui qui a la solution voit « quelqu'un bloque sur cette étape », jamais son nom.
- **Réparer le process :** l'intégration Crisp → HubSpot non activée et la promesse non notée sont des exemples parfaits de l'étape 7 de la boucle (la demande de correction envoyée au responsable).

## 7. Proposition pour la démo

Garder le scénario déjà prévu (**le remboursement**, la friction de 11 h) comme fil principal, parce qu'il traverse les trois applis. On peut y ajouter, si on a le temps, une deuxième friction courte et très visuelle, au choix :

- **9 h 05, client introuvable :** la notification « cherche par domaine » débloque Léa en quelques secondes ;
- **14 h 00, promesse du commercial :** montre le saut Slack → HubSpot et la correction de process.

## 8. Questions pour le groupe

1. Est-ce qu'on valide la journée de Léa comme histoire de la démo ?
2. Quelle deuxième friction ajouter, s'il en faut une ?
3. Faut-il un client fictif Crisp par friction (voir [docs/crisp.md](docs/crisp.md)) ? Par exemple Jean Dupont pour la panne.
4. Le bouton « copier en un clic » : on le garde pour la démo, ou on le met sur la feuille de route ?
5. Qui complète la règle du ticket de 9 h 40 (la fin a été coupée dans le brouillon) ?
