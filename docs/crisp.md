# Crisp : clients fictifs

Le chat Crisp s'ouvre par un lien direct, sans site web ; l'identité du client passe dans l'URL. Les messages arrivent dans la boîte de réception de l'espace de travail, côté agent.

- Website ID (identifiant public d'un chatbox, pas un secret) : `7dc5c68e-4cc3-4480-879d-15eee53f96e9`
- Base : `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9`

| Paramètre | Rôle |
| --- | --- |
| `user_nickname` | nom affiché |
| `user_email` | e-mail |
| `user_phone` | facultatif |
| `locale` | `fr` |

Valeurs encodées (`espace` → `%20`, `@` → `%40`, `+` → `%2B`), reliées par `&`.

## Règles

- Jamais une vraie personne : nom plausible, inventé.
- E-mail en `@example.com` (domaine réservé), sauf le cas « client introuvable » : la recherche de l'interface HubSpot découpe l'adresse, et le morceau `example` ramène tous les contacts de démo, donc « 0 résultat » est impossible avec `@example.com`. Pour ce cas, un domaine `.test` (réservé aussi) dont aucun morceau ne correspond à un nom, une entreprise ou une ville : `jd.resto75@resa-paris.test`.
- `locale=fr`.
- Un client par scénario ; s'il revient, exactement le même lien (même historique).
- Plan gratuit : 2 agents, ~100 profils.

## Générer un lien

```bash
bun -e 'const [n,e,p]=process.argv.slice(1);const q=new URLSearchParams({user_nickname:n,user_email:e,...(p&&{user_phone:p}),locale:"fr"});console.log("https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&"+q.toString().replaceAll("+","%20"))' "Jean Dupont" "jd.resto75@resa-paris.test"
```

## Clients de la démo

| Client | E-mail | Rôle |
| --- | --- | --- |
| Jean Dupont (Le Bistro, Paris) | `jd.resto75@resa-paris.test` | ouverture : « Ma page de réservation est en panne », introuvable dans HubSpot sous cet e-mail ; puis demande de dédommagement |
| Pieter Janssens (Bruxelles) | `pieter.janssens@example.com` | prospect belge, « Combien pour 3 restaurants ? », absent de HubSpot |
| Élodie Marchand (Maison Pivoine) | `elodie.marchand@example.com` | « Thomas m'avait promis l'installation gratuite » |

```
https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Jean%20Dupont&user_email=jd.resto75%40resa-paris.test&locale=fr
https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Pieter%20Janssens&user_email=pieter.janssens%40example.com&locale=fr
https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=%C3%89lodie%20Marchand&user_email=elodie.marchand%40example.com&locale=fr
```

Le simulateur (`cd integrations && bun run simulate --sans-aide`) envoie ces messages depuis une session vierge, sans ouvrir de lien.

Doc Crisp : [lien direct vers le chatbox](https://help.crisp.chat/en/article/how-to-create-and-customize-a-direct-link-to-your-crisp-chatbox-174pche/).
