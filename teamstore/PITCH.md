# Pitch : 2 minutes, porté par le film de Minguk

> **Support :** le film de Minguk, [minguk/motion/film.html](../minguk/motion/film.html) (version du 18/10, 13h41 : 1 min 55, 12 scènes, trois actes ; en anglais : Debora, Hamza, Adam, Claire).
> **Version anglaise :** [PITCH-EN.md](PITCH-EN.md), mêmes temps.
> **Chiffres :** ceux de [RAPPORT-DEMO.md](../RAPPORT-DEMO.md#5-chiffres-à-dire-les-mêmes-partout), les mêmes partout.
> **Déroulé réel :** la démo avec les vrais outils reste celle d'Andrea ([andrea/docs/demo.md](../andrea/docs/demo.md)). Le pitch raconte ; la démo prouve.

## Le principe

- Le film démarre à **0:00** et dure 1 min 55. **L'orateur dit la voix off**, une phrase par scène, puis conclut à 2:00.
- Chaque phrase est plus courte que le sous-titre du film (environ 2,3 mots par seconde), pour être dite sans courir.

## Avant de commencer

- Ouvrir `minguk/motion/film.html` dans Chrome. **Il faut Internet** : l'animation (GSAP) se charge depuis un CDN. Sans réseau, voir le repli plus bas.
- Appuyer sur **S** pour couper les sous-titres (c'est l'orateur qui dit le texte), **H** pour ne garder que le film, puis **F** pour le plein écran.
- **Espace** lance le film sur le premier mot.

## Le texte, scène par scène

| Temps | Scène du film | Texte |
| --- | --- | --- |
| **0:00** | The idea | « **Une friction se paie une fois, pas dix.** Nous la repérons, nous débloquons, et nous la réglons pour de bon. » |
| **0:06** | The setting | « Pour le prouver, on a monté un vrai support : PipingTable, un logiciel de réservation pour restaurants. Clients fictifs, vrais outils : Crisp, HubSpot, Slack, Notion. » |
| **0:15** | Meet the team | « Voici Debora, trois semaines au Support. Hamza, trois ans de maison, connaît toutes les règles non écrites. Claire, la responsable, les décide, mais personne ne les écrit. » |
| **0:25** | Who do I ask? | « Alors Debora demande à Hamza. Encore et encore. Les questions s'empilent dans Slack… et le client attend. » |
| **0:35** | Screenpipe sees · *acte 1* | « **Acte un : repérer.** Neuf heures cinq, Jean veut un dédommagement. Debora le cherche dans HubSpot par e-mail : zéro résultat. Screenpipe, en local, voit le détour. » |
| **0:47** | The AI judges | « L'agent n'envoie au modèle que ces secondes-là, identifiants masqués. 2,6 secondes : c'est une friction, et l'équipe a la solution. » |
| **0:56** | The answer · *acte 2* | « **Acte deux : débloquer.** La réponse arrive dans une notification Screenpipe. Un clic, la fiche de Jean s'ouvre, dix secondes après la recherche. » |
| **1:06** | Nobody knows | « Et quand son poste ne sait pas ? La question part à l'équipe, chiffrée, sans nom. Hamza partage d'un clic, sans jamais savoir qui demandait. » |
| **1:18** | At night · *acte 3* | « **Acte trois : régler une fois.** La nuit, l'agent se souvient : l'IA fait une règle de ce que l'équipe a partagé. Claire la certifie au matin. » |
| **1:29** | The next day | « Le lendemain, Adam bloque au même endroit. La réponse est déjà là, certifiée. Hamza n'est pas dérangé. » |
| **1:37** | Someone leaves | « Hamza change d'équipe ? On change la clé. Il ne lit plus rien, et ses règles restent. » |
| **1:46** | Proof | « Mesuré en répétition : dix secondes jusqu'à la réponse. Tout tourne en local, tout est chiffré avant de partir, et on mesure le process, jamais la personne. » |
| **1:55** | Image finale | « friction-assist : **une friction se paie une fois, pas dix.** Merci. » |

## Pour tenir les 2 minutes

- **Répéter deux fois avec le film.** Il a son propre rythme : si une phrase déborde, couper des mots plutôt qu'accélérer.
- **Les touches ← →** changent de scène si le film doit rattraper l'orateur.
- Le film affiche sur chaque scène une petite mention (« Real screenshots · fictional data » ou « Illustration based on the real process »). Si le jury demande ce qui est réel, la montrer.

## S'il y a 3 minutes au lieu de 2

Après 1:55, avant « Merci », ajouter la preuve en direct et les chiffres (environ 35 s) :

> « Et ce n'est pas qu'un film. Hier soir, en répétition sur le poste d'Andrea, le vrai Screenpipe a lu Crisp, jugé la recherche et affiché la fiche de Jean, dix secondes après le geste. Nos chiffres, tels quels : quand l'agent se déclenche, il a raison sept fois sur dix ; il rate encore une friction sur deux, et c'est notre chantier. Tout vit dans Screenpipe : les notifications, les Live Views, son modèle. Et nous leur proposons trois évolutions, dont le correctif des boutons sur Mac. »

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

- **Le format** (point 3 de RAPPORT-DEMO.md) : ce texte suppose le film. Si l'équipe préfère ouvrir sur la démo réelle, garder ce texte de 0:35 à 1:06 (actes un et deux) pendant la démo d'Andrea, puis reprendre le film à la scène « Nobody knows ».
- **Les prénoms** : le film dit Debora, Hamza et Adam ; le parcours et le déroulé d'Andrea disent Léa, Karim et Yasmine. Il faut choisir une seule distribution pour la scène.
- **« Trois évolutions »** : ne pas dire « sans fork ». La démo Mac utilise un Screenpipe patché ; on leur **propose** le correctif.
- **« Hier soir, en vrai »** : c'est vrai au 18/10 (répétition du 17/10 à 23:43). Si la répétition du matin échoue, retirer la phrase.
- **Version anglaise :** la relire avec Minguk, qui a écrit le film en anglais.
