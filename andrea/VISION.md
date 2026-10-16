# Handover — Assistance aux frictions

Oct 15, 2026 · @A

## En bref

On construit un agent qui repère les frictions au travail et apporte l'aide au moment où quelqu'un bloque, à partir de ce que l'équipe a déjà vécu, sans surveiller personne.

**Le pitch :** « Chaque friction ne se paie qu'une fois, pas dix. »

**Verrouillé :**

- **Le sujet :** l'assistance pendant les frictions, plus l'onboarding.
- **Le principe :** aider quand il y a besoin. L'onboarding se fait naturellement, friction après friction.
- **La ligne rouge :** on mesure le process, jamais la personne. On ne capture et on n'analyse que ce qui est nécessaire.
- **La vie privée de celui qui demande de l'aide** est protégée, y compris pendant l'assistance en direct.
- **L'intégration :** tout vit dans Screenpipe, sans fork, sur Windows comme sur Mac.

**Encore ouvert** (voir *Questions ouvertes*) : le nombre d'utilisateurs avant qu'une friction apparaisse, le contenu exact de ce qui quitte une machine, l'anonymat de celui qui demande face à celui qui aide, le choix du modèle d'IA (local ou cloud), et le nom du projet.

**À faire en premier :** les tests de la section *Plan*, aujourd'hui. Louis et Ezra répondent sur Discord jusqu'à 17 h–19 h environ.

## Pourquoi la friction plutôt que l'onboarding

L'onboarding en tant que phase à part, c'est une vieille approche ; la bonne approche, c'est d'aider au moment où on en a besoin.

- **L'onboarding classique est une vieille technologie.** Formations, wikis, vidéos, parcours guidés : on fait apprendre à l'avance des choses qu'on oubliera, et qui seront fausses dès que le process change.
- **Personne ne sort vraiment de l'onboarding.** Un nouveau outil, un process modifié, une exception rare : un salarié de dix ans bloque aussi. Le besoin n'est pas « former les nouveaux », c'est « débloquer n'importe qui, au bon moment ».
- **L'onboarding se fait alors naturellement :** chaque friction résolue apprend quelque chose à la personne, sans programme à suivre.
- **Le marché de l'onboarding est déjà occupé.** Tango et WalkMe font des parcours guidés, Scribe des guides, et Screenpipe génère déjà des SOP en page et en vidéo.
- **C'est là que vont aller les autres équipes.** Le starter pousse vers les SOP, l'onboarding et les passations : avec environ 25 équipes, la friction nous démarque.
- **C'est dans le thème** (*Build Agents That Remember*) : l'agent se souvient d'où le travail a cassé et de comment il a été réparé, et ressort la réponse au bon moment.
- **C'est ce que Screenpipe ne fait pas.** Leurs workflows ont bien un champ « goulots d'étranglement », mais pour un workflow d'une personne, après coup, et sans aide en direct. Et le partage de contexte entre collègues n'est pas inclus dans Business.

## Le produit : la boucle de la friction

Chaque friction résolue devient l'aide de la suivante, sans que personne ait à écrire un wiki.

&#91;embedded content: la boucle de la friction · 7 étapes, local puis équipe\]

L'analyse se fait sur la machine de chacun ; le serveur d'équipe ne reçoit que des signatures, et l'aide revient dans Screenpipe.

1. **Capturer :** Screenpipe enregistre en local sur chaque machine, avec les exclusions.
2. **Repérer un détour :** des signaux simples (erreur, demande d'aide, recherche, contournement).
3. **Qualifier :** l'IA lit seulement les minutes autour du signal et produit une signature anonyme : l'étape, le type de détour, la résolution.
4. **Rapprocher :** le serveur d'équipe regroupe les mêmes frictions vécues par plusieurs personnes.
5. **Aider en direct :** la personne qui bloque reçoit la solution dans le panneau de notifications de Screenpipe, sans que son nom soit révélé. Celui qui avait la solution l'a partagée par choix.
6. **Montrer la carte :** les détours par étape, dans une Live View de Screenpipe.
7. **Réparer le process :** l'agent écrit la page de wiki manquante et envoie la demande de correction au responsable du process.

## Ce qu'on détecte

Une friction, c'est un détour : un moment où la personne doit sortir du chemin prévu pour que le travail avance. On compte des détours sur des étapes de process, jamais du temps passé par quelqu'un.

**Ce qui est une friction, et ce qui n'en est pas.** Une friction est rattachée à une **étape de process**, elle est **répétable par d'autres personnes**, et quelqu'un dans l'équipe en connaît la solution (une règle, un chemin, un interlocuteur). Une **panne technique n'est pas une friction de process** : une erreur 404, un port qui refuse la connexion, un timeout, un bug de l'outil. On ne les traite pas (une personne n'a pas besoin d'un collègue pour ça, et il n'y a aucune étape de process à réparer). Un accès refusé ou un champ obligatoire qui s'explique par une règle de l'équipe, lui, en est une.

| Type de détour | Ce que Screenpipe voit |
| --- | --- |
| Blocage | un formulaire refusé, un accès refusé, un champ obligatoire obscur, une règle d'équipe qui empêche d'avancer |
| Parcours | un chemin de liens anormalement long ou répété pour atteindre une information : plusieurs clics de profondeur (contact → entreprise → transactions → contrat), des retours en arrière, la même page relue plusieurs fois, des allers-retours entre un wiki et l'outil |
| Demande d'aide | une question sur un outil ou un process (Slack, mail), un appel improvisé, un ticket au support interne |
| Recherche | le wiki, l'intranet, Notion ou Google ouverts au sujet de l'outil en cours ; la même page relue plusieurs fois |
| Tâtonnement | des allers-retours entre les mêmes écrans, un envoi retenté, une tâche abandonnée puis recommencée |
| Ressaisie | la même donnée visible dans deux applis, recopiée à la main |
| Contournement | un export vers Excel pour faire ce que l'outil ne fait pas, une capture envoyée à un collègue, un fichier perso « à côté » |
| Attente et relance | « tu as pu regarder ? », une validation qui n'arrive pas |

**La détection se fait en deux temps :**

1. **Des signaux simples** repèrent des épisodes candidats, sans règle propre à une appli. Une demande d'aide se reconnaît à son contenu, pas à l'appli où elle est écrite. Le **parcours de liens** se lit sans le contenu des pages : la suite des titres de fenêtres et des URL (`window_name`, `browser_url` — fiable sous Chrome, pas sous Firefox) et les changements d'appli ou de fenêtre (`/search?content_type=input`).
2. **Un modèle d'IA qualifie chaque épisode :** le type de détour, l'étape concernée, et la résolution s'il y en a une. Il ne lit que les quelques minutes autour du signal.

Ajouter une nouvelle appli ne demande aucun code. En démo, on montre 3 ou 4 types qui marchent parfaitement (blocage, demande d'aide, recherche, contournement) ; les autres vont sur la slide de feuille de route.

## Le traitement hors ligne (verrouillé)

L'apprentissage ne se fait **pas en direct**. Il tourne en différé, pour l'équipe, et ne sert qu'à produire un détecteur que les machines exécutent ensuite très vite, sans appel à un modèle.

1. **Entrée :** les épisodes de chaque machine, produits en local (titres de fenêtres, texte nettoyé, événements d'entrée horodatés). Rien de brut ne quitte la machine sans accord.
2. **Traitement planifié** (un pipe Screenpipe, lancé la nuit) : un modèle regroupe et étiquette les épisodes, puis **régénère le code du détecteur**.
3. **Porte de validation :** un nouveau détecteur ne remplace l'ancien que s'il le bat sur des épisodes qu'il n'a pas vus.
4. **Sortie :** le détecteur déployé sur les machines via Teams, et des **signatures anonymes** vers le serveur d'équipe.

**En quoi ce n'est pas la fonction « workflows » de Screenpipe** (analyse d'une personne, à la demande, qui produit un rapport) : la nôtre regroupe la même friction vécue par **plusieurs personnes** (avec un seuil), s'applique à une **étape de process** et non à un workflow personnel, produit un **détecteur exécuté en direct** et une base « friction → solution » plutôt qu'un rapport, repose sur la solution qu'un collègue **choisit de partager**, et débouche sur la réparation du process. On réutilise de leur côté le planificateur de pipes, `/activity-ledger` et `/activity-summary` comme événements élémentaires, et Teams pour la distribution.

**Mesuré sur un jeu synthétique de 52 cas** (frictions de process, parcours de liens compris, et cas normaux difficiles ; à refaire sur de vrais épisodes, voir `bench/`) : un modèle qui lit texte et titres détecte la friction sans fausse alerte (F1 97 % sur 26 cas de test, environ 1,1 s) ; du code de détection écrit par le modèle atteint 77 % de F1 sur des cas jamais vus, à latence nulle, avec 3 fausses alertes ; des règles écrites à la main restent à 59 %. Les titres seuls (sans texte) ne suffisent pas (rappel 44 %), même pour les parcours de liens. Ces chiffres sont à prendre avec prudence : texte propre, étiquettes de l'auteur, quelques dizaines de cas.

## Vie privée : la ligne qu'on ne franchit pas

On mesure le process, jamais la personne : c'est à la fois notre conviction, une exigence du jury et du droit européen, et ce que la doc de Screenpipe impose (pas de surveillance cachée, pas de note de productivité).

**Capturer le nécessaire, en trois couches :**

1. **Capture : chacun garde sa propre mémoire, en local, avec des exclusions.** On exclut ce qui est sensible : messageries perso, banque, santé, navigation privée, gestionnaires de mots de passe. Screenpipe permet de couper toute une catégorie d'un interrupteur, et l'admin peut pousser les mêmes exclusions à toute l'équipe via Teams. Pas de capture clavier : les messages envoyés se lisent à l'écran. Pas de transcription audio : seulement le fait qu'un appel a eu lieu (à vérifier).
2. **Analyse : étroite.** L'agent ne parcourt jamais l'historique. Il ne se déclenche que sur un signal de friction, et ne lit que les quelques minutes autour, dans les applis concernées.
3. **Partage : minimal.** Seule une signature anonyme quitte la machine (l'étape, le type de détour, la résolution). Rien de brut n'est partagé sans accord.

**La vie privée de celui qui demande de l'aide :**

- Sa demande n'est **jamais affichée avec son nom**. Celui qui a la solution voit seulement « quelqu'un dans l'équipe bloque sur cette étape ».
- Le texte de son message **ne quitte pas sa machine** : seule la signature circule.
- C'est **lui qui décide** de se faire connaître, par exemple pour lancer une conversation avec celui qui a la solution.
- **Celui qui a la solution choisit** de la partager ou non : un bouton « Partager ma solution », jamais d'envoi automatique.

**Ce qu'on ne mesure jamais :** la productivité, le temps passé par une personne, les classements, qui demande le plus d'aide.

**Les règles d'affichage, selon l'usage :**

| Usage | Règle |
| --- | --- |
| Pour soi | aucun seuil : mes détours ne sont visibles que par moi |
| Assistance en direct | pas de seuil, mais le consentement de celui qui a la solution, et l'anonymat de celui qui demande |
| Carte d'équipe | un seuil qui dépend du nombre de personnes qui font l'étape, des fourchettes plutôt que des chiffres exacts, regroupées à la semaine. Le seuil exact est une question ouverte |
| Signalement volontaire | « je signale cette friction » : passe outre le seuil |

Phrase de pitch : « Screenpipe peut tout voir ; nous avons choisi de ne regarder que le process. »

## Questions ouvertes à trancher en équipe

Ces points restent volontairement ouverts ; à trancher avant samedi, pour que le pitch soit cohérent.

**Le nombre d'utilisateurs**

- [ ] Quel seuil pour qu'une friction apparaisse sur la carte d'équipe ? Un nombre fixe (3 était arbitraire : à 4, c'est presque toute l'équipe) ou un seuil qui dépend du nombre de personnes qui font l'étape (par exemple au moins 5) ?
- [ ] Une friction répétée par une seule personne : on la montre à elle seule, ou jamais ?
- [ ] Pour la démo à 3 ou 4 : population synthétique pour la carte (autorisé par les organisateurs), annoncée comme telle.

**La vie privée**

- [ ] Que contient exactement la signature qui quitte la machine : des catégories seulement, un texte d'erreur normalisé, un vecteur de similarité (qui peut laisser deviner le contenu) ? Décidé : la transcription audio peut rester en local (elle aide la détection), mais aucun texte issu de l'audio ne doit entrer dans une signature.
- [ ] Qui voit la carte : toute l'équipe (transparence) ou seulement le responsable du process ?
- [ ] Combien de temps garde-t-on les signatures ?
- [ ] La liste exacte des exclusions par défaut, et comment chacun met en pause ou se retire.
- [ ] Modèle d'IA pour qualifier les épisodes : local (Ollama, rien ne sort) ou cloud (meilleure qualité) ?
- [ ] Où tourne le serveur partagé, et chiffre-t-on les signatures ?

**L'assistance en direct**

- [ ] Celui qui demande reste-t-il anonyme jusqu'au bout, ou peut-il lever l'anonymat en un clic ?
- [ ] Faut-il éviter de notifier celui qui a la solution à chaque fois (fatigue) : solutions pré-partagées, plafond par jour ?
- [ ] Le moment de l'aide : dès le blocage, ou seulement quand la personne commence à chercher de l'aide (recherche, message) ?
- [ ] Le nom du projet.

**Les données d'un tiers (le client)**

- [ ] Le client dont le nom et la commande apparaissent à l'écran (Crisp, HubSpot) n'a rien consenti : comment les exclure de la signature, et du texte lu par le modèle d'IA, au-delà des exclusions d'applis ? (le filtre `filter_pii` de `/search` existe, à tester)
- [ ] Capture-t-on les messages d'un chat client en direct (Crisp) ? Si oui, avec quelle information du client, et sinon, comment détecter la friction sans lire ces messages ?
- [ ] La règle maison partagée (par exemple un seuil de remboursement) est-elle validée par le responsable du process avant d'être proposée à d'autres, pour ne pas propager une erreur ?

**La mesure de la donnée**

- [ ] Quels outils lisent bien à l'écran (texte natif ou OCR) ? À mesurer pour Slack, HubSpot, Crisp, Notion et Shopify, avec un marqueur de test et le délai de capture.
- [ ] L'audio : il peut rester transcrit en local pour aider la détection, mais on tranche ce qu'on garde, combien de temps, et ce qui est affiché (voir la question sur la signature).

## Architecture : tout dans Screenpipe

Aucun fork et aucune nouvelle app : on ne passe que par l'API de Screenpipe et par les surfaces de leur app, qui sont identiques sur Windows et sur Mac. Notre code est du TypeScript sous Bun, sans aucun code natif.

| Brique | Comment |
| --- | --- |
| Détection en direct | un petit programme Bun sur chaque machine interroge `GET /search` sur `localhost:3030` toutes les quelques secondes (jeton : `screenpipe auth token`) |
| Qualification des épisodes | un modèle d'IA appelé en local par ce programme, sur les seules minutes autour du signal |
| Assistance en direct | le panneau de notifications de Screenpipe : `POST http://127.0.0.1:11435/notify`, avec du texte en markdown et jusqu'à 5 boutons |
| Consentement de celui qui a la solution | une notification « Partager ta solution ? » dont le bouton appelle notre serveur |
| Carte d'équipe | une Live View, un tableau de bord **dans** l'app Screenpipe, alimenté par un pipe (`GET /live-views/schema` donne les blocs disponibles) |
| Wiki et demande de correction | le chat de Screenpipe (l'agent Pi) et ses connecteurs (Slack, Notion, Linear) |
| Analyses de fond | un pipe (`pipe.md`), qui tourne dans leur app sur les deux systèmes |
| Distribution | Teams : l'admin pousse le même pipe et les mêmes exclusions à toute l'équipe |
| Serveur partagé | un petit serveur Bun qui ne reçoit que des signatures anonymes |
| Aide dans une appli web (bonus) | une extension pour les navigateurs Chromium, qui affiche l'aide à côté du bon champ |

**Les boutons possibles dans une notification :** `deeplink` (sauter au bon moment de leur timeline, avec `screenpipe://`), `chat` (ouvrir leur chat avec une demande et du contexte), `pipe` (lancer un pipe avec du contexte), `api` (appeler un endpoint local, comme notre serveur), `link`, `dismiss`. Les notifications restent dans l'historique de la cloche.

**Ce qu'on ne fait pas :** modifier leur overlay. Il y a deux implémentations natives différentes (Windows et macOS), compiler leur app est lourd, et une app compilée à la main perd ses permissions sur Mac.

**Faits vérifiés dans leur code** (`main` du 14 octobre) : `/notify` et ses boutons, les Live Views, les exclusions par catégorie, les filtres de fenêtres et d'URL poussés par Teams, la détection des réunions sur macOS et Windows, la capture clavier désactivée par défaut. En version gratuite, l'historique est limité à 24 h : il faut l'accès Business sur les 3 machines.

## La démo, les données et la soumission

La vidéo est notre livrable n°1 : environ 25 équipes et une présélection avant la finale. La démo en direct, elle, sert pour la finale de dimanche.

**Le déroulé (environ 2 minutes, pour une finale de 3 minutes de démo + 2 minutes de questions : la minute de marge sert aux imprévus et à une phrase sur l'IA native de la plateforme) :**

| Temps | Contenu |
| --- | --- |
| 0:00 | « Quand un process coince, on envoie un message, on lance un appel, on cherche dans le wiki. Et le suivant recommence. » |
| 0:20 | Le juré tombe sur une erreur obscure dans une appli, ouvre Slack pour demander de l'aide… et la notification Screenpipe arrive : « cette erreur a déjà été résolue dans l'équipe », avec \[Voir la solution\] et \[Demander à l'agent\]. Il débloque en quelques secondes, et personne ne sait que c'est lui qui a demandé |
| 1:00 | Sur un autre ordinateur (un Mac, si le juré est sur le Windows) : celui qui avait la solution reçoit « partager ta solution ? » |
| 1:15 | La carte d'équipe, dans Screenpipe : les frictions de la semaine, comptées en détours, jamais en personnes |
| 1:35 | L'agent écrit la page de wiki manquante et envoie la demande de correction |
| 1:50 | La ligne de vie privée, et « aucun fork, tout dans Screenpipe, sur Windows et Mac » |

**Les données :**

- **Nos vraies frictions pendant les 48 h**, avec l'accord de chacun : l'installation de Screenpipe, les permissions Windows et Mac, Bun, Docker, la soumission Kaggle. Authentique et varié.
- **Un scénario métier** sur de vraies interfaces, avec des règles maison arbitraires (que l'IA native de la plateforme ne peut pas connaître). Les outils retenus : **HubSpot** (CRM), **Slack** (demande d'aide interne) et **Crisp** (chat avec le client). Notion et Shopify viendront ensuite si on a le temps. C'est le moment en direct avec le juré. Face à l'IA native qui répond par un article d'aide générique, notre notification apporte la règle exacte de l'équipe (voir la piste ci-dessous).
- **Piste de scénario : « un client demande un remboursement ».** Un client écrit dans Crisp pour un remboursement. L'agent du support (un nouveau) ouvre sa fiche dans HubSpot, ne trouve pas la règle qui s'applique, relit la même page, puis demande de l'aide dans Slack. La notification Screenpipe arrive : « ce cas de remboursement a déjà été réglé dans l'équipe », avec la règle maison (par exemple : au-delà d'un montant, un tag de validation, une étape de plus). Celui qui avait la solution a choisi de la partager ; personne ne sait qui a demandé. Les détours repérés sont une recherche (HubSpot), une demande d'aide (Slack) et un blocage (la règle introuvable). Le remboursement lui-même se fera dans Shopify, plus tard. Les données du client (nom, commande) apparaissent à l'écran : elles ne doivent jamais entrer dans la signature (voir *Questions ouvertes*).
- **Une population synthétique pour la carte d'équipe**, au format exact de Screenpipe : les organisateurs l'autorisent, et on le dit.

**La soumission** (via Kaggle ; format et date limite annoncés vendredi) : le projet, la vidéo, le dépôt et les supports. Le dépôt contient un mode avec les données synthétiques, pour qu'une personne extérieure puisse le faire tourner. Y indiquer aussi ce qui marche et ce qui échoue, et la contribution de chacun.

**Si on a le temps :** une éval de la détection, sur 20 épisodes étiquetés à la main (précision et rappel). C'est l'argument pour Louis.

**Le piège à éviter :** une démo qui ressemble à un tableau de bord d'analyse. Ce qui nous garde dans le thème, c'est l'aide en direct et l'agent qui agit.

## Plan

Coder avant vendredi est autorisé : les tests d'aujourd'hui décident de ce qui tient, le reste se construit avant l'ouverture.

### Aujourd'hui, jeudi

- [ ] Avant 17 h, sur Discord : nos questions techniques à Louis ou Ezra (`/notify` et les Live Views utilisables depuis un programme externe ? la détection d'appel avec l'audio coupé ?)
- [ ] Screenpipe installé sur les 3 machines, accès Business réclamé par chacun, même version partout
- [ ] Une équipe Teams créée, et les exclusions poussées à tous
- [ ] Test 1 : avec les exclusions actives, vérifier que rien d'autre n'est enregistré
- [ ] Test 2, sur le Windows et sur un Mac : un épisode complet (erreur, recherche, message d'aide, résolution). Vérifier que `/search` retrouve les 4 éléments, et en combien de secondes
- [ ] Test 3 : un appel avec l'audio coupé. Screenpipe détecte-t-il la réunion ?
- [ ] Test 4 : une notification de test avec deux boutons, sur chaque machine
- [ ] Test 5 : Slack, HubSpot et Crisp, un navigateur (Chrome, Firefox) et, si on a le temps, Notion et Shopify, sur chaque système. Noter ce qui vient de l'accessibilité et ce qui passe par l'OCR. Discord est écarté du périmètre de démo : rarement utilisé en entreprise, sans administration ni audit
- [ ] Test 6 : `GET /live-views/schema`, pour voir quels blocs la carte peut utiliser
- [ ] Créer un compte HubSpot gratuit, un espace Slack gratuit et un compte Crisp, et y configurer 2 ou 3 règles maison qui font échouer une action (puis, plus tard, Notion et une boutique Shopify de développement)
- [ ] Créer nos comptes Kaggle

Notification de test (sous Windows, taper `curl.exe` et échapper les guillemets du JSON) :

```bash
curl -X POST http://127.0.0.1:11435/notify -H "Content-Type: application/json" -d '{"title":"Test","body":"Friction détectée","actions":[{"id":"ok","label":"Voir","type":"deeplink","url":"screenpipe://timeline"},{"id":"no","label":"Ignorer","type":"dismiss"}]}'
```

### Vendredi, avant 18 h

- [ ] La détection (signaux, puis épisodes) et la qualification, sur nos vraies données
- [ ] Une notification d'aide de bout en bout, avec ses boutons
- [ ] Le jeu de données synthétique au format Screenpipe
- [ ] Trancher les questions ouvertes

### Le week-end

- **Vendredi 18 h, l'ouverture :** récupérer les critères, le format et la date limite, puis ajuster.
- **Vendredi soir et samedi :** le serveur partagé, le consentement, la carte en Live View, le wiki et la demande de correction. On utilise le projet sur nous-mêmes tout le week-end.
- **Samedi soir :** tourner la vidéo (pas dimanche matin).
- **Dimanche :** la soumission, la présélection, puis la finale sur place.

### Répartition (une personne par système, pour tester partout)

| Rôle | Contenu |
| --- | --- |
| Détection | l'API Screenpipe, les signaux, la qualification par l'IA, l'éval |
| Assistance et vie privée | le serveur partagé, les signatures, le consentement, les notifications |
| Carte et démo | la Live View, le wiki et la demande de correction, le scénario métier (HubSpot, Slack, Crisp), la vidéo et le pitch |

## Le hackathon et le jury

« Build Agents That Remember », 42 Entrepreneurs × Screenpipe, à l'École 42 Paris : du vendredi 16 octobre 18 h au dimanche 18, avec la soumission et la finale dimanche.

D'après le récap du kickoff :

- **Les prix :** 3 000 $ en cash, plus de possibles stages, alternances ou CDI chez Screenpipe. Plus de contrat.
- **La règle éliminatoire :** un projet original et utile qui dépend vraiment des données Screenpipe. Un agent générique sans connexion à Screenpipe ne passe pas.
- **Les pistes** (découvrir, apprendre à un agent, rendre utile aux autres) sont des guides, pas des exigences.
- **Coder avant vendredi est autorisé**, et les données synthétiques aussi, si elles ressemblent aux données de workflow Screenpipe. Des idées proches entre équipes ne posent pas de problème : l'exécution et la viabilité comptent.
- **La soumission** passe par Kaggle (projet, vidéo, dépôt, supports). Environ 25 équipes, puis une présélection avant la finale de dimanche.
- **Le format :** 3 minutes de démo en finale, puis 2 minutes de questions ; la soumission Kaggle se fait en 2 minutes.
- **Les critères de notation :**

| Critère | Poids | Ce que ça veut dire pour nous |
| --- | --- | --- |
| Intégration Screenpipe | 30 % | « Tout dans Screenpipe, sans fork » est un argument de note : montrer au moins trois de leurs surfaces (notification, Live View, pipe ou Teams) |
| Innovation | 30 % | la mémoire collective des frictions, la vie privée intégrée, le contraste avec l'IA native de la plateforme |
| Fonctionnalité (marche-t-il en direct ?) | 20 % | un seul parcours de bout en bout, minimal et répété ; le reste sur données préparées, annoncées comme telles |
| Présentation et pitch | 20 % | le récit en 3 minutes |

- **La date limite et le détail des prix** sont annoncés vendredi à l'ouverture.
- **Le travail à distance est autorisé**, mais les finalistes pitchent sur place dimanche.
- **Louis et Ezra répondent sur Discord**, en général jusqu'à 17 h–19 h.
- **L'accès :** 30 jours de Screenpipe Business sur la page du hackathon.
- **Les équipes :** de 3 à 5 personnes de préférence. On peut dormir sur place, et les repas sont fournis.

**Le jury (confirmé) et ce qui lui parle :**

| Juré | Rôle | L'accroche |
| --- | --- | --- |
| Louis Beaumont | CEO de Screenpipe | une aide sans aucun prompt (c'est leur vision), le partage entre collègues qui manque à leur produit, une éval de la détection |
| Ezra | ingénieur Screenpipe, fiabilité et Windows | aucune capture en plus, Windows et Mac, CPU mesuré |
| Eliot Andres | cofondateur de Photoroom | débloqué en quelques secondes, sans formation |
| Baptiste Jamin | CEO de Crisp | moins de support interne, et l'humain décide (partager, accepter) |
| Maxime Blondel | The Quest | l'école du terrain : on apprend en faisant |
| Mélanie Dinane | 42 Paris | l'apprentissage entre pairs, qui est toute la pédagogie de 42 |

Le nom d'Ezra est écrit « Illette » dans le récap et « Ellette » dans nos notes : à vérifier avant de l'écrire sur une slide.

## Ce qu'on a écarté, et pourquoi

Pour ne pas rouvrir ces débats pendant le week-end :

| Idée | Pourquoi on l'a écartée |
| --- | --- |
| **Ghost**, l'onboarding guidé par le « fantôme » d'un collègue | l'onboarding est une vieille approche ; Tango et WalkMe font déjà du guidage ; ça allait à contre-sens de la vision de Screenpipe (« l'IA agit ») |
| **Un agent qui rejoue les workflows** | ça devenait « juste un exécuteur » ; c'est ce que faisait Mediar, l'ancienne société de Louis ; fragile en direct |
| **Tab universel**, l'autocomplétion du travail pour l'équipe | trop large pour 48 h, et on retombe sur le problème de l'exécuteur |
| **Modifier l'overlay de Screenpipe** | deux implémentations natives, une compilation lourde, des permissions perdues sur Mac |
| **Surveillance** (fuites de données, salariés à risque) | contraire à nos principes, au droit européen et à la doc de Screenpipe |
| **Optimiser les performances de Screenpipe** | un correctif, pas un projet construit sur leurs données |
| **Un tableau de bord de goulots seul** | Screenpipe le fait déjà en partie, et sans agent on sort du thème |

**Gardé en réserve, si on a de l'avance :** une aide injectée dans les applis web (une explication à côté du champ qui bloque), et la détection de la fraude au changement de RIB comme exemple de friction « dangereuse ».

## Sources

**Le hackathon**

- Récap du kickoff (PDF partagé en interne)
- [Page 42 Entrepreneurs](https://42entrepreneurs.com/hackathon-screenpipe)
- [Accès Business pour les participants](https://screenpipe.com/hackathon/paris-2026)
- [Starter (facultatif)](https://github.com/screenpipe/hackathon-starter)

**Screenpipe**

- [Tarifs (partage de contexte entre collègues non inclus dans Business)](https://screenpipe.com/onboarding)
- [Changelog](https://screenpipe.com/changelog)
- [Doc : Teams](https://docs.screenpipe.com/teams.md)
- [Doc : découverte de workflows](https://docs.screenpipe.com/workflow-discovery.md)
- [Skill de l'API : notifications et boutons](https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-core/assets/skills/screenpipe-api/SKILL.md)
- [Live Views (code)](https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-engine/src/live_views.rs)
- [Modèle des workflows : les goulots d'étranglement](https://github.com/screenpipe/screenpipe/blob/main/packages/workflows-ui/src/model.ts)
- [Réglages de capture (clavier, clics)](https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-config/src/recording.rs)
- [docs/VISION.md](https://github.com/screenpipe/screenpipe/blob/main/docs/VISION.md)

**Marché**

- [YC Requests for Startups (dont *Multiplayer AI*)](https://www.ycombinator.com/rfs)
- [Tango Guide Me](https://www.tango.ai/guide)
- [Screenpipe vs Scribe](https://screenpipe.com/compare/scribe)
