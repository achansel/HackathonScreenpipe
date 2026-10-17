# Crisp : clients fictifs pour la démo

Le chat client de Crisp s'ouvre par un lien direct, sans site web. Un client fictif se crée en passant son identité dans l'URL. Les messages arrivent dans la boîte de réception de l'espace de travail, côté agent.

- **Website ID (à toujours utiliser) :** `7dc5c68e-4cc3-4480-879d-15eee53f96e9` (identifiant public d'un chatbox, pas un secret)
- **Base :** `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9`

## Paramètres

| Paramètre | Rôle |
| --- | --- |
| `user_nickname` | nom affiché du client |
| `user_email` | e-mail du client |
| `user_phone` | téléphone (facultatif) |
| `user_avatar` | URL encodée d'une image (facultatif) |
| `locale` | langue du chat : toujours `fr` |

Les paramètres sont reliés par `&`. **Chaque valeur est encodée** : espace → `%20`, `@` → `%40`, `+` → `%2B`. Aucun mot de passe ni donnée sensible dans l'URL.

## Règles pour un client fictif

- **E-mail en `@example.com` uniquement** (domaine réservé, n'existe pas) : aucun e-mail ne peut partir vers une vraie personne.
  - **Exception (17/10)** : Jean Dupont écrit avec `jd.resto75@resa-paris.test` (`.test` est aussi un domaine réservé). La recherche de l'interface HubSpot découpe l'adresse, et le morceau « example » ramène tous les contacts fictifs : avec une adresse en `@example.com`, le « 0 résultat » du cas d'ouverture est impossible (mesuré). Même règle pour les adresses de répétition de ce cas (`km.0412@zvk.test` pour Kenji Mori, `em.2207@qmx.test` pour Élodie Marchand, `lf.1903@wpx.test` pour Luc Fabre) : aucun morceau ne correspond à un nom, une entreprise ou une ville. Pas d'autre exception.
- **Jamais le nom ou l'adresse d'une vraie personne.** Un nom plausible, français, sans « test » ni « azerty ».
- **`locale=fr`** toujours.
- **Un client par scénario**, pour que l'historique de la boîte de réception reste cohérent. Si un client doit revenir, réutiliser exactement le même lien.
- **Pas de marqueur de mesure visible** (`ZZ-TEST-…`) dans une conversation destinée à la démo : réservé aux tests de capture.
- Plan gratuit : 2 agents et environ 100 profils clients au maximum.

## Générer un lien

Depuis la racine du dépôt (Bun) :

```bash
bun -e 'const [n,e,p]=process.argv.slice(1);const q=new URLSearchParams({user_nickname:n,user_email:e,...(p&&{user_phone:p}),locale:"fr"});console.log("https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&"+q.toString().replaceAll("+","%20"))' "Camille Martin" "camille.martin@example.com"
```

## Exemple

Camille Martin, cliente qui demande un remboursement (scénario de VISION.md) :

```
https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=Camille%20Martin&user_email=camille.martin%40example.com&locale=fr
```

## Clients prêts à l'emploi

| Client | E-mail | Scénario |
| --- | --- | --- |
| Camille Martin | `camille.martin@example.com` | remboursement d'une commande arrivée abîmée |

Ajouter ici chaque nouveau client avec son scénario.

Documentation Crisp : [lien direct vers le chatbox](https://help.crisp.chat/en/article/how-to-create-and-customize-a-direct-link-to-your-crisp-chatbox-174pche/)
