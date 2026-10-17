# Fiche de démo : les notifications d'aide

> À garder ouverte pendant la répétition et le jour J. Le détail technique est dans [notification-plan.md](notification-plan.md).
> Toutes les commandes se lancent depuis `minguk/`.

## La veille (10 min, sur la machine de démo)

- [ ] Screenpipe lancé ; le jeton à jour : `../scripts/screenpipe-env.sh && source ~/.config/screenpipe/env`.
- [ ] `bun install`, puis `bun test` : tout est vert.
- [ ] Les vraies URL de démo exportées, sinon la démo ouvre seulement `app.hubspot.com` et `app.slack.com` :

```bash
export DEMO_HUBSPOT_RECORD_URL="https://app.hubspot.com/contacts/<portail>/record/0-1/<contact Jean Dupont>"
export DEMO_HUBSPOT_DEAL_URL="https://app.hubspot.com/contacts/<portail>/record/0-3/<contrat signé>"
export DEMO_SLACK_CHANNEL_URL="slack://channel?team=<T…>&id=<C… #bugs>"
export DEMO_SLACK_SUPPORT_URL="slack://channel?team=<T…>&id=<C… #support>"
```

- [ ] Une répétition complète avec `bun run demo --manual` (voir plus bas), en cliquant vraiment.

## 5 minutes avant

- [ ] Dans Screenpipe : **pas de pause**, **pas d'heures silencieuses**, notifications de pipes activées.
- [ ] `bun run demo:check` : tout doit être ✓, y compris « Une notification de test s'affiche ».
- [ ] Aucune autre démo en cours (le port 4517 doit être libre : `check-env` le vérifie).
- [ ] Chrome ouvert sur Crisp (la conversation de Jean Dupont), HubSpot et Slack connectés.

## Pendant la démo

```bash
bun run demo --manual
```

| Entrée n° | Ce qui apparaît | Ce qu'on fait devant le jury |
| --- | --- | --- |
| 1 | 💬 « Bug client → #bugs » | [1. Copier le message], [2. Ouvrir #bugs], coller dans Slack |
| 2 | 🧭 « Produits du contrat signé » | [Y aller] : HubSpot s'ouvre directement sur les produits |
| 3 | 📘 « Geste commercial : 1 mois offert max » | [Réponse client] puis coller dans Crisp ; [Copier la note] pour HubSpot |
| (option) | 👎 sur la 📘 | la 💬 « Demander à l'équipe → #support » apparaît d'elle-même |

Le terminal affiche chaque statut (`shown`, `clicked`, `helpful`, `unhelpful`…). C'est la preuve, en direct, que la boucle se ferme. `q` pour quitter.

## Si quelque chose ne va pas

| Symptôme | Cause probable | Que faire |
| --- | --- | --- |
| `suppressed (paused)` et ⚠ dans le terminal | notifications Screenpipe en pause ou en heures silencieuses | les réactiver, relancer `bun run demo --manual` |
| `suppressed (duplicate)` | deux lancements dans la même seconde | attendre 2 secondes, relancer |
| `suppressed (unreachable)` | Screenpipe fermé | le relancer, puis `bun run demo:check` |
| `Port 4517 indisponible` | une démo précédente tourne encore | la fermer (`q` ou Ctrl+C) ; sinon `FRICTION_REDIRECT_PORT=4518 bun run demo --manual` |
| [Y aller] ouvre une page « aide expirée » | la démo a été relancée : les anciens liens ne valent plus | utiliser la nouvelle notification |
| Les 👍/👎 n'ont pas d'effet | jeton absent (avertissement au lancement) | `source ~/.config/screenpipe/env`, relancer |

## Ce qui a été répété (17 octobre, Mac)

- Deux répétitions complètes de suite, sans accroc (`--manual`, les trois aides, un clic sur chaque [Y aller]), la 2e 12 s après la 1re, donc dans le filtre de répétition de Screenpipe.
- Le 👎 et l'escalade, testés avec un vrai `/feedback` le 16 octobre.
- **Pas encore fait :** la même chose sous Windows (WSL), et de vrais clics sur les 👍/👎 du panneau natif.
