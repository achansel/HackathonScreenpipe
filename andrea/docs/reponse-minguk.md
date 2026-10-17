# Réponse d'Andrea au retour de Minguk

> 17/10 au soir. Réponse à [minguk/build/retour-andrea.md](../../minguk/build/retour-andrea.md). Décisions reportées dans [CONTEXTE.md](../CONTEXTE.md).

## Décisions

Les choix pour la démo (boutons, Mac patché, autorité du démon sur ton code) sont fixés à un seul endroit : [demo.md § Choix techniques](demo.md#choix-techniques-pour-la-démo-fixés-le-1710-ne-pas-rouvrir). En bref : ton code est gardé pour la démo, le démon agnostique a l'autorité ; `api` sous Windows, `link` pour [Y aller] ; Mac patché pour la démo, PR plus tard. La nuit qui construit les solutions et la machine de Léa : à la répétition.

## Ce dont j'ai besoin de toi ce soir

**Compiler et tester le correctif sur ton Mac** (jamais compilé : pas de chaîne Rust macOS chez moi). Les 4 commandes sont dans [screenpipe-patch/README.md](../screenpipe-patch/README.md) (Screenpipe à `30b50bb`, `git apply`, `bun run test:tauri local_api_action_target`, `bun run build:tauri:dev`, 20 à 40 min). Puis : une notification avec un bouton `api` vers `127.0.0.1:3030`, un clic, et me dire si l'appel arrive.

## Mesures qui te concernent

**Tes mots-clés** (`classify` de `crisp-assist.ts`), passés sur 15 messages :

| Messages | Résultat |
| --- | --- |
| les 4 phrases du script (panne, dédommagement, promis, combien) | 4/4 justes |
| hors de tes 4 besoins (offre, facture, heure des SMS, Réserver avec Google) | rien (pas d'aide, pas d'erreur) |
| normaux (merci, table en terrasse) | rien, juste |
| ton message de Sophie (« …n'envoie pas les rappels SMS. C'est inclus dans notre contrat ? ») | **bug**, alors que c'est l'offre |
| 4 messages inventés pour piéger | **3/4 faux** : « une erreur de ma part, je n'étais pas bloqué » → bug ; « le prix sur ma facture est faux » → prospect ; « un devis pour la formation » → prospect |

Solide sur le script, fragile hors du script : d'où l'autorité au démon.

**Mon démon en direct cet après-midi** (24 scénarios joués sur mon écran, [scenarios-data.md](scenarios-data.md)) : fort sur les questions Slack (bug, pipeline, remise, geste, prospect, demandes sans solution) ; faible sur HubSpot (recherche à 0 résultat jamais capturée, parcours manqués) ; défaut principal : l'historique d'un canal Slack relu comme une question. Détail dans [ETAT.md](../ETAT.md).

## Pour que nos deux codes ne se marchent pas dessus

- **Message client Crisp** : ton assistant et mon démon réagissent tous les deux (mesuré : mon démon a donné « promesse » sur le message d'Élodie). À régler : un seul notifieur, et une même aide (`geste` = `geste-commercial`, `promesse` = `promesse-commercial`, `bug` = `signaler-bug`, `prospect` = `prospect-chat`) servie une seule fois, priorité au démon.
- **La fiche client 🧭** : pas d'équivalent chez moi, elle s'ajoute sans conflit.
- **L'appel** (`bun run call`, ton commit `580dbd8`) : mon démon ne lit pas l'audio, pas de doublon. Point à trancher : la voix du **client** est transcrite (VISION, question ouverte sur l'audio : quoi garder, combien de temps).
- **Emoji** : on avait noté « pas d'emoji ni de ! » (règle de design Screenpipe) ; tes gabarits en ont (🧭 💬 📘). À aligner.
