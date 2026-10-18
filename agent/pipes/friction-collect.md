---
schedule: every 24h
enabled: true
title: friction-assist, collecte
description: Collecte locale des épisodes du jour pour l'apprentissage de nuit de friction-assist
agent: pi
model: claude-haiku-4-5
timeout: 600
history: false
permissions:
  allow:
    - Api(POST /offline/collect)
---

Run exactly this command once, then report its JSON output in one line. Do nothing else.

```bash
curl -s -X POST http://127.0.0.1:{{PORT}}/offline/collect -H "X-Friction-Token: {{TOKEN}}"
```
