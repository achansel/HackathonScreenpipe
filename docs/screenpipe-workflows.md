# Screenpipe Workflows : ce qui existe déjà

> **Statut :** état des lieux, vérifié dans le code et la doc de Screenpipe publiés le 16 octobre 2026.
> Workflows est un onglet de l'app Screenpipe, encore en bêta. Ce document sert à savoir ce qu'on peut réutiliser, et ce qui reste à construire.

## En bref

Workflows couvre 6 grandes familles de fonctions : trouver les tâches répétées, les mesurer, les vérifier et corriger, les transformer en livrable, les partager en équipe, et les exposer par l'API et le MCP.

**Ce qui manque :** aucun test réel de l'agent, aucune exécution par Screenpipe, aucune limite imposée à l'agent, aucun apprentissage à partir des erreurs de l'agent.

## 1. Trouver les tâches répétées (automatique)

- **Liste des tâches répétées** : Screenpipe analyse ton historique et la propose. Pour chaque tâche, il indique ce qui la déclenche (ex. « un client écrit »), le résultat attendu, combien de fois tu l'as faite, avec quelles apps, avec qui, et ses variantes.
- **Les étapes une par une**, classées en 5 types : action, saisie, résultat, décision, vérification. Chaque étape est accompagnée d'une citation de ce qui était à l'écran et de l'heure.
- **Une note de fiabilité** (fort, bon ou limité), selon le nombre de jours observés et de captures disponibles.
- **Une mise à jour automatique** en arrière-plan, en option.

## 2. Mesurer

- **Le temps par exécution** (moyenne, minimum, maximum). C'est du temps écoulé, pauses comprises, pas du temps de travail actif.
- **Les points de friction** : attente, changements d'app, travail refait, passages de relais. Pour chacun, une estimation en minutes, et une indication sur ta marge d'action : tu peux le changer, tu peux l'influencer, ça dépend d'un tiers, ou c'est obligatoire (une validation légale par exemple).
- **Le coût** : tu entres un coût horaire en euros ou en dollars et il calcule ce que la tâche coûte.
- **Un profil d'entreprise** : activité, rôles, règles. L'exemple affiché dans leur interface : « Le support gère le tri des incidents. La finance approuve les remboursements au-dessus de 500 $. »

## 3. Vérifier et corriger

- **La preuve de chaque étape** : un bouton ouvre le moment enregistré (capture ou vidéo).
- **Des questions ouvertes** posées par Screenpipe, du type « que fais-tu si… ». Tu réponds par écrit ou à la voix.
- **Un chat de correction** : tu dis ce qui est faux, l'IA corrige le workflow et retient la leçon.
- **L'édition manuelle** des étapes.

## 4. Transformer en livrable

- **Une procédure écrite** (SOP) modifiable, avec captures d'écran, exportable en Markdown ou HTML.
- **Une procédure vidéo** : un MP4 commenté par une voix, avec sous-titres, généré à partir des captures.
- **Une skill pour un agent** : « Create skill », tu relis, puis « Install in my agents » pour Claude, Codex, Cursor ou l'agent de Screenpipe.
- **Un bouton pour lancer un agent** : il ouvre Claude, Codex ou Cursor avec un message du type « exécute ce workflow, demande confirmation avant d'envoyer ou de supprimer quoi que ce soit ».

## 5. Équipe et entreprise

- **Un éditeur web et le partage** des workflows dans un espace d'équipe. Le traitement peut se faire sur l'ordinateur, dans le cloud ou dans un cloud dit « confidentiel », et les données sensibles sont masquées avant partage.
- **Teams** : un administrateur envoie à toute l'équipe les mêmes tâches planifiées, les mêmes filtres de confidentialité et les modèles d'IA autorisés. Tout est chiffré.

## 6. Ce qu'on peut brancher pendant le hackathon

- **L'API locale** : `GET /workflows` donne la liste, et `GET /workflows/{id}` donne les étapes, les preuves et le détail des boutons et champs vus à l'écran.
- **Le serveur MCP**, avec `list-workflows` et `get-workflow` : Claude peut lire tes workflows directement.

## Ce qui n'existe pas encore

- **Aucun test réel de l'agent.** Leur propre interface affiche sur chaque workflow : « Source-backed steps · not execution-tested » (les étapes s'appuient sur des preuves, mais rien n'a été testé en exécution). Leur doc sur la validation se limite à un prompt qui rédige un plan de test, que personne n'exécute. C'est exactement le trou visé par l'idée 1, le permis de l'agent.
- **Screenpipe n'exécute rien lui-même.** Le bouton passe seulement un prompt à Claude ou Codex. La description de `get-workflow` le dit clairement : ce sont des preuves, pas une automatisation exécutable ni une autorisation d'agir.
- **Aucune limite imposée à l'agent** (ce qu'il fait seul, ce qu'il doit demander, ce qu'il ne fait jamais). Les règles ne sont que du texte dans la skill.
- **Aucun apprentissage à partir des erreurs de l'agent.** Les corrections viennent uniquement de l'humain qui relit le workflow. L'idée 2 reste donc ouverte.

## Conséquences pour nos idées

- **L'idée 5 (le radar de ce qu'il faut automatiser) est déjà largement couverte**, avec le temps, les frictions et le coût. À abandonner.
- **L'idée 4 l'est en partie**, puisque le partage existe déjà ; seule l'adaptation d'un workflow à un collègue reste à faire.
- **À vérifier ce soir :** l'onglet Workflows apparaît-il bien dans l'app avec l'accès hackathon ? Sinon, le demander tout de suite sur le Discord : sans lui, l'idée 1 doit reposer sur des données préparées à la main.

## Vérifié sur un Mac de l'équipe (16 octobre au soir)

- `GET /workflows` répond `200` (moteur 0.4.52), avec **0 workflow** : normal, l'enregistrement venait de commencer et la découverte demande de l'historique.
- Dans le code (`packages/workflows-ui`) : la mention `Source-backed steps · not execution-tested` existe bien (`workflows-app.tsx`), et les types de friction sont `waiting | switching | rework | handoff | unclear` (`model.ts`).

## Sources

- [Code et doc Screenpipe](https://github.com/screenpipe/screenpipe) : `packages/workflows-ui`, `packages/screenpipe-mcp` et la doc d'intégration dans `docs/mintlify`
- [Annonce de Workflows](https://screenpipe.com/blog/screenpipe-v2-32-workflows)
