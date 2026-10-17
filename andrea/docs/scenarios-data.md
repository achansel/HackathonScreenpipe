# Générer de la donnée réelle : feuille de scénarios

But : des épisodes **réels** du cas d'usage (Crisp + HubSpot + Slack), frictions et travail normal, pour étiqueter à la main (`bun andrea/offline/main.ts etiqueter`) puis apprendre. Environ 45 min. N'importe qui de l'équipe peut la jouer sur son poste, le daemon lancé.

## Règles

- Daemon lancé (`bun andrea/daemon/main.ts --debug`). **Fenêtre Claude/terminal hors de l'écran capturé** : l'OCR attribue parfois son texte à Slack ou Crisp (mesuré).
- Ouvrir la fenêtre (conversation, canal, fiche) **avant** d'agir, attendre 3 s : la première capture d'une fenêtre sert de référence.
- 10 s de pause entre deux scénarios (le daemon attend que l'écran soit stable).
- Faire réellement le geste (chercher, cliquer, hésiter) : c'est l'action de l'employé qui fait la friction, pas le message du client.
- Cliquer [Ça m'a aidé] / [Pas ça] selon ce qu'on pense vraiment. Une même aide n'est pas remontrée avant 10 min : normal.
- Clients fictifs uniquement (`@example.com`, voir [docs/crisp.md](../../docs/crisp.md)).

## Liens clients (onglet client)

| Client | Lien |
| --- | --- |
| Jean Dupont | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Jean%20Dupont&user_email=jd.resto75%40resa-paris.test&locale=fr` |
| Sophie Arnaud | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Sophie%20Arnaud&user_email=sophie.arnaud%40example.com&locale=fr` |
| Élodie Marchand | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=%C3%89lodie%20Marchand&user_email=elodie.marchand%40example.com&locale=fr` |
| Pieter Janssens | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Pieter%20Janssens&user_email=pieter.janssens%40example.com&locale=fr` |
| Kenji Mori | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Kenji%20Mori&user_email=kenji.mori%40example.com&locale=fr` |
| Marco Bellini | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Marco%20Bellini&user_email=marco.bellini%40example.com&locale=fr` |
| Anne Le Gall | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Anne%20Le%20Gall&user_email=anne.le-gall%40example.com&locale=fr` |
| Camille Robert | `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Camille%20Robert&user_email=camille.robert%40example.com&locale=fr` |

## Scénarios

« Attendu » = étiquette visée (détour / solution d'équipe), `aucun` = travail normal.

| # | Ce que tu fais | Attendu |
| --- | --- | --- |
| 1 | Jean : « Bonjour, ma page de réservation est en panne, les clients ne peuvent plus réserver. » → HubSpot, chercher exactement `jd.resto75@resa-paris.test` (0 résultat), et reste 3 s sur cet écran | recherche / client-introuvable |
| 2 | HubSpot : chercher `le-bistro.example` → trouvé, ouvrir la fiche | aucun |
| 3 | Slack `#support` : « Je signale où un bug de page de réservation ? » | demande_aide / signaler-bug |
| 4 | HubSpot : créer un ticket, ouvrir la liste des pipelines, choisir « Support OLD », se raviser, prendre « Support » | tatonnement / pipeline-support |
| 5 | Jean : « Toujours rien… je veux un dédommagement. » → répondre « Je vérifie avec l'équipe et je reviens vers vous. » | demande_aide / geste-commercial |
| 6 | Sophie : « Les rappels SMS sont inclus dans notre contrat ? » → HubSpot, fiche Sophie Arnaud → Entreprise → Transactions → la transaction → Produits | parcours / offre-du-client |
| 7 | Répondre à Sophie : « Oui, les rappels SMS sont inclus dans votre offre Groupe. » | aucun |
| 8 | Élodie : « Thomas m'avait promis l'installation sur place gratuite, quand passez-vous ? » → HubSpot, transaction Maison Pivoine, chercher la promesse en faisant défiler | recherche / promesse-commercial |
| 9 | Slack `#deal-desk` : « Thomas a promis l'install gratuite à Maison Pivoine, c'est noté où ? » | demande_aide / promesse-commercial |
| 10 | Pieter : « Combien pour 3 restaurants ? Nous sommes à Bruxelles. » → HubSpot, chercher `Janssens` (0), puis `Brasserie des Arts` (0) | recherche / prospect-chat |
| 11 | Slack `#support` : « Un prospect belge sur le chat, je le crée dans quel stage ? » | demande_aide / prospect-chat |
| 12 | Kenji : « Bonjour, je ne trouve pas ma facture de septembre. » → HubSpot, chercher « facture » (rien) → Slack `#support` : « On trouve où les factures des clients ? » | demande_aide / aucune solution (demande anonyme) |
| 13 | Marco : « Les SMS partent à 8 h, possible à 11 h ? » → Slack `#support` : « On peut changer l'heure d'envoi des SMS de rappel ? » | demande_aide / aucune solution |
| 14 | Anne : « Le bouton Réserver n'apparaît pas sur notre fiche Google. » → Slack `#support` : « Réserver avec Google n'apparaît pas, c'est quel réglage ? » | demande_aide / aucune solution |
| 15 | Slack `#deal-desk` : « Les Tontons Burger demandent 25 %, HubSpot me bloque, je fais comment ? » | demande_aide / remise-15 |
| 16 | Camille Robert : « Comment ajouter une table en terrasse ? » → répondre « Plan de salle → Ajouter une table → Terrasse. » | aucun |
| 17 | Slack `#social` : « Quelqu'un pour un café à 17 h ? » | aucun |
| 18 | HubSpot : chercher « Osteria Nonna » → trouvé, lire la fiche 30 s | aucun |
| 19 | HubSpot : chercher `camille.robert@example.com` → trouvé | aucun |
| 20 | Slack `#support` : répondre dans le fil d'un collègue : « Cherche par domaine du site, ça marche. » | aucun |
| 21 | HubSpot : vue Transactions, faire défiler 30 s | aucun |
| 22 | Slack `#support` : « Un client premium râle après la panne, on peut lui faire un geste ? » | demande_aide / geste-commercial |
| 23 | Slack `#support` : « Je crée le ticket dans quel pipeline déjà ? » | demande_aide / pipeline-support |
| 24 | Crisp : ouvrir trois conversations à la suite, les lire, ne rien écrire | aucun |

## Après

```bash
bun andrea/offline/main.ts collecter
bun andrea/offline/main.ts etiqueter --n 80
bun andrea/offline/main.ts apprendre
bun andrea/offline/main.ts rapport
```
