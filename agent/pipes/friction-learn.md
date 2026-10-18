---
schedule: manual
enabled: true
title: friction-assist, apprentissage
description: Régénère et valide le détecteur de friction-assist après la collecte (approbation humaine requise)
agent: pi
model: claude-haiku-4-5
timeout: 1800
history: false
trigger:
  events:
    - pipe_completed:friction-collect
permissions:
  allow:
    - Api(POST /offline/learn)
---

Run exactly this command once, then report its JSON output in one line. Do nothing else.

```bash
curl -s -X POST http://127.0.0.1:{{PORT}}/offline/learn -H "X-Friction-Token: {{TOKEN}}"
```
