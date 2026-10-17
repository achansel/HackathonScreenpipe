// Tests de bout en bout du stockage d'équipe chiffré, contre un vrai Postgres + PostgREST (Docker),
// avec le même schéma que Supabase. Usage : ./local-db.sh up && bun test.ts
// Variables : TEAMSTORE_URL (défaut http://127.0.0.1:3001), TEAMSTORE_ANON_KEY, TEAMSTORE_REST_PATH ("" en local).
import { b64u, deriveTeamKeys, open, parseInvite, seal } from "./crypto";
import { AccessDenied, apiKeyHeaders, membershipFromInvite, routeTeams, SupabaseStore, Team } from "./client";

const URL_ = Bun.env.TEAMSTORE_URL ?? "http://127.0.0.1:3001";
const ANON = Bun.env.TEAMSTORE_ANON_KEY ?? "";
const REST = Bun.env.TEAMSTORE_REST_PATH ?? "";
const store = new SupabaseStore(URL_, ANON, REST);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`); };
const rejects = async (p: Promise<unknown>, cls?: Function) => { try { await p; return false; } catch (e) { return !cls || e instanceof cls; } };
const join = (link: string, scope?: string) => Team.open(store, membershipFromInvite(link, scope));

// 1. Deux équipes, chacune créée par son responsable, chacune avec son périmètre.
const support = await Team.create(store, "Support", "crisp|rembours|geste");
const ventes = await Team.create(store, "Ventes", "hubspot|remise|deal");
check("création de deux équipes", support.id !== ventes.id && support.isAdmin && ventes.isAdmin);

// 2. Invitations : la clé et la clé publique du responsable sont dans le fragment (#).
const inv = parseInvite(support.invite());
check("le lien porte la clé dans le fragment, pas dans l'adresse", support.invite().includes("#") && !support.invite().split("#")[0].includes(b64u.enc(inv.master)));
check("le lien porte la clé publique du responsable", inv.ownerPub.length > 20);
const lea = await join(support.invite(), support.m.scope);
const karimS = await join(support.invite(), support.m.scope);
const karimV = await join(ventes.invite(), ventes.m.scope);
const sam = await join(ventes.invite(), ventes.m.scope);
check("un membre invité n'a pas les droits du responsable", !lea.isAdmin && !lea.m.admin);
check("un lien abîmé est refusé", await rejects(Promise.resolve().then(() => membershipFromInvite(support.invite().slice(0, -60)))));

// 3. Léa publie une demande, Karim une solution ; Léa relit la solution en clair.
const solution = { id: "geste-commercial", step: "Crisp : un client demande un remboursement", title: "Geste commercial : 1 mois offert max", body: "Premium seulement.", owner: "support-ops", uses: 3 };
await lea.publish("request", { requestId: "r1", step: solution.step, type: "unclear" });
await karimS.publish("solution", { ...solution, requestId: "r1" });
const seen = await lea.pull();
check("un membre relit la solution en clair", seen.some((b) => b.kind === "solution" && b.data.body === solution.body));
check("aucun auteur dans ce qui revient du serveur", seen.every((b) => !("author" in b.data)));
check("filtre par type côté serveur", (await lea.pull(0, "request")).every((b) => b.kind === "request"));

// 4. Isolation : Ventes ne lit rien du Support, même avec son propre jeton valide.
const ventesToken = (await deriveTeamKeys(parseInvite(ventes.invite()).master)).accessToken;
check("une autre équipe ne peut pas lire le Support", await rejects(store.list(support.id, ventesToken, 0), AccessDenied));
check("un faux jeton est refusé à l'écriture", await rejects(store.put(support.id, "faux-jeton", "solution", 1, "x"), AccessDenied));
check("Sam (Ventes) ne voit rien de la demande de Léa", (await sam.pull()).length === 0);

// 5. Routage multi-équipes : Karim est dans les deux équipes.
const karimTeams = [karimS, karimV];
check("une étape Crisp ne part qu'au Support", routeTeams(karimTeams, "Crisp : remboursement").map((t) => t.name).join() === "Support");
check("une étape HubSpot ne part qu'aux Ventes", routeTeams(karimTeams, "HubSpot : remise > 15 %").map((t) => t.name).join() === "Ventes");
check("une étape hors périmètre ne sort pas de la machine", routeTeams(karimTeams, "Notion : page introuvable").length === 0);

// 6. Le serveur ne voit que du chiffré, de taille arrondie.
const supportKeys = await deriveTeamKeys(inv.master);
const rows = await store.list(support.id, supportKeys.accessToken, 0);
check("le serveur ne stocke aucun texte en clair", rows.every((r) => !r.ciphertext.includes("Premium") && !r.ciphertext.includes("Crisp")));
check("les blobs ont tous la même taille (rembourrage)", new Set(rows.map((r) => r.ciphertext.length)).size === 1, `${rows[0]?.ciphertext.length} caractères`);

// 7. Données associées : un blob déplacé d'équipe ou de type ne se déchiffre plus.
const sealed = await seal(supportKeys, { teamId: support.id, kind: "request", epoch: 1 }, { x: 1 });
check("un blob « demande » ne passe pas pour une « solution »", await rejects(open(supportKeys, { teamId: support.id, kind: "solution", epoch: 1 }, sealed)));
check("un blob ne se rejoue pas dans une autre équipe", await rejects(open(supportKeys, { teamId: ventes.id, kind: "request", epoch: 1 }, sealed)));
const tampered = b64u.dec(sealed); tampered[40] ^= 1;
check("un blob modifié est rejeté", await rejects(open(supportKeys, { teamId: support.id, kind: "request", epoch: 1 }, b64u.enc(tampered))));

// 8. Certification : seul le responsable signe ; un membre ne peut ni forger, ni modifier une règle certifiée.
await support.publish("solution", await support.certify(solution));
const certified = (await lea.pull(0, "solution")).filter((b) => b.data.certified);
check("une solution signée par la responsable est reconnue certifiée", certified.length === 1);
check("un membre ne peut pas certifier", await rejects(lea.certify(solution)));
const forged = { ...certified[0].data, body: "Remboursement intégral sans validation", cert: certified[0].data.cert };
await karimS.publish("solution", forged);
const last = (await lea.pull(0, "solution")).at(-1)!;
check("une règle certifiée modifiée par un membre perd sa certification", last.data.body === forged.body && last.data.certified === false);
const otherOwner = await ventes.certify(solution);
await karimS.publish("solution", otherOwner);
check("une signature d'un autre responsable ne vaut rien ici", (await lea.pull(0, "solution")).at(-1)!.data.certified === false);

// 9. Départ de Karim du Support : rotation, solutions republiées, ancien lien inutile.
const before = (await support.pull(0, "solution")).length;
const r = await support.rotate();
check("rotation : nouvelle époque", support.epoch === 2);
check("rotation : solutions republiées sous la nouvelle clé", r.republished === before, `${r.republished} republiée(s)`);
check("rotation : l'ancien membre ne lit plus rien", await rejects(karimS.pull(), AccessDenied));
check("rotation : l'ancien membre ne peut plus écrire", await rejects(karimS.publish("solution", { x: 1 }), AccessDenied));
check("rotation : Léa avec l'ancien lien est aussi bloquée, jusqu'au nouveau lien", await rejects(lea.pull(), AccessDenied));
const lea2 = await join(r.invite, support.m.scope);
const after = await lea2.pull(0, "solution");
check("rotation : Léa réinvitée retrouve les solutions", after.length === before);
check("rotation : la certification survit à la rotation", after.some((b) => b.data.certified));
check("rotation : la demande du jour n'est pas republiée", (await lea2.pull(0, "request")).length === 0);
const oldBlob = await seal(supportKeys, { teamId: support.id, kind: "solution", epoch: 1 }, { x: 1 });
check("une écriture avec l'ancienne époque est refusée", await rejects(store.put(support.id, (await deriveTeamKeys(parseInvite(r.invite).master)).accessToken, "solution", 1, oldBlob)));
check("seul le responsable fait tourner la clé", await rejects(lea2.rotate()) && await rejects(store.rotate(support.id, "pas-admin", "0".repeat(64)), AccessDenied));

// 10. Purge par la responsable d'une solution fausse.
const wrong = await support.publish("solution", { id: "faux", step: "x", title: "faux", body: "faux" });
check("la responsable retire une solution fausse", await support.purge(wrong) && !(await lea2.pull(0, "solution")).some((b) => b.data.id === "faux"));
check("un membre ne peut pas purger", await rejects(lea2.purge(1)));

// 11. Le schéma refuse un type inconnu et un blob trop gros.
const tok2 = (await deriveTeamKeys(parseInvite(r.invite).master)).accessToken;
check("type de blob inconnu refusé", await rejects(store.put(support.id, tok2, "secret" as any, 2, "x")));
check("blob trop gros refusé", await rejects(store.put(support.id, tok2, "solution", 2, "x".repeat(30000))));

// 12. La clé publique ne donne aucun accès direct aux tables.
const direct = async (path: string, init?: RequestInit) => {
  const h: Record<string, string> = { "Content-Type": "application/json", ...apiKeyHeaders(ANON) };
  return (await fetch(`${URL_}${REST}${path}`, { ...init, headers: h })).status;
};
const codes = [await direct("/blobs?select=*"), await direct("/teams?select=*"), await direct("/blobs", { method: "POST", body: "{}" }), await direct("/rpc/_hash", { method: "POST", body: '{"p_token":"x"}' })];
check("lecture/écriture directe des tables et fonctions internes refusées", codes.every((c) => c === 401 || c === 403 || c === 404), codes.join(", "));

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
