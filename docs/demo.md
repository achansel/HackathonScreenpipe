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

- Karim : `bun agent/main.ts equipe-creer Support`, puis `bun agent/main.ts`.
- Léa : `bun agent/main.ts equipe-rejoindre "<lien>"`, puis `FRICTION_SEED_IDS=client-introuvable FRICTION_REQUEST_JITTER=0 bun agent/main.ts` (une seule règle connue, pour montrer le partage sur le reste ; délai d'anonymat à 0, à dire au jury).
- Chacun : `bun agent/main.ts carte-installer`, Live Views ouvertes dans Screenpipe.
- Une machine : `bun teamstore/cli.ts equipe-demo`, `FRICTION_REQUEST_JITTER=0 bun agent/main.ts simuler`, `bun agent/main.ts injecter lea "…"`. Épisodes injectés, pas d'écran lu.

Avant : relancer l'app Screenpipe, `bun agent/main.ts test-notif`, voir la notification. Léa : Crisp au premier plan (liste), HubSpot sur la liste des contacts, aucune recherche avant le message (une aide générique bloquerait la fiche 10 min). Terminaux hors écran. Le message de Jean part de `cd integrations && bun run simulate --sans-aide` (http://127.0.0.1:4518) ou de son lien Crisp en fenêtre privée.

## Déroulé

| Temps | Poste | Geste | Résultat |
| --- | --- | --- | --- |
| 0:20 | Léa | Jean écrit « Ma page de réservation est en panne ». Léa reste 2 s sur la liste Crisp, ouvre la conversation, copie l'e-mail, le colle dans la recherche HubSpot : 0 contact | ~10 s : « Client : Jean Dupont · Le Bistro · Premium » + [Y aller]. [Ça m'a aidé]. « Mon agent, en direct » : 💬 🧠 🪪 💡 🔒 |
| 0:50 | Léa | Jean : « Je veux un dédommagement ». Léa dans Slack `#support` : « On peut offrir quelque chose à un client premium ? » | Pas de règle locale → demande anonyme (la vue montre clair côté équipe / chiffré côté serveur) |
| 1:05 | Karim | — | « Un collègue bloque : … dédommagement » → [Partager] |
| 1:15 | Léa | — | ~4 s : « Geste commercial : 1 mois offert maximum » + [Copier] |
| 1:40 | Karim | `bun teamstore/cli.ts nuit --exemple` | « Règle trouvée cette nuit : … » → [Certifier]. Exemple préparé, à annoncer comme tel |
| 2:10 | — | Live View « Frictions de l'équipe » | Détours par étape, états (attente, à documenter, partagée, certifiée) |
| 2:30 | — | — | Chiffres ([etat.md](etat.md)), vie privée, PR proposées à Screenpipe (correctif Mac, mémoire d'équipe chiffrée native, actions dans les Live Views) |

## Si ça coince

| Problème | Repli |
| --- | --- |
| Notification invisible | Relancer l'app Screenpipe, `test-notif` |
| Pas de ligne « Crisp : » dans le journal | Revenir 2 s sur la liste Crisp. Sinon l'aide générique « chercher par domaine » part quand même |
| Clic sans effet sur Mac | Mac non patché : Karim sur un second Windows, ou `simuler` |
| Rien ne se déclenche | `bun agent/main.ts injecter lea "…"` (le dire) |
| Stockage injoignable | Aide locale seulement (l'agent le dit au démarrage) |

## Questions

- Surveillance ? Détours par étape, pas par personne. `teamstore/schema.sql` : pas de colonne auteur, tout chiffré. Consentement, pause, périmètre limité aux applis de travail.
- Pourquoi pas l'IA de HubSpot ? Elle connaît le produit, pas vos règles (« 1 mois max, premium seulement » n'est écrit nulle part).
- Le texte part dans le cloud ? Vers le modèle choisi dans Screenpipe, identifiants masqués. Un modèle local reste sur le poste.
- L'IA invente une règle ? Elle propose seulement. Rien n'entre sans la responsable ; une règle avec nom, e-mail ou téléphone est refusée.
