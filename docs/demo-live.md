# La démo : environnement, commandes dans l'ordre, déroulé

Léa, support, deux semaines de poste chez PipingTable (boîte fictive, logiciel de réservation pour restaurants). Un poste Windows (Screenpipe côté Windows, terminal WSL), ~2 min en direct. Tout depuis la racine du dépôt.

## Environnement (une fois)

Tout est fictif : e-mails en `@example.com` ou `.test`. Détail dans [../integrations/build/pipingtable.md](../integrations/build/pipingtable.md).

| Outil | Préparation |
| --- | --- |
| Crisp | Un espace de travail, ouvert dans Chrome côté agent. Clients fictifs par lien direct : [crisp.md](crisp.md). Client de l'ouverture : Jean Dupont, `jd.resto75@resa-paris.test`, introuvable dans HubSpot sous cet e-mail, exprès. |
| HubSpot | Portail gratuit, `cd integrations && bun run seed`. Clé dans `~/.config/friction/env` : `export HUBSPOT_SEED_TOKEN=…` (sert aussi à l'agent pour la fiche). |
| Slack (facultatif) | `bun run seed:slack`. |
| Équipe | `bun agent/main.ts equipe-creer Support` : le poste de la démo en est responsable, c'est lui qui reçoit [Certifier]. Stockage : [../teamstore/README.md](../teamstore/README.md). |
| Screenpipe | Enregistrement actif. Chrome, pas Firefox. |

## 15 min avant

```bash
cd <clone du dépôt> && git pull -q
export PATH="$HOME/.bun/bin:$PATH"
source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env && source ~/.config/friction/env
```

1. Relancer l'app Screenpipe (quitter, rouvrir), enregistrement actif.
2. Vérifier que l'API répond et que ce poste est dans l'équipe (les clés d'équipe sont dans `~/.config/friction-assist/teams.json`, écrit par `equipe-creer` ou `equipe-rejoindre`) :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $SCREENPIPE_API_KEY" "$SCREENPIPE_URL/search?limit=1"
bun agent/main.ts equipe-liste          # attendu : « Support … responsable » ; sinon : bun agent/main.ts equipe-creer Support
```

3. Une notification de test, la **voir à l'œil**, puis Ctrl+C (sinon la commande rend la main après 5 min ; Screenpipe ignore une deuxième notification identique dans la minute) :

```bash
bun agent/main.ts test-notif
```

4. Les Live Views, puis les ouvrir dans Screenpipe (`screenpipe://live-view/friction-agent`, `screenpipe://live-view/friction-map`) :

```bash
bun agent/main.ts carte-installer
```

5. Léa ne connaît qu'une règle. Un agent déjà lancé (README) doit être arrêté d'abord (un seul sur le port 8787). Le cache local, s'il existe, l'emporterait sur `FRICTION_SEED_IDS` : le supprimer, puis lancer l'agent et le laisser tourner :

```bash
rm -f agent/.state/solutions.json
FRICTION_SEED_IDS=client-introuvable FRICTION_COOLDOWN_S=20 bun agent/main.ts
```

`FRICTION_COOLDOWN_S=20` : la même aide peut repartir après 20 s (10 min par défaut), pour refaire la recherche si le jury le demande ; **vider le champ de recherche avant de recoller l'adresse** (une recherche identique sans vider n'est pas un nouveau geste).

Attendu dans le journal : `relais prêt`, `équipes : Support`, `agent actif (port 8787, 1 solutions)`.

6. Écran : Chrome avec Crisp au premier plan (liste des conversations) et HubSpot sur la **liste des contacts**. Terminal et tout le reste hors de l'écran enregistré. **Aucune recherche HubSpot avant le message de Jean.**

7. Dans un **second terminal** (hors écran), prêt à lancer, sans le lancer :

```bash
cd <clone du dépôt> && source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env
bun teamstore/cli.ts nuit --exemple --cas dédommagement
```

8. Le message de Jean, prêt à partir. **Son e-mail est dans le texte du message** : la chatbox Crisp ne garde que les e-mails dont le domaine existe, et une adresse en `@example.com` ferait remonter tous les contacts de démo dans HubSpot. Léa copie l'adresse depuis le message. Soit un coéquipier sur sa machine, lien Crisp de Jean dans une fenêtre privée ([crisp.md](crisp.md)), qui tape le message au signal. Soit l'envoi headless utilisé en répétition (hors dépôt, Chromium local) :

```bash
bun ~/Workspace/Hackathon/crispbot/send-one.ts "Jean Dupont" "jd.resto75@resa-paris.test" "Bonsoir, notre page de réservation est en panne, plus aucun client ne peut réserver. Vous pouvez me répondre ici ou sur jd.resto75@resa-paris.test, merci."
```

## Sur scène

| Temps | Geste | Dire |
| --- | --- | --- |
| 0:00 | Second terminal : `bun teamstore/cli.ts nuit --exemple --cas dédommagement` (la notification [Certifier] arrive ~30 s plus tard et attend dans le panneau) | « Léa, deux semaines de poste au support de PipingTable. Un client lui écrit. » |
| 0:10 | Envoyer le message de Jean. Rester **2 s sur la liste Crisp**, ouvrir la conversation, copier l'e-mail **dans le message**, le coller dans la recherche HubSpot : 0 contact. Attendre. | « Zéro résultat. Il écrit avec une autre adresse que celle du contrat. Normalement : dix minutes, Slack, attente. » |
| ~0:40 | Notification « Client : Jean Dupont · Le Bistro · Premium ». Cliquer [Ça m'a aidé]. | « L'agent a lu Crisp, vu la recherche, retrouvé la fiche par le nom. Dix secondes. Rien n'a quitté le poste sauf l'appel au modèle choisi dans Screenpipe. » |
| 0:55 | Live View « Mon agent, en direct » | « Étape par étape : Crisp lu, le modèle juge, la fiche, l'aide, et ce qui part à l'équipe : lisible chez nous, illisible sur le serveur. » |
| 1:15 | Notification « Règle trouvée cette nuit : … » → [Certifier] | « La nuit, le poste relit ce qui a suivi une friction sans réponse. L'IA propose une règle sans nom ; la responsable certifie. Exemple préparé. » |
| 1:35 | Live View « Frictions de l'équipe » | « Où le process coince, jamais qui. » |
| 1:50 | — | Chiffres : 172 épisodes, précision 0,71, rappel 0,46. Partage entre collègues : dans le film, pas joué faute de second poste patché. |

## Si ça coince

| Problème | Faire |
| --- | --- |
| Pas de notification 20 s après la recherche | Journal : pas de ligne `Crisp : nouveau message client` → revenir 2 s sur la liste Crisp et refaire la recherche. L'aide générique « chercher par domaine » peut partir à la place de la fiche : la montrer quand même |
| Notification « NON AFFICHÉE » dans le journal | Relancer l'app Screenpipe ; l'agent reprend seul |
| Rien ne se déclenche | `bun agent/main.ts injecter lea "…"` ne marche qu'en `simuler`. Montrer la Live View déjà remplie par les répétitions, puis le film |
| [Certifier] n'arrive pas | `bun teamstore/cli.ts nuit --exemple --cas dédommagement --sans-publier` pour montrer les verdicts dans le terminal |

## Après

```bash
bun agent/main.ts pause
```

## Le partage entre collègues, sur une machine (hors scène)

Pas de second poste pour la démo. Le circuit demande anonyme → [Partager] → aide se reproduit avec deux agents sur une machine ; l'écran est injecté, le reste (modèle, demande chiffrée, clic relayé, aide) est réel.

```bash
bun teamstore/cli.ts equipe-demo                      # équipe « Support », postes Léa et Karim
FRICTION_REQUEST_JITTER=0 bun agent/main.ts simuler    # dans un terminal
bun agent/main.ts injecter lea "Quelqu'un sait si on peut offrir un geste commercial à un client premium ?"   # dans un autre
```

Karim reçoit « [karim] Un collègue bloque » → [Partager] → « [lea] Geste commercial : 1 mois offert maximum ».

## Questions probables

- Surveillance ? Détours par étape, pas par personne. `teamstore/server/schema.sql` : pas de colonne auteur, tout chiffré. Consentement, pause, périmètre limité aux applis de travail.
- Pourquoi pas l'IA de HubSpot ? Elle connaît le produit, pas vos règles (« 1 mois max, premium seulement » n'est écrit nulle part).
- Le texte part dans le cloud ? Vers le modèle choisi dans Screenpipe, identifiants masqués. Un modèle local reste sur le poste.
- L'IA invente une règle ? Elle propose seulement. Rien n'entre sans la responsable ; une règle avec nom, e-mail ou téléphone est refusée.
- Ça marche vraiment ? Délais mesurés et limites écrites : [etat.md](etat.md), [mesures.md](mesures.md).
