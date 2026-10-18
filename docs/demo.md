# Reproduire la démo

Léa (support, nouvelle) et Karim (3 ans de maison) chez PipingTable, boîte fictive (logiciel de réservation pour restaurants). Deux postes, ou une machine avec `simuler`.

## Environnement

Tout est fictif : e-mails en `@example.com` ou `.test`. Détail dans [../integrations/build/pipingtable.md](../integrations/build/pipingtable.md).

| Outil | Préparation |
| --- | --- |
| Crisp | Un espace de travail, ouvert dans Chrome côté agent. Clients fictifs par lien direct : [crisp.md](crisp.md). Client de l'ouverture : Jean Dupont, `jd.resto75@resa-paris.test` (introuvable dans HubSpot sous cet e-mail, exprès). |
| HubSpot | Portail gratuit, `cd integrations && bun run seed`. Clé dans `~/.config/friction/env` : `export HUBSPOT_SEED_TOKEN=…` (sert aussi à l'agent pour la fiche). |
| Slack (facultatif) | `bun run seed:slack`. |
| Screenpipe | Enregistrement actif. Chrome, pas Firefox. |

## Postes

```bash
source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env && source ~/.config/friction/env
```

- Poste de la démo (Léa, responsable de l'équipe Support pour pouvoir certifier) : `bun agent/main.ts equipe-creer Support`, `bun agent/main.ts carte-installer`, puis `FRICTION_SEED_IDS=client-introuvable bun agent/main.ts`. Live Views ouvertes dans Screenpipe.
- Partage entre collègues sur une machine, hors scène : `bun teamstore/cli.ts equipe-demo`, `FRICTION_REQUEST_JITTER=0 bun agent/main.ts simuler`, `bun agent/main.ts injecter lea "…"`. L'écran est injecté, le reste (modèle, demande chiffrée, [Partager], aide) est réel.

Avant : relancer l'app Screenpipe, `bun agent/main.ts test-notif`, voir la notification. Léa : Crisp au premier plan (liste), HubSpot sur la liste des contacts, aucune recherche avant le message (une aide générique bloquerait la fiche 10 min). Terminaux hors écran. Le message de Jean part de `cd integrations && bun run simulate --sans-aide` (http://127.0.0.1:4518) ou de son lien Crisp en fenêtre privée.

## Déroulé en direct (un poste)

Le partage entre collègues ([Partager] sur un second poste) n'est pas joué en direct : le correctif Mac n'est pas compilé. Il se montre avec le dashboard (`bun teamstore/dashboard/serve.ts`, chapitre 2 du parcours) ou le film (`pitch/film.html`), et se reproduit sur une machine avec `simuler` + `injecter`.

| Temps | Geste | Résultat |
| --- | --- | --- |
| 0:00 | Lancer `bun teamstore/cli.ts nuit --exemple` dans un terminal hors écran (la notification arrive ~30 s plus tard et attend) | |
| 0:10 | Jean écrit « Ma page de réservation est en panne » (simulateur). Léa reste 2 s sur la liste Crisp, ouvre la conversation, copie l'e-mail, le colle dans la recherche HubSpot : 0 contact | ~10 s après la recherche : « Client : Jean Dupont · Le Bistro · Premium » + [Y aller]. [Ça m'a aidé] |
| 0:50 | Live View « Mon agent, en direct » | 💬 Crisp lu, 🧠 jugé (confiance, temps du modèle), 🪪 fiche, 💡 aide (délai), 🔒 envoi chiffré : le clair côté équipe, le chiffré côté serveur |
| 1:10 | Notification « Règle trouvée cette nuit : … » → [Certifier] | Exemple préparé, à annoncer comme tel. La règle devient l'aide de l'équipe |
| 1:30 | Live View « Frictions de l'équipe » | Détours par étape, états (attente, à documenter, partagée, certifiée) |
| 1:50 | — | Chiffres ([etat.md](etat.md)), vie privée |

## Si ça coince

| Problème | Repli |
| --- | --- |
| Notification invisible | Relancer l'app Screenpipe, `test-notif` |
| Pas de ligne « Crisp : » dans le journal | Revenir 2 s sur la liste Crisp. Sinon l'aide générique « chercher par domaine » part quand même |
| Rien ne se déclenche | `bun agent/main.ts injecter lea "…"` (le dire) |
| Stockage injoignable | Aide locale seulement (l'agent le dit au démarrage) |

## Questions

- Surveillance ? Détours par étape, pas par personne. `teamstore/schema.sql` : pas de colonne auteur, tout chiffré. Consentement, pause, périmètre limité aux applis de travail.
- Pourquoi pas l'IA de HubSpot ? Elle connaît le produit, pas vos règles (« 1 mois max, premium seulement » n'est écrit nulle part).
- Le texte part dans le cloud ? Vers le modèle choisi dans Screenpipe, identifiants masqués. Un modèle local reste sur le poste.
- L'IA invente une règle ? Elle propose seulement. Rien n'entre sans la responsable ; une règle avec nom, e-mail ou téléphone est refusée.
