# Le parcours guidé : guide pour l'équipe

> `http://127.0.0.1:4322/parcours` : la journée de Léa chez PipingTable, en 8 chapitres, pour **comprendre friction-assist en 5 minutes** ou le **présenter** au jury.
> Pour le reproduire ou l'adapter : [PARCOURS-REPRODUIRE.md](PARCOURS-REPRODUIRE.md).

## Lancer

```bash
git pull
./teamstore/start.sh            # Windows : teamstore\start.cmd
```

La page d'accueil s'ouvre : cliquer **Parcours guidé**, ou aller directement sur `http://127.0.0.1:4322/parcours`.

- **Il faut seulement Bun.** Le script propose de l'installer s'il manque.
- **Les équipes et les blocs chiffrés du parcours sont réels**, sur un stockage local à ta machine : rien ne part sur Supabase, et il n'y a aucun compte à créer.
- **Pour que les chapitres « La nuit » et les notifications utilisent le vrai Screenpipe**, l'app Screenpipe doit être ouverte et `scripts/screenpipe-env.sh` lancé une fois.

**Rejouer** : recharger la page. Chaque chargement crée une nouvelle équipe.

## L'écran

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Aide immédiate · 2. Demander à l'équipe · … · 8. La carte   [options]     │  ← où on en est
├──────────────────────────────────────────────────────────────────────────────┤
│ Chapitre 2 / 8 — 11 h · Léa ne sait pas…                                     │  ← le récit : ce qui se passe,
│ Ce qui se passe … · Pourquoi ça compte …            [ bouton à cliquer ]     │     pourquoi ça compte, l'action
├────────────────────────┬────────────────────────────┬────────────────────────┤
│ Écran de Léa           │ Ce que fait l'agent        │ L'équipe Support       │
│ Crisp HubSpot Slack    │ 👁 Screenpipe voit         │ Claire, Karim, Yasmine │
│ Notion + notification  │ 🧠 L'IA qualifie           │ + leurs notifications  │
│ Screenpipe             │ 📦 Mémoire du poste        │ + leur mémoire         │
│                        │ 🔒 Équipe (chiffré)        │                        │
├────────────────────────┴────────────────────────────┴────────────────────────┤
│ Frictions en direct (vue de la responsable) : en attente, résolues, certifiées │
├──────────────────────────────────────────────────────────────────────────────┤
│ Ce que voit le serveur : des blocs illisibles, tous de la même taille          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Options en haut à droite :**
- **Mode présentation** : les boutons se cliquent tout seuls, environ toutes les 3 s. Pratique sur scène.
- **Notifications Screenpipe réelles** : chaque notification du parcours s'affiche aussi pour de vrai dans Screenpipe, préfixée « [Léa] », « [Claire] »…
- **Afficher aussi dans Screenpipe (Live View)** : le tableau « Frictions en direct » est publié dans Screenpipe (`screenpipe://live-view/friction-live`).

## Les 8 chapitres, et quoi dire

| # | Titre | Ce qu'on voit | La phrase |
| --- | --- | --- | --- |
| 1 | **9 h 05 · Léa a déjà la réponse** | Jean Dupont écrit sur Crisp. Léa le cherche dans HubSpot : 0 résultat. L'agent reconnaît la friction et trouve la solution dans la mémoire de Léa (partagée la veille par Karim). | « La solution arrive au bon moment, en 2 secondes, et rien ne quitte le poste. » |
| 2 | **11 h · Léa demande à l'équipe, anonymement** | Jean veut un dédommagement. Léa n'a pas la réponse : une demande anonyme et chiffrée part au Support. Le panneau « Ce que lit l'équipe / Ce que voit le serveur » montre la différence. Claire reçoit « Un collègue bloque » et clique **Partager**. | « Claire ne sait pas qui demande, et le serveur ne sait ni qui, ni quoi. » |
| 3 | **11 h 05 · Qui croire ?** | Notion (périmé) dit « 2 mois », le fil Slack de Claire dit « 1 mois ». Claire **certifie** la règle : badge ✓ chez tous. Bouton facultatif **« Et si Karim modifiait la règle ? »** : le badge tombe. | « Seule la responsable peut fabriquer ce badge. » |
| 4 | **15 h 30 · Personne ne sait** | Un prospect belge écrit. Personne au Support ne connaît la règle : compte à rebours, puis la notification « 💬 Sans réponse → #new-leads » de Minguk, avec un message prêt à coller. | « L'outil ne laisse jamais Léa seule. » |
| 5 | **La nuit** | Le poste de Léa relit les 15 minutes qui ont suivi la friction. La **vraie IA** de Screenpipe juge que Léa s'en est sortie (grâce au message épinglé de Sarah) et écrit la règle, sans nom. Elle part en proposition chiffrée. Le matin, Claire la **certifie**. | « La mémoire se nourrit seule, mais rien n'y entre sans la responsable. » |
| 6 | **Le lendemain** | Yasmine a la même question de dédommagement : la réponse certifiée est déjà là. | « **La friction ne s'est payée qu'une fois.** » |
| 7 | **Karim quitte l'équipe** | Claire change la clé : Karim est dehors, Léa et Yasmine reçoivent le nouveau lien et ne perdent rien. Les anciens blocs disparaissent du serveur. | « On change la serrure, on garde la mémoire. » |
| 8 | **La carte** | Les détours par étape, avec leur état (règle certifiée, solution partagée, à documenter). Un bouton copie la commande pour l'afficher dans Screenpipe. | « On mesure le process, jamais la personne. » |

Pendant tout le parcours :
- la bande **« Frictions en direct »** montre les demandes en attente, celles qui sont résolues et les propositions de la nuit ;
- la bande noire **« Ce que voit le serveur »** se remplit de blocs illisibles.

## Ce qui est réel, et ce qui est mis en scène

| Réel | Mis en scène |
| --- | --- |
| Les équipes, le chiffrement, les blocs dans le stockage (bande noire) | L'écran de Léa (Crisp, HubSpot, Slack, Notion) |
| La certification par signature, la falsification qui échoue, le changement de clé | Le verdict de l'IA aux chapitres 1, 2 et 4 (dans le produit, c'est le démon d'Andrea) |
| Le jugement de **la nuit** par le vrai modèle de Screenpipe (chapitre 5) | Le texte « vu après la friction » donné à ce modèle |
| Les notifications Screenpipe et la Live View, si les cases sont cochées | Les clics des collègues (on clique à leur place) |

Si le modèle de Screenpipe n'est pas joignable, le chapitre 5 affiche un verdict préparé, et le dit (« IA indisponible : verdict préparé »).

## Conseils pour présenter

- **En 1 minute** : cocher « Mode présentation » et commenter en suivant le tableau ci-dessus.
- **En 3 à 5 minutes** : cliquer soi-même. Au chapitre 2, montrer le panneau « Ce que lit l'équipe / Ce que voit le serveur ». Au chapitre 3, cliquer « Et si Karim modifiait la règle ? ».
- **Avec Screenpipe à l'écran** : cocher « Notifications Screenpipe réelles » et ouvrir `screenpipe://live-view/friction-live` à côté. Les notifications et la Live View bougent en même temps que la page.
- La vraie démo avec les vrais outils, c'est le **déroulé d'Andrea** (`andrea/docs/demo.md`) et la page **Répétition**. Le parcours sert à **faire comprendre**, avant ou après.

## Dépannage

| Symptôme | Que faire |
| --- | --- |
| « Le port 4322 est déjà pris » | friction-assist tourne déjà : ouvrir `http://127.0.0.1:4322/parcours`, ou fermer l'autre terminal. |
| La page reste sur « Préparation de l'équipe… » | Le stockage local ne répond pas : relancer `./teamstore/start.sh`. |
| Chapitre 5 : « IA indisponible » | Screenpipe fermé, ou jeton absent : `scripts/screenpipe-env.sh`, puis relancer. |
| Pas de notification Screenpipe | Case « Notifications Screenpipe réelles » cochée ? Screenpipe pas en pause ? |
| La bande noire dit « indisponible » | Le stockage est distant : normal, la vue opérateur n'existe que pour le stockage local. |
| Un bouton ne réagit pas en mode présentation | Décocher puis cliquer à la main : le mode présentation n'agit qu'au moment où l'action apparaît. |
