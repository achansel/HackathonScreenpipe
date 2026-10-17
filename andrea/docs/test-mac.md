# Test Mac : boutons de notification, relais webhook, `/feedback`

> But : confirmer sur Mac ce qui est déjà mesuré sous Windows (voir [PROPOSITION.md](../PROPOSITION.md) §6). ~15 min.
> Résultat attendu d'après le code : `link`, `copy` et 👍/👎 marchent ; le bouton `api` (relais) peut **ne rien faire** sur Mac (`native_actions.rs:1131`).

## 0. Prérequis

Toutes les commandes se lancent **depuis la racine du dépôt**.


- Screenpipe lancé, enregistrement actif, notifications **non** en pause.
- Bun installé (`curl -fsSL https://bun.sh/install | bash`), dépôt à jour.

```bash
scripts/screenpipe-env.sh && source ~/.config/screenpipe/env
```

Deux terminaux : **T1** pour le récepteur, **T2** pour les commandes.

## 1. Récepteur (T1)

```bash
bun andrea/scripts/test-receiver.ts
```

Vérif (T2) : doit afficher « ok — reçu… », et une ligne apparaît dans T1.

```bash
curl -s -X POST http://127.0.0.1:8787/ping -d mac
```

## 2. Connexion n8n de test → récepteur (T2)

Vérifier d'abord qu'aucune connexion n8n n'existe déjà (sinon : stop, ne pas l'écraser) :

```bash
curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" "$SCREENPIPE_URL/connections/n8n"
```

Attendu : `{"connected":false,...}`. Puis :

```bash
curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" -H "Content-Type: application/json" -X POST "$SCREENPIPE_URL/connections/n8n" -d '{"credentials":{"webhook_url":"http://127.0.0.1:8787/hook"}}'
```

Relais en appel direct (attendu : `{"success":true,"upstream_status":200}` et, dans T1, le corps reçu **sans** `authorization`) :

```bash
curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" -H "Content-Type: application/json" -X POST "$SCREENPIPE_URL/connections/n8n/proxy" -d '{"episode":"ep-mac","action":"direct","nonce":"m-0"}'
```

## 3. Notifications (T2)

Après chaque envoi : **regarder l'écran**. Un `"Notification sent successfully"` ne prouve pas l'affichage (panneau vide constaté sous Windows).

**A. Bouton `api` via le relais** → cliquer « Tester le relais », puis regarder T1.

```bash
curl -s -X POST http://127.0.0.1:11435/notify -H "Content-Type: application/json" -d '{"id":"mac-relais-1","title":"Mac A : relais","body":"Clique sur **Tester le relais**.","timeout":0,"actions":[{"id":"relay","label":"Tester le relais","type":"api","url":"http://127.0.0.1:3030/connections/n8n/proxy","method":"POST","body":{"episode":"ep-mac","action":"clicked","nonce":"m-1"},"primary":true}]}'
```

**B. Bouton `link`** → cliquer « Y aller » : le navigateur doit afficher « ok — reçu… » et T1 une ligne `GET /go/ep-mac?t=m-2`.

```bash
curl -s -X POST http://127.0.0.1:11435/notify -H "Content-Type: application/json" -d '{"id":"mac-link-1","title":"Mac B : lien","body":"Clique sur **Y aller**.","timeout":0,"actions":[{"id":"go","label":"Y aller","type":"link","url":"http://127.0.0.1:8787/go/ep-mac?t=m-2","primary":true}]}'
```

**C. Bouton `copy`** → cliquer « Copier », puis vérifier le presse-papiers :

```bash
curl -s -X POST http://127.0.0.1:11435/notify -H "Content-Type: application/json" -d '{"id":"mac-copy-1","title":"Mac C : copier","body":"Clique sur **Copier**.","timeout":0,"actions":[{"id":"copy","label":"Copier","type":"copy","value":"texte copie par screenpipe"}]}'
```

```bash
pbpaste
```

**D. 👍/👎 + correction** → cliquer le **pouce bas** et écrire un mot (ex. « test mac »).

```bash
curl -s -X POST http://127.0.0.1:11435/notify -H "Content-Type: application/json" -d '{"id":"mac-retour-1","title":"Mac D : retours","body":"Pouce bas, puis un mot de correction.","pipe_name":"friction-assist","timeout":0}'
```

```bash
curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" "$SCREENPIPE_URL/feedback?kind=notification&target_id=mac-retour-1"
```

Attendu : `"rating":"down"`, `"comment":"test mac"`, `"producer_ref":"pipe:friction-assist"`.

## 4. Nettoyage

```bash
curl -s -H "Authorization: Bearer $SCREENPIPE_API_KEY" -X DELETE "$SCREENPIPE_URL/connections/n8n"
```

Puis Ctrl+C dans T1.

## 5. Résultats (à remplir et commiter)

| Test | Affiché à l'écran ? | Résultat | Notes |
| --- | --- | --- | --- |
| 2. relais direct | — | | |
| A. `api` via relais | | **échec (17/10)** : le clic n'arrive pas au récepteur | conforme au code (`native_actions.rs:1131`) |
| B. `link` | | | page + ligne `GET /go/…` ? |
| C. `copy` | | | `pbpaste` ? |
| D. 👍/👎 + correction | | | où est le bouton ? `comment` présent ? |

Version de l'app (menu Screenpipe → À propos) : ……  · macOS : ……
