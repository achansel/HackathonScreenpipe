# Boutons `api` sur macOS : le constat, et un diff non appliqué

**Problème** : sur Mac, un clic sur un bouton de notification de type `api` ne fait rien. Le panneau natif renvoie l'action au JavaScript de la fenêtre overlay, « usually not mounted » (`native_actions.rs:1131`). Mesuré : le clic n'arrive jamais. Seul `record-hd` est traité en Rust.

**Correctif** (`native-api-action.patch`, 93 lignes, contre `screenpipe/screenpipe@30b50bb`) : dans `apps/screenpipe-app-tauri/src-tauri/src/commands/native_actions.rs`, un bouton `api` sans deeplink est exécuté en Rust, comme `record-hd` :
- **même règle de cible** que `isLocalApiUrl` (`lib/api.ts`) : chemin relatif, ou `http://localhost|127.0.0.1:<port de l'API>` ; tout le reste est refusé (la requête porte la clé) ;
- `method` / `body` de l'action, clé ajoutée par `LocalApiContext::apply_auth_blocking` ;
- les actions avec `deeplinkUrl` restent sur le chemin JS ;
- tests unitaires de `local_api_action_target` (cibles acceptées / refusées).

Ni compilé, ni testé, ni proposé à Screenpipe : il documente le constat et l'endroit. La démo tourne sur Windows, où les boutons `api` marchent.

## Appliquer et compiler (Mac)

Procédure du dépôt Screenpipe (`AGENTS.md`, `docs/macos-dev-builds.md`) : uniquement leurs scripts, jamais `cargo` à la main pour `src-tauri`.

```bash
git clone https://github.com/screenpipe/screenpipe && cd screenpipe && git checkout 30b50bb
```

```bash
git apply /chemin/vers/HackathonScreenpipe/screenpipe-patch/native-api-action.patch
```

```bash
cd apps/screenpipe-app-tauri && bun install && bun run test:tauri local_api_action_target
```

```bash
bun run build:tauri:dev
```

- Une app recompilée change d'identité : **redonner l'enregistrement d'écran et l'accessibilité** (Réglages système → Confidentialité). `docs/macos-dev-builds.md` décrit le chemin signé si l'identité doit rester stable.
- Quitter l'app officielle avant de lancer la version patchée (même port 3030).
- Test : envoyer une notification avec un bouton `api` (`bun agent/main.ts test-notif`) et vérifier que le clic arrive dans le journal de l'agent.

## Licence

Le diff dérive du code de Screenpipe et reste sous sa licence ; la licence MIT du dépôt ne s'y applique pas.

Licence commerciale Screenpipe (`LICENSE.md`) : modifier et compiler est permis pour « Evaluation, development, and testing for up to seven (7) days » et pour un usage non commercial ou éducatif. Interdit sans licence commerciale : distribuer dans un produit commercial, l'offrir en service hébergé. Une machine cloud peut **compiler** ; **faire tourner** l'app sur une machine non rattachée à un utilisateur licencié demande un accord commercial (§3). Les modifications appartiennent à Screenpipe (§6).
