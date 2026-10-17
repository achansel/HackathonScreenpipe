# Questions pour Louis / Ezra (Discord, prêt à coller)

Salut Louis, Ezra, on construit un agent d'aide aux frictions de process sur l'API locale de Screenpipe (notifications, Live View, pipes, passerelle IA). Quelques questions précises, avec ce qu'on a vu dans le code (`main` du 16/10) :

1. **Passerelle IA** : on appelle `POST localhost:3030/v1/chat/completions` (`model: claude-haiku-4-5`) depuis un programme local avec la clé de l'utilisateur. C'est un usage OK pour vous ? Quel quota sur l'accès Business hackathon ?
2. **Boutons `api` sur macOS** : le clic n'arrive pas (renvoyé au JS de l'overlay, « usually not mounted », `native_actions.rs:1131`). On a un correctif qui traite `api` en Rust avec la même règle de cible que `isLocalApiUrl`. Ça vous intéresse en PR ? Ou un type `callback` (POST local sans la clé) vous paraît mieux ?
3. **Mémoire d'équipe** : est-il prévu que des membres (pas seulement l'admin) écrivent dans une mémoire partagée (`screenpipe-team-memory`) ? Ça remplacerait notre stockage temporaire (blocs chiffrés côté client).
4. **Pipe « code »** : un pipe qui lance un programme en continu (pas un agent) est-il envisagé ? Aujourd'hui `agent` = `pi` ou `acp`.
5. **Bugs constatés (Windows, app 2.7.109, moteur 0.4.52)** :
   - panneau de notification parfois **vide** (fenêtre visible, au premier plan, rien de dessiné) après une relance de l'enregistrement ; `/notify` répond « sent » et le journal `shown_on_panel` ;
   - agent des pipes : `Failed to load extension … pi-subagents/index.js: toToolDeclaration is not a function` ;
   - `/search?filter_pii=1` ne masque rien chez nous (19 ms, noms en clair) : réglage à activer ?
   - `/ws/events` : aucun événement de texte d'écran (`ocr_result` / `ui_frame` ne sont plus émis) : voulu ?

Merci !
