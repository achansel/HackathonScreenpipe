# dashboard : ébauche et démo

Pages web locales écrites pendant le hackathon pour voir le système de bout en bout sans Screenpipe sous la main. Ce n'est pas le produit : le produit, c'est l'agent et les Live Views Screenpipe. Gardé pour illustrer (vidéos, pitch) et comme ébauche d'une interface responsable.

```bash
bun teamstore/dashboard/serve.ts            # http://127.0.0.1:4322, stockage local SQLite
bun teamstore/dashboard/serve.ts moi        # « Mon poste » sur le stockage de team.env
```

| Page | Contenu |
| --- | --- |
| `/parcours` | La journée de Léa en 8 chapitres, mise en scène (écran, agent, équipe, ce que voit le serveur). Vraies équipes chiffrées en dessous ; le chapitre « La nuit » appelle le vrai modèle si Screenpipe est joignable. « Mode présentation » clique seul. |
| `/equipe` | 5 collègues côte à côte, scénario en 10 boutons, attaques (faux jeton, membre retiré). |
| `/moi` | Rejoindre une équipe, bloquer, partager, certifier/modifier/rejeter les propositions de la nuit. |
| `/repetition` | Régie : coche les étapes du déroulé quand les vraies notifications arrivent. |

Le chiffrement se fait dans le navigateur (`app.ts`) ; `server.ts` sert les fichiers et relaie les notifications, il ne voit jamais de clé. `--crisp` lance une lecture de Crisp dans la page : ne pas l'utiliser en même temps que l'agent (deux lecteurs, deux frictions pour un message).
