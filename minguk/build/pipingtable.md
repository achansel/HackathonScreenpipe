# PipingTable : l'environnement de démo

> **Statut :** créé le 17 octobre 2026 dans HubSpot et Slack ; pages Notion prêtes à importer ; Crisp à compléter.
> Reprend le profil de [ClientProfile.md](../../ClientProfile.md) (« TableNow », renommée **PipingTable**) et la journée de Léa de [UseCase.md](../../UseCase.md). Tout est fictif : e-mails en `@example.com`, domaines en `.example`, téléphones en `06 39 98 xx xx`, noms inventés.

## En bref

| Appli | Ce qui existe | Source | Commande |
| --- | --- | --- | --- |
| **HubSpot** (portail 149568075, `app-eu1`) | 30 entreprises, 30 contacts, 29 transactions, 54 lignes de produits | [src/seed/pipingtable.ts](../src/seed/pipingtable.ts) | `bun run seed` |
| **Slack** (espace « Piping Company ») | 5 canaux, 24 messages signés par 8 employés fictifs | [src/seed/slack-story.ts](../src/seed/slack-story.ts) | `bun run seed:slack` |
| **Notion** | 4 pages, dont une **périmée** | [content/notion/](../content/notion/) | import manuel |
| **Crisp** | les clients qui écrivent pendant la démo | [docs/crisp.md](../../docs/crisp.md) | liens directs |

## L'entreprise

**PipingTable** vend un logiciel de réservation aux restaurants, par abonnement mensuel. Une trentaine de personnes, en France (et un peu en Belgique). Outils : Crisp, HubSpot, Slack, Notion.

### Les employés

Personne n'a de vrai compte : les employés signent les messages Slack (nom affiché + emoji, badge « APP »). Léa est jouée par la personne qui présente.

| Employé | Rôle | Où il apparaît | Ce qu'il sait |
| --- | --- | --- | --- |
| **Léa** | agente du support, 2 semaines de poste | celle qui bloque (la démo) | rien encore |
| **Claire Morin** | responsable du support | Slack #onboarding, #support, #bugs ; auteure de la page Notion périmée | la règle du geste commercial |
| **Karim Bensaïd** | support, 3 ans de maison | Slack #support, #bugs | presque tout : chemins HubSpot, #bugs, promesses |
| **Yasmine Roche** | support | Slack #support, #bugs | elle pose les questions que Léa se posera |
| **Thomas Girard** | ventes France | Slack #deal-desk ; « Commercial » de 15 transactions | ses promesses (pas toujours notées) |
| **Nadia Benali** | ventes France | Slack #deal-desk ; « Commercial » de 13 transactions | attend une validation pour Osteria Nonna |
| **Sarah Lambert** | ventes Belgique | Slack #new-leads ; Brasserie du Nord | les prospects belges sont pour elle |
| **Antoine Rey** | COO | Slack #deal-desk ; page Notion des tarifs | valide les remises de plus de 15 % |
| **Max Durand** | tech | Slack #bugs | corrige les bugs |
| **Hugo Vidal** | administrateur HubSpot | cité dans Slack et Notion | doit ajouter l'offre sur la fiche contact |

### Le catalogue

| Produit | Prix HT |
| --- | --- |
| Offre Essentiel | 49 €/mois |
| Offre Premium (support prioritaire, appel mensuel) | 99 €/mois |
| Offre Groupe (3 établissements ou plus) | 79 €/mois par établissement |
| Rappels SMS · Acompte anti no-show · Réserver avec Google · Avis clients | 15 € · 19 € · 10 € · 12 €/mois |
| Installation sur site · Formation de l'équipe | 150 € · 90 €, une fois |

### Les règles maison, et où elles vivent

C'est le cœur de l'histoire : **la documentation existe, elle est fausse, et la bonne réponse est enfouie dans Slack.**

| Règle (la vraie) | Où elle est dite | Ce que dit Notion (périmé) |
| --- | --- | --- |
| Geste commercial : 1 mois offert max, Premium ou Groupe seulement, sinon un bon de 10 % ; note « geste commercial » | fil de Claire dans #support | « jusqu'à 2 mois, quelle que soit l'offre » |
| Bug : #bugs avec le modèle épinglé ; ticket dans le pipeline « Support » | Karim dans #support ; modèle épinglé dans #bugs | « e-mail à tech@ ; pipeline Support OLD » |
| Client introuvable : chercher par téléphone, domaine ou nom du restaurant | Karim dans #support | « chercher l'e-mail » |
| Offre d'un client : Contact → Entreprise → Transactions → contrat signé → Produits | Karim dans #support | « l'offre est sur la fiche contact » |
| Promesse d'un commercial : notée dans « Conditions particulières » | Karim dans #support ; grille tarifaire | — |
| Remise de plus de 15 % : validation dans #deal-desk | Antoine dans #deal-desk ; grille tarifaire | — |
| Prospect belge : Sarah, cycle de vie « Lead », message dans #new-leads | Sarah, épinglé dans #new-leads | « transférer à Thomas » |
| Clôturer une vente : SIREN obligatoire | (à rendre obligatoire dans HubSpot, voir plus bas) | — |

## Les clients (HubSpot)

| Entreprise | Ville | Offre | Sites | Contact | E-mail (HubSpot) | Vente | Commercial |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Le Bistro | Paris | Premium | 1 | Jean Dupont | `jean.dupont@example.com` | signé 2026-03-12 | Thomas Girard |
| Le Bistro (doublon) | Paris | — | 1 | — | — | — | — |
| Maison Pivoine | Nantes | Premium | 1 | Élodie Marchand | `elodie.marchand@example.com` | signé 2026-10-14 | Thomas Girard |
| Le Petit Zinc | Bordeaux | — | 1 | Luc Fabre | `luc.fabre@example.com` | contrat envoyé 2026-10-20 | Thomas Girard |
| Osteria Nonna | Lille | — | 2 | Giulia Rinaldi | `giulia.rinaldi@example.com` | contrat envoyé 2026-10-24 | Nadia Benali |
| Groupe Saveurs du Sud | Marseille | Groupe | 5 | Sophie Arnaud, Jean-Marc Ferrand | `sophie.arnaud@example.com`, `jean-marc.ferrand@example.com` | signé 2026-01-20 | Nadia Benali |
| Bistrot du Marché | Lyon | Essentiel | 1 | Jean Moreau | `jean.moreau@example.com` | signé 2025-11-03 | Thomas Girard |
| Bistro des Canuts | Lyon | Premium | 1 | Camille Robert | `camille.robert@example.com` | signé 2026-02-18 | Nadia Benali |
| Chez Mounia | Paris | Premium | 1 | Mounia Haddad | `mounia.haddad@example.com` | signé 2026-05-06 | Thomas Girard |
| L'Escale | La Rochelle | Essentiel | 1 | Jean Lefebvre | `jean.lefebvre@example.com` | signé 2025-12-09 | Nadia Benali |
| Le Jardin d'Hiver | Strasbourg | Premium | 1 | Claire Weber | `claire.weber@example.com` | signé 2026-04-22 | Nadia Benali |
| Au Vieux Four | Toulouse | Essentiel | 1 | Jeanne Roux | `jeanne.roux@example.com` | signé 2026-06-30 | Thomas Girard |
| La Fourchette Verte | Rennes | Essentiel | 1 | Hugo Lemaire | `hugo.lemaire@example.com` | signé 2026-07-15 | Thomas Girard |
| Le Quai 12 | Bordeaux | Premium | 1 | Jean-Baptiste Morel | `jean-baptiste.morel@example.com` | signé 2026-01-08 | Thomas Girard |
| Sushi Kumo | Paris | Premium | 2 | Kenji Mori | `kenji.mori@example.com` | signé 2026-08-27 | Nadia Benali |
| Pizzeria Bella Sera | Nice | Essentiel | 1 | Marco Bellini | `marco.bellini@example.com` | signé 2025-10-21 | Nadia Benali |
| Le Relais du Port | Brest | Essentiel | 1 | Jean Petit | `jean.petit@example.com` | signé 2026-03-30 | Thomas Girard |
| Crêperie Ker Avel | Quimper | Essentiel | 1 | Anne Le Gall | `anne.le-gall@example.com` | signé 2026-05-19 | Thomas Girard |
| Les Tontons Burger | Lille | Premium | 3 | Yanis Brahimi | `yanis.brahimi@example.com` | signé 2026-09-02 | Nadia Benali |
| Le Petit Atelier | Annecy | Premium | 1 | Jean-Luc Gauthier | `jean-luc.gauthier@example.com` | signé 2025-12-15 | Thomas Girard |
| Café Lumière | Montpellier | Essentiel | 1 | Inès Garcia | `ines.garcia@example.com` | signé 2026-06-11 | Nadia Benali |
| Le Bistro Gourmand | Dijon | Premium | 1 | Paul Bernard | `paul.bernard@example.com` | signé 2026-02-02 | Thomas Girard |
| La Table de Marius | Aix-en-Provence | Premium | 1 | Jean Fabre | `jean.fabre@example.com` | signé 2026-04-08 | Nadia Benali |
| Le Comptoir Saint-Pierre | Tours | Essentiel | 1 | Léon Dumas | `leon.dumas@example.com` | signé 2026-08-05 | Thomas Girard |
| Maison Sakura | Grenoble | Essentiel | 1 | Aiko Tanaka | `aiko.tanaka@example.com` | signé 2026-09-23 | Nadia Benali |
| La Guinguette d'Auguste | Angers | Essentiel | 1 | Margaux Perrin | `margaux.perrin@example.com` | signé 2025-11-27 | Thomas Girard |
| Brasserie du Nord | Liège | Premium | 1 | Sander Peeters | `sander.peeters@example.com` | signé 2026-07-01 | Sarah Lambert |
| Les Comptoirs de Lucie | Lyon | Groupe | 3 | Lucie Fontaine | `lucie.fontaine@example.com` | signé 2026-03-04 | Nadia Benali |
| La Table Ronde | Reims | — | 1 | Jean Mercier | `jean.mercier@example.com` | perdu 2026-06-18 | Thomas Girard |
| Le Fil Rouge | Metz | — | 1 | Nora Klein | `nora.klein@example.com` | démo 2026-10-28 | Nadia Benali |

**Prospect présent seulement dans Crisp :** Pieter Janssens (`pieter.janssens@example.com`), Brasserie des Arts, Bruxelles, 3 restaurants.

**Volontairement :** 10 prénoms en « Jean » et 5 noms en « Bistro » (dont un doublon de Le Bistro, sans contact ni vente) : chercher « Jean » ou « Bistro » ne suffit pas. Environ **3 100 €** de revenu mensuel ; signatures d'octobre 2025 à octobre 2026, dans 23 villes.

**Propriétés ajoutées par le script :** entreprise « Offre PipingTable », « Nombre d'établissements », « SIREN » ; transaction « Commercial », « Conditions particulières » ; partout « Créé pour la démo » (`demo_seed`).

## Les clients au cœur des frictions

| Client | Ce qui est préparé | Friction (UseCase.md) |
| --- | --- | --- |
| **Le Bistro**, Paris · Jean Dupont | Premium + SMS + acompte, signé en mars. HubSpot : `jean.dupont@example.com` ; dans Crisp il écrit avec **`jean.d@example.com`** | 9 h 05 introuvable · 9 h 20 offre à 4 clics · 9 h 40 bug · 11 h geste commercial |
| **Le Bistro** (doublon) | même nom, sans contact ni transaction | 9 h 05 : plusieurs « Bistro » |
| **Maison Pivoine**, Nantes · Élodie Marchand | signée il y a 3 jours par Thomas, **conditions particulières vides** | 14 h : « Thomas m'a promis l'installation gratuite » |
| **Le Petit Zinc**, Bordeaux · Luc Fabre | contrat envoyé, **pas de SIREN** | Thomas ne peut pas clôturer |
| **Osteria Nonna**, Lille · Giulia Rinaldi | contrat envoyé, **20 % de remise** ; demande dans #deal-desk **sans réponse** | la validation qui traîne |
| **Groupe Saveurs du Sud**, Marseille · Sophie Arnaud | Offre Groupe, 5 restaurants | « quel contrat couvre ce site ? » |
| Pieter Janssens, Bruxelles | **dans Crisp seulement** | 15 h 30 : prospect belge |

## Slack

Espace « Piping Company ». Les canaux de l'équipe (#all-piping-company, #social) ne sont pas touchés ; #logistics et #new-channel ont été archivés.

| Canal | Contenu |
| --- | --- |
| **#onboarding** | Claire accueille Léa : « les process sont dans Notion » |
| **#support** | client introuvable · chemin vers l'offre · « Pas ici, dans #bugs » · **la règle du geste commercial** (et « la page Notion n'est plus à jour ») · rappel sur les promesses |
| **#bugs** | 📌 le modèle de signalement ; deux bugs signalés avec lui (un corrigé par Max) |
| **#deal-desk** | « 20 % max, au-delà de 15 % toujours ici » ; Osteria Nonna en attente |
| **#new-leads** | 📌 « prospects belges → Sarah, en Lead » ; un lead de Liège |

Limites : les messages sont datés du jour de création et portent le badge « APP ». Le texte complet : `bun run seed:slack --dry-run`.

## Notion

Les 4 pages de [content/notion/](../content/notion/), à importer (barre latérale → Import → Text & Markdown) :

| Page | Rôle |
| --- | --- |
| **01 Process support** (février 2025) | **le wiki périmé** : contredit Slack sur le geste commercial, les bugs, la recherche de client, les prospects |
| **02 Grille tarifaire 2026** | à jour : offres, options, règles de remise |
| **03 Onboarding support, semaine 1** | qui fait quoi, outils, checklist, canaux Slack |
| **04 Modèles de réponses Crisp** | réponses types (bug, panne résolue, geste, prospect) |

## Clés et commandes

Depuis `minguk/`, avec `source ~/.config/friction/env` (fichier hors dépôt, chmod 600) :

| Variable | Contenu | Droits |
| --- | --- | --- |
| `HUBSPOT_SEED_TOKEN` | clé de service HubSpot « demo-seed » | contacts, companies, deals, line_items (lecture + écriture) ; `crm.schemas.companies/contacts/deals.write` |
| `SLACK_SEED_TOKEN` | jeton `xoxb-` de l'appli Slack « PipingTable seed » | `channels:manage/read/join/history`, `chat:write`, `chat:write.customize`, `chat:write.public`, `pins:write`, `users:read` |

```bash
bun run seed --dry-run      # HubSpot : ce qui serait créé
bun run seed                # HubSpot : crée (reprend après une erreur)
bun run seed --fill         # HubSpot : ajoute les propriétés personnalisées aux clients existants
bun run seed --wipe         # HubSpot : efface tout ce que le script a créé
bun run seed:slack          # Slack : canaux et historique
bun run seed:slack --wipe   # Slack : supprime les messages, archive les canaux créés
```

Les identifiants créés sont notés dans `~/.local/share/friction/hubspot-seed.json` et `slack-seed.json` (hors dépôt) : `--wipe` n'efface que ça. Une seule personne lance les scripts.

URL de démo (affichées par les scripts) :

```bash
export DEMO_HUBSPOT_RECORD_URL="https://app-eu1.hubspot.com/contacts/149568075/record/0-1/894330156269"   # Jean Dupont
export DEMO_HUBSPOT_DEAL_URL="https://app-eu1.hubspot.com/contacts/149568075/record/0-3/527998523641"     # vente du Bistro
export DEMO_SLACK_CHANNEL_URL="https://app.slack.com/client/T0CAR1HU95W/C0CAVM9DR7A"                       # #bugs
export DEMO_SLACK_SUPPORT_URL="https://app.slack.com/client/T0CAR1HU95W/C0C9ZBHECDU"                       # #support
```

## Reste à faire à la main

- [ ] HubSpot : rendre le SIREN obligatoire à l'étape « Closed Won » (Paramètres → Objets → Transactions → Pipelines).
- [ ] HubSpot : désactiver la création automatique des entreprises (sinon une entreprise « example.com » réapparaît) ; supprimer l'entreprise d'exemple « HubSpot ».
- [ ] Notion : importer les 4 pages.
- [ ] Crisp : ajouter Jean Dupont, Élodie Marchand et Pieter Janssens à [docs/crisp.md](../../docs/crisp.md) ; écrire 5 ou 6 anciennes conversations à la main.
- [ ] Crisp : garder l'intégration Crisp → HubSpot **désactivée** (friction de 17 h).

## Questions ouvertes

1. Pipeline des ventes : renommer les étapes en français (Démo, Contrat envoyé, Signé, Perdu) ?
2. Tickets « Support » / « Support OLD » (friction de 9 h 40) : les créer aussi ? Il faut le droit `tickets`.
3. Des notes d'historique dans HubSpot (« geste commercial accordé en mars ») ?
