# Reproduire ou adapter le parcours guidé

> Comment `/parcours` est construit, pour le refaire ailleurs, ajouter un chapitre ou raconter une autre histoire. Mode d'emploi : [PARCOURS.md](PARCOURS.md).

## 1. Les fichiers

| Fichier | Rôle |
| --- | --- |
| `teamstore/demo/parcours.html` | La page : barre de progression, récit, 3 colonnes (écran, agent, équipe), tableau en direct, vue du serveur |
| `teamstore/demo/parcours.ts` | Toute la logique : état affiché, interactions, équipe réelle, les 8 chapitres, le rendu |
| `teamstore/demo/style.css` | Les styles (section « parcours guidé » : `.story`, `.pgrid`, `.stage`, `.sp-notif`, `.member`, `.reveal`…) |
| `teamstore/demo/server.ts` | Sert la page et compile `parcours.ts` en JavaScript au démarrage (`Bun.build`, cible navigateur), et les routes `/api/*` |
| `teamstore/start.ts` | Démarre le stockage local, le serveur de pages, et branche les fonctions qui ont besoin de Screenpipe (modèle, notifications, Live View) |

`parcours.ts` réutilise sans les copier :

| Import | D'où | Pour quoi |
| --- | --- | --- |
| `SupabaseStore`, `Team`, `membershipFromInvite`, `AccessDenied` | `teamstore/client.ts` | L'équipe réelle : créer, inviter, publier, relire, certifier, changer de clé, purger |
| `Board` | `teamstore/demo/board.ts` | Le tableau « Frictions en direct » et les blocs de la Live View |
| `escalationPayload` | `teamstore/demo/escalade.ts` | La notification « 💬 Slack + message » (modèle de Minguk) |
| `classify`, `CRISP_CUSTOMERS` | `minguk/src/assist/crisp-assist.ts`, `minguk/src/seed/crisp-story.ts` | Les messages des clients de la démo et la lecture du besoin |
| (via `/api/nuit`) `judge` | `teamstore/nuit.ts` + `andrea/daemon/screenpipe.ts` (`chat`) | Le jugement de la nuit par le vrai modèle |
| (via `/api/seed`) | `andrea/daemon/solutions.seed.json` | Les règles de PipingTable |

Rien d'autre : **aucune dépendance npm**. Tout est en TypeScript, compilé par Bun.

## 2. Le serveur : les routes dont le parcours a besoin

| Route | Rôle | Fournie par |
| --- | --- | --- |
| `GET /parcours`, `GET /parcours.js` | La page et son script compilé | `server.ts` |
| `GET /api/config` | Où est le stockage (`url`, `anonKey`, `restPath`), canaux Slack, Live View disponible ou non | `start.ts` |
| `GET /api/seed` | Les règles de PipingTable | `server.ts` |
| `GET /api/operator` | Les blocs bruts du stockage local (bande noire) | `local-server.ts` |
| `POST /api/notify` | Relais vers les notifications Screenpipe (`127.0.0.1:11435/notify`) | `server.ts` |
| `POST /api/nuit` | Jugement de la nuit par le vrai modèle (rien n'est publié par le serveur) | `start.ts` → `nuit.ts` |
| `POST /api/live` | Publie les blocs de la Live View « Frictions en direct » | `start.ts` |

Les routes `POST` exigent l'en-tête `X-FA-Demo: 1`, pour qu'un autre site ouvert dans le navigateur ne puisse pas les appeler.

**Le chiffrement se fait dans la page** : le navigateur parle directement au stockage avec la clé publique. Le serveur de pages ne voit jamais une clé d'équipe.

## 3. Le moteur du parcours (dans `parcours.ts`)

**L'état affiché.** Un seul objet, `ui`, et une fonction `render()` qui redessine tout à partir de lui :

```ts
const ui = {
  chapter, title, what, why,            // le récit
  screenOwner, tab, crisp, hubspot, slack, notion, leaNotif,   // l'écran de Léa (ou de Yasmine)
  stages, agentNote, reveal,            // la colonne « agent »
  countdown, map, mapCommand,           // éléments ponctuels
  actions,                              // les boutons à cliquer
};
```

**Les acteurs** (`actors`) ont chacun une vraie `Team` (leur poste), une mémoire (`solutions`), un curseur de lecture, un statut et une notification affichée. `A("claire")` en renvoie un.

**Quatre fonctions font avancer l'histoire :**

| Fonction | Ce qu'elle fait |
| --- | --- |
| `await ask([{ label, act, primary }])` | Affiche un ou plusieurs boutons, puis attend le clic et renvoie l'`act` choisi. En **mode présentation**, le bouton principal se clique seul après 2,6 s. Un bouton dans une notification (`data-act`) répond aussi. |
| `pipeline(...)` puis `await stage(i, "active" \| "done" \| "miss", détail)` | Les 4 étapes de la colonne « agent » (👁 🧠 📦 🔒), allumées une à une avec une petite pause |
| `await wait(ms)` | Une pause (un peu plus courte quand on clique soi-même) |
| `await screenpipe(notif, "Léa")` | Envoie aussi la notification dans Screenpipe si la case est cochée |

**L'équipe est réelle.** `setup()` crée l'équipe Support (Claire en est responsable), fait rejoindre Léa, Karim et Yasmine avec le lien d'invitation, et publie la solution « partagée la veille ». Ensuite :
- `actor.team.publish(kind, objet)` : vraie publication chiffrée ;
- `pull(actor)` : vraie relecture, qui met à jour la mémoire de l'acteur (badge certifié, falsification) ;
- `A("claire").team.certify(...)`, `.rotate()`, `.purge(seq)` : certification, changement de clé, retrait.

**En continu**, toutes les 1,5 s :
- `renderServer()` remplit la bande noire ;
- `feedBoard()` relit l'équipe avec les clés de Claire, met à jour le tableau et publie la Live View si la case est cochée.

**Le déroulé** n'est qu'une liste :

```ts
for (const ch of [chapter1, chapter2, chapter3, chapter4, chapterNight, chapter5, chapter6, chapter7]) await ch();
```

## 4. Ajouter un chapitre

1. Ajouter son titre dans `CHAPTERS`, à la bonne place. La barre de progression et « Chapitre x / N » suivent automatiquement, à condition de numéroter `ui.chapter` et le total.
2. Écrire la fonction, sur ce modèle :

```ts
async function chapitreRelance() {
  ui.chapter = 6; ui.screenOwner = "Léa"; ui.tab = "crisp"; ui.why = "";
  ui.title = "16 h · Le client relance";
  ui.what = "Jean n'a pas eu de réponse et relance sur Crisp.";
  pipeline();                                   // les 4 étapes, éteintes
  render(); await wait(500);
  ui.crisp.push({ who: "Jean Dupont", text: "Toujours rien ?", when: "16 h 00" }); render();

  await ask([{ label: "Léa ouvre la conversation", act: "go", primary: true }]);
  await stage(0, "active", "Crisp : relance du client"); await stage(0, "done");
  await stage(1, "active", "Friction : **relance sans réponse**"); await stage(1, "done");
  await stage(2, "miss", "Aucune solution dans la mémoire");
  await A("lea").team.publish("request", { requestId: crypto.randomUUID(), step: "Crisp : relance sans réponse", at: new Date().toISOString() });
  await stage(3, "done", "Demande anonyme envoyée");

  ui.leaNotif = { title: "…", body: "…", tone: "help", buttons: [{ label: "OK", act: "ok", primary: true }] };
  ui.why = "Pourquoi ça compte, en une phrase.";
  await ask([{ label: "Suite", act: "ok", primary: true }]);
  ui.leaNotif = undefined;
}
```

3. L'insérer dans la liste du déroulé, puis renuméroter `ui.chapter` dans les chapitres suivants, et le total dans `render()` (« Chapitre ${ui.chapter} / 8 »).
4. Le récit (`what`, `why`) accepte `**gras**`, `` `code` `` et les retours à la ligne `\n`. Pas de HTML : tout est échappé.

**Repères visuels :**
- **notifications** : `tone: "help"` (vert, une aide), `"ask"` (orange, une demande à un collègue), `"slack"` (violet, l'escalade) ;
- **étapes de l'agent** : `"done"` en vert, `"miss"` en orange (rien trouvé, ou rien envoyé).

## 5. Raconter une autre histoire

Tout le contenu métier vient de trois sources, qu'il suffit de remplacer :

| Contenu | Où le changer |
| --- | --- |
| Les règles (titres, textes, étapes) | `andrea/daemon/solutions.seed.json` (servi par `/api/seed`), ou une autre liste passée à `sol(id)` |
| Les messages des clients | `CRISP_CUSTOMERS` (`minguk/src/seed/crisp-story.ts`), ou des textes en dur dans les chapitres |
| Les personnes et ce qu'elles savent | `setup()` dans `parcours.ts` (nom, avatar, rôle, solutions connues) |

Les textes affichés (titres, récits, Notion périmé, fil Slack) sont dans les chapitres eux-mêmes. Pour une autre entreprise, on garde le moteur (sections 2 et 3) et on réécrit les chapitres.

## 6. Le refaire hors de ce dépôt

Le minimum pour un parcours équivalent :
1. **Un stockage.** `teamstore/local-server.ts` (SQLite, aucun compte) ou un projet Supabase avec `teamstore/schema.sql`, plus la migration `migrations/2026-10-17-boucle-de-nuit.sql`.
2. **Le client.** `teamstore/crypto.ts` et `teamstore/client.ts`, sans dépendance, valables dans le navigateur comme dans Bun.
3. **Un serveur de pages** qui compile le script (`Bun.build({ entrypoints: ["parcours.ts"], target: "browser" })`) et sert `/api/config`, plus les routes de la section 2 dont on a besoin.
4. **La page et son script** : copier `parcours.html`, `parcours.ts`, `board.ts`, `escalade.ts` et la section « parcours guidé » de `style.css`.
5. **Facultatif** : Screenpipe pour les notifications réelles, la Live View et le jugement de la nuit. Sans Screenpipe, le parcours marche quand même : notifications seulement dans la page, verdict de nuit préparé.

**Contraintes du navigateur :**
- **Chrome, Edge, Safari 17+ ou Firefox 129+**, pour la signature Ed25519 de WebCrypto.
- La page doit être servie en `http://127.0.0.1`, qui compte comme contexte sécurisé : c'est nécessaire pour WebCrypto et pour le presse-papiers.

## 7. Le tester

Le parcours a été vérifié en le faisant jouer par Chrome, avec un petit script Playwright. Celui-ci clique chaque bouton principal et vérifie l'absence d'erreur JavaScript et le contenu de la carte finale. Pour le refaire, hors du dépôt pour ne pas ajouter de dépendance :

```bash
mkdir -p ~/.cache/fa-pw && cd ~/.cache/fa-pw && echo '{"private":true}' > package.json && bun add playwright-core
cp <dépôt>/teamstore/outils/parcours-check.mjs . && bun parcours-check.mjs     # friction-assist doit tourner
```

Le script affiche chaque chapitre, le jugement de la nuit, la carte finale et les erreurs éventuelles (`ERREURS: []` attendu).

Les calculs du tableau (`board.ts`) et de la boucle de nuit (`nuit.ts`) ont leurs tests unitaires : `bun test teamstore/board.test.ts teamstore/nuit.test.ts`.
