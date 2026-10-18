# Pitch : 3 minutes, porté par le film de Minguk

> **Support :** le film de 2 min de Minguk, [minguk/motion/film.html](../minguk/motion/film.html) (version du 18/10, en anglais : Debora, Hamza, Adam, Claire).
> **Chiffres :** ceux de [RAPPORT-DEMO.md](../RAPPORT-DEMO.md#5-chiffres-à-dire-les-mêmes-partout), les mêmes partout.
> **Déroulé réel :** la démo avec les vrais outils reste celle d'Andrea ([andrea/docs/demo.md](../andrea/docs/demo.md)). Le pitch raconte ; la démo prouve.

## Le principe

- **0:00 à 0:15** : l'orateur ouvre seul, le film est arrêté sur son titre.
- **0:15 à 2:20** : le film tourne (2 min 05), et **l'orateur dit la voix off**, une phrase par scène.
- **2:20 à 3:00** : film arrêté sur l'image finale. L'orateur montre ce qui est réel, puis conclut.

## Avant de commencer

- Ouvrir `minguk/motion/film.html` dans Chrome. **Il faut Internet** : l'animation (GSAP) se charge depuis un CDN. S'il n'y a pas de réseau, voir le repli plus bas.
- Appuyer sur **S** pour couper les sous-titres (c'est l'orateur qui dit le texte), **H** pour ne garder que le film, puis **F** pour le plein écran.
- Laisser le film sur la première image. **Espace** le lance au signal **[▶]**.
- Si le jury est anglophone, garder les sous-titres et dire la version anglaise (en bas de page).

## Le texte, scène par scène

Le film lancé à 0:15, chaque scène commence au temps indiqué. Le texte est calé sur environ 2,3 mots par seconde.

| Temps | Scène du film | Texte |
| --- | --- | --- |
| **0:00** | Titre, film arrêté | « **Une friction se paie une fois, pas dix.** Mais de quelle friction parlons-nous ? Imaginez Debora, arrivée il y a trois semaines au Support de PipingTable, une start-up qui vend la réservation en ligne aux restaurants. » |
| **0:15** | **[▶]** « Who do I ask? » | « Sa question de tous les jours : à qui je demande ? » |
| **0:21** | Le problème : #support, « No answer » ×3 | « Les règles du Support ne sont écrites nulle part. Elles vivent dans la tête de Hamza, trois ans de maison. Alors on lui demande, on attend… et le client attend aussi. » |
| **0:34** | Screenpipe voit : Crisp, puis HubSpot « 0 results » | « Neuf heures cinq. Jean écrit sur Crisp : il veut un dédommagement. Debora le cherche dans HubSpot par son e-mail : zéro résultat. Screenpipe, qui enregistre l'écran en local, a tout vu. » |
| **0:48** | L'IA juge : épisode, `[EMAIL]` masqué, verdict | « Notre agent n'envoie au modèle que ces quelques secondes, identifiants masqués. Un seul appel, 2,6 secondes : c'est bien une friction, et l'équipe a la solution. » |
| **1:01** | La réponse : notification, fiche de Jean | « La réponse arrive dans une notification Screenpipe. Un clic, et la fiche de Jean s'ouvre. Dix secondes après la recherche, et personne n'a été dérangé. » |
| **1:12** | Personne ne sait : blocs chiffrés, Hamza clique Share | « Mais que peut-elle offrir à Jean ? Son poste ne le sait pas. La question part à l'équipe, chiffrée, sans nom. Hamza partage sa règle d'un clic, sans savoir qui demandait. » |
| **1:29** | La nuit : 03:00, règle proposée, Claire certifie | « La nuit, **l'agent se souvient** : l'IA rassemble ce que l'équipe a partagé et propose une règle, sans aucun nom. Au matin, Claire, la responsable, la certifie d'un clic. » |
| **1:42** | Le lendemain : Adam | « Le lendemain, Adam bloque au même endroit. La réponse est déjà là, certifiée. Hamza n'est plus interrompu. » |
| **1:51** | Quelqu'un part : clé v1 → v2 | « Et quand Hamza change d'équipe ? On change la clé : il ne lit plus rien. Ses règles, elles, restent à l'équipe. » |
| **2:02** | Vie privée : ce que lit l'équipe, ce que voit le serveur | « Tout est chiffré sur le poste. Le serveur ne voit que des blocs de même taille, sans nom ni heure exacte. On mesure le process, jamais la personne. » |
| **2:12** | « Every friction is paid only once. » | *Silence : laisser l'écran parler.* |
| **2:20** | Film arrêté sur l'image finale | « Et ce n'est pas qu'un film. Hier soir, en répétition sur le poste d'Andrea, le vrai Screenpipe a lu Crisp, jugé la recherche et affiché la fiche de Jean, dix secondes après le geste. Nos chiffres, tels quels : quand l'agent se déclenche, il a raison sept fois sur dix ; il rate encore une friction sur deux, et c'est notre chantier. Tout vit dans Screenpipe : les notifications, les Live Views, son modèle. Et nous leur proposons trois évolutions, dont le correctif des boutons sur Mac. » |
| **2:55** | — | « friction-assist : **une friction se paie une fois, pas dix.** Merci. » |

## Pour tenir les 3 minutes

- **Répéter deux fois avec le film.** Le film a son propre rythme : si une phrase déborde, la couper plutôt que d'accélérer.
- **Si ça déborde**, raccourcir la conclusion de 2:20 : garder « hier soir, en vrai » et les chiffres, et retirer la phrase sur Screenpipe.
- **Les touches ← →** changent de scène si le film doit rattraper l'orateur.

## Repli sans Internet : le parcours guidé

Lancer `./teamstore/start.sh`, puis ouvrir `http://127.0.0.1:4322/parcours` (fonctionne hors ligne ; guide : [PARCOURS.md](PARCOURS.md)). Le texte ci-dessus reste valable, en adaptant les prénoms :

| Film | Parcours |
| --- | --- |
| Debora, la nouvelle | Léa |
| Hamza, l'ancien | Karim (au chapitre 2, c'est Claire qui partage) |
| Adam, le lendemain | Yasmine |
| Claire, la responsable | Claire |

Ordre des chapitres pour suivre le texte : 1 (aide immédiate), 2 (demande anonyme), 5 (la nuit), 6 (le lendemain), 7 (Karim part), 8 (la carte). On peut sauter les chapitres 3 et 4.

## Réponses prêtes pour les 2 minutes de questions

- **« Vous surveillez les employés ? »** Non. On compte des détours par étape, jamais par personne. Les données d'équipe n'ont aucune identité, et le serveur ne voit que du chiffré : on peut le montrer avec la page « Équipe simulée » (vue opérateur, 3 attaques). Il y a aussi un consentement et un bouton pause.
- **« Ça marche vraiment ? »** Oui pour l'aide immédiate : répétée de bout en bout le 17/10 au soir, fiche du client affichée 10 s après la recherche. Le modèle juge un épisode en 2,6 s (médiane). Le partage entre collègues a été mesuré à 7 s puis 4 s sur l'ancien stockage, et reste à remesurer entre deux vraies machines.
- **« Votre détection est fiable ? »** Sur 172 épisodes étiquetés, précision 0,71 et rappel 0,46 : quand l'agent parle, il a souvent raison, mais il manque environ la moitié des frictions. Les étiquettes ont été posées par Claude et relues par Andrea.
- **« Et si l'IA invente une règle ? »** Elle propose seulement : rien n'entre dans la mémoire sans la responsable. Une règle qui contient un nom, un e-mail ou un téléphone est refusée.
- **« La boucle de nuit est fiable ? »** 28 cas sur 28 justes, mais **sur des cas que nous avons écrits nous-mêmes**. Il faut le dire tel quel.
- **« Pourquoi ne pas tout envoyer immédiatement à l'équipe ? »** Dans une équipe de cinq, l'heure d'un message suffit à deviner qui bloque. Le produit ajoute un délai aléatoire de 10 à 60 s, coupé pour la démo.

## À vérifier en équipe avant de le dire sur scène

- **Le format** (point 3 de RAPPORT-DEMO.md) : ce texte suppose le film. Si l'équipe préfère ouvrir sur la démo réelle, garder ce texte de 0:34 à 1:12 pendant la démo d'Andrea, puis reprendre le film à la scène « Nobody knows ».
- **Les prénoms** : le film dit Debora, Hamza et Adam ; le parcours et le déroulé d'Andrea disent Léa, Karim et Yasmine. Il faut choisir une seule distribution pour la scène.
- **« Trois évolutions »** : ne pas dire « sans fork ». La démo Mac utilise un Screenpipe patché ; on leur **propose** le correctif.
- **« Hier soir, en vrai »** : c'est vrai au 18/10 (répétition du 17/10 à 23:43). Si la répétition du matin échoue, retirer la phrase.
- **Version anglaise :** la relire avec Minguk, qui a écrit le film en anglais.

## English version (same timings)

| Time | Line |
| --- | --- |
| **0:00** | "**A friction should be paid once, not ten times.** But what friction are we talking about? Picture Debora, three weeks into the Support team at PipingTable, a start-up selling online booking to restaurants." |
| **0:15** | **[▶]** "Her everyday question: who do I ask?" |
| **0:21** | "Support rules are written down nowhere. They live in Hamza's head, three years in. So we ask him, we wait… and so does the customer." |
| **0:34** | "Nine-oh-five. Jean writes in Crisp: he wants compensation. Debora looks him up in HubSpot by email: zero results. Screenpipe, recording the screen locally, saw it all." |
| **0:48** | "Our agent sends the model only those few seconds, identifiers masked. One call, 2.6 seconds: it's a friction, and the team has a solution." |
| **1:01** | "The answer shows up in a Screenpipe notification. One click, Jean's record opens. Ten seconds after the search, and nobody was interrupted." |
| **1:12** | "But what can she offer Jean? Her computer doesn't know. The question goes to the team, encrypted and nameless. Hamza shares his rule in one click, without knowing who asked." |
| **1:29** | "At night, **the agent remembers**: the AI gathers what the team shared and proposes a rule, with no names. In the morning, Claire, the manager, certifies it in one click." |
| **1:42** | "The next day, Adam gets stuck at the same step. The answer is already there, certified. Hamza is no longer interrupted." |
| **1:51** | "And when Hamza moves teams? We change the key: he can't read anything anymore. His rules stay with the team." |
| **2:02** | "Everything is encrypted on the computer. The server only sees same-size blocks, no name, no exact time. We measure the process, never the person." |
| **2:12** | *Silence.* |
| **2:20** | "And this isn't just a film. Last night, in rehearsal on Andrea's computer, the real Screenpipe read Crisp, judged the search and showed Jean's record ten seconds after the gesture. Our numbers, as they are: when the agent speaks up, it's right seven times out of ten; it still misses one friction in two, and that's our next job. Everything lives in Screenpipe: notifications, Live Views, its model. And we're proposing three improvements to them, including the fix for buttons on Mac." |
| **2:55** | "friction-assist: **a friction is paid once, not ten times.** Thank you." |
