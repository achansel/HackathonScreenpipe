# Proposition : le profil client (qui utilise notre produit ?)

> **Statut :** idée proposée au groupe, à discuter. Rien n'est décidé.
> Elle complète [VISION.md](VISION.md) et [UseCase.md](UseCase.md) : avant de choisir les frictions, savoir **de qui** ce sont les frictions.

## En bref

- **Pourquoi un profil précis :** chaque décision (quelles frictions, quelle démo, quel prix, quelle vie privée) devient plus simple si on peut se demander « est-ce que Léa bloquerait vraiment ici ? ».
- **« Qui utilise » désigne plusieurs personnes :** celle qui **paie**, celle qui **est aidée**, celle qui **donne la solution**, celle qui **répare le process**, et celles qui peuvent **bloquer** le projet.
- **Notre pari principal :** une start-up qui vend un logiciel par abonnement, en France, de 30 à 150 personnes, qui recrute vite et utilise Crisp, HubSpot et Slack.
- **À surveiller :** les centres de support externalisés, où chaque agent jongle avec les règles de plusieurs marques.

## 1. L'entreprise type

Une entreprise fictive mais typique, par exemple **« TableNow »**, un outil de réservation pour restaurants.

| Critère | Profil |
| --- | --- |
| **Activité** | vend un logiciel par abonnement à d'autres entreprises |
| **Taille** | 30 à 150 personnes, une levée de fonds il y a 1 à 3 ans, **en forte croissance** |
| **Où** | France ou Europe (Crisp est français et très répandu dans les start-up françaises) |
| **Outils** | HubSpot, Crisp et Slack ; un parc mixte Mac et Windows |
| **Organisation** | hybride ou à distance : impossible de se pencher vers le bureau d'à côté, tout passe par Slack |
| **Équipe support** | 5 à 15 personnes, **1 à 2 recrutements par mois** |
| **Règles** | elles changent souvent : nouveaux prix, nouvelles offres, nouveau process toutes les quelques semaines |

**Pourquoi cette entreprise a le problème :** elle recrute vite, ses règles changent vite, et personne n'a le temps d'écrire la documentation. Le savoir vit dans la tête de quelques anciens et dans des fils Slack.

## 2. Les personnes

### Claire, 34 ans, responsable du support : celle qui achète

- Elle encadre 10 agents et rend des comptes au COO.
- **Ce qui lui pèse :**
  - un nouvel agent met **6 à 8 semaines** à devenir autonome ;
  - ses meilleurs agents passent leurs journées à répondre aux collègues sur Slack au lieu des clients ;
  - elle découvre les erreurs trop tard (un mauvais prix annoncé, une vente ratée) ;
  - elle ne sait pas **où** le process casse, seulement que « ça traîne ».
- **Sur quoi on la juge :** le délai de réponse aux clients, la satisfaction client, le coût de l'équipe.
- **Ce qui la fait acheter :** « les nouveaux autonomes en 2 semaines au lieu de 8 », « mes anciens récupèrent leur temps ».
- **Ce qui lui fait peur :** que son équipe se sente surveillée.

### Léa, 24 ans, agente du support depuis 3 semaines : celle qui est aidée

- Premier ou deuxième emploi, parfois en alternance.
- Elle traite 40 à 60 conversations par jour dans Crisp.
- **Ce qui lui pèse :** peur de passer pour une idiote en reposant la même question sur Slack ; un client attend pendant qu'elle cherche ; elle ne connaît pas les règles non écrites.
- **Le point clé :** **l'anonymat compte vraiment pour elle.** Elle préfère chercher seule 15 minutes que demander en public. Notre règle « personne ne sait qui a demandé » n'est pas qu'une précaution juridique : **c'est ce qui la fera utiliser le produit.**
- **Ce qu'elle veut :** « Aidez-moi sans que personne sache que je bloquais. »

### Karim, 29 ans, agent senior : celui qui a la solution

- 3 ans dans l'entreprise, il connaît toutes les règles.
- **Ce qui lui pèse :** il est sollicité **15 à 20 fois par jour** sur Slack, toujours pour les mêmes questions, et son propre travail en souffre.
- **Ce qu'il veut :** répondre une fois, plus jamais, et un peu de reconnaissance (« ta solution a aidé 23 personnes »).
- **Le risque :** si partager demande un effort, il ne le fera pas. Le bouton « partager » doit tenir en un clic.

### Hugo, 31 ans, administrateur HubSpot (« RevOps ») : celui qui répare le process

- Il configure HubSpot : champs obligatoires, pipelines, droits.
- **Ce qui lui pèse :** il ne sait jamais qu'un champ qu'il a créé bloque 30 personnes par mois.
- **Ce qu'il veut :** « Dites-moi quoi corriger dans ma configuration, avec des preuves. »

### Les garde-fous : le CSE, le DPO, la DSI

- **En France, avant d'installer un outil qui pourrait surveiller les salariés, l'entreprise doit informer et consulter le CSE, et le DPO doit l'examiner** (analyse d'impact RGPD).
- **C'est pour cela que notre vie privée est un argument de vente, pas seulement un principe :** « on mesure le process, jamais la personne » est ce qui fera accepter l'outil.

## 3. Les autres types de clients possibles

| Type | Pourquoi le besoin pourrait être plus fort | Le doute |
| --- | --- | --- |
| **Centres de support externalisés** (des entreprises qui répondent aux clients de 5 à 10 marques) | chaque agent jongle avec **des règles différentes selon la marque**, la friction est permanente ; fort turnover | grosses structures, achats plus lents |
| **Boutiques en ligne avec du personnel saisonnier** (Black Friday, Noël) | des renforts embauchés pour 4 semaines, sans temps pour les former | il faut Shopify ; activité saisonnière |
| **Équipes commerciales** (HubSpot en premier) | règles de remise, validations, ventes bloquées | moins de recrutements que le support |
| **Notre pari : les start-up logicielles en croissance** | colle exactement à la stack, changements rapides, français | budgets plus petits |

**À surveiller, les centres de support externalisés :** un agent qui gère 8 marques avec 8 règles de remboursement différentes, c'est sans doute **la version la plus extrême de notre problème**. Intéressant pour plus tard.

## 4. Un prérequis à garder en tête

Notre produit ne marche que si **Screenpipe est installé sur l'ordinateur de chaque salarié**. Le vrai client est donc une entreprise **déjà ouverte à Screenpipe**, ou qui l'installe pour cette raison.

C'est un argument fort face au jury Screenpipe : **notre produit donne aux entreprises une raison d'installer Screenpipe sur toute une équipe.**

## 5. Les hypothèses à vérifier

À confirmer en parlant à 2 ou 3 vraies personnes du support (réseau 42, communauté Crisp, amis en start-up). Un appel de 15 minutes peut confirmer ou tuer une hypothèse.

1. Un nouvel agent met-il vraiment 6 à 8 semaines à devenir autonome ?
2. Hésite-t-il vraiment à demander sur Slack, par peur de passer pour un idiot ?
3. Un senior est-il vraiment sollicité plus de 15 fois par jour ?
4. Qui paierait : Claire, ou le COO ?

## 6. Questions pour le groupe

1. Est-ce qu'on garde **Léa (celle qui bloque)** et **Claire (celle qui achète)** comme personnages principaux pour la suite ?
2. Notre pari principal (start-up logicielle) nous convient-il, ou vise-t-on plutôt les centres de support externalisés ?
3. Qui peut organiser un appel de 15 minutes avec une vraie personne du support d'ici samedi ?
4. Le prérequis « Screenpipe sur chaque poste » : on le dit dans le pitch comme un argument, ou on le garde pour les questions du jury ?
