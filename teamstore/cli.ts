// Outils du stockage d'équipe (Mac, Windows, Linux/WSL). Voir teamstore/README.md.
//
//   bun teamstore/cli.ts verifier           vérifie le stockage configuré (Supabase, ou le serveur local)
//   bun teamstore/cli.ts nuit [--exemple [--cas dédommagement]] [--depuis 14:30] [--lien "<lien>"] [--sans-publier]   boucle de nuit
//   bun teamstore/cli.ts equipe-demo        prépare les postes simulés du démon (Léa, Karim) sur ce stockage
//
// Stockage, par ordre de priorité : --serveur <url>, puis FRICTION_TEAMSTORE_URL (environnement ou
// ~/.config/friction-assist/team.env, le même fichier que le démon), sinon le serveur local
// (bun teamstore/server/local-server.ts, port 3001).
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AccessDenied, apiKeyHeaders, membershipFromInvite, SupabaseStore, Team, type Membership } from "./client";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const VALUED = ["--serveur", "--lien", "--depuis", "--cas"];
const mode = argv.find((a, i) => !a.startsWith("--") && !VALUED.includes(argv[i - 1])) ?? "aide";
const LOCAL_PORT = Number(Bun.env.TEAMSTORE_LOCAL_PORT ?? 3001);

if (!["verifier", "equipe-demo", "nuit"].includes(mode) || flag("--help") || flag("-h")) {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).slice(0, 9).map((l) => l.slice(3)).join("\n"));
  process.exit(mode === "aide" || flag("--help") || flag("-h") ? 0 : 1);
}

// ---- configuration du stockage
const TEAM_ENV = join(homedir(), ".config", "friction-assist", "team.env");
function readTeamEnv(): Record<string, string> {
  if (!existsSync(TEAM_ENV)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(TEAM_ENV, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}
const fileEnv = readTeamEnv();
// Jeton Screenpipe (boucle de nuit : recherche et IA de Screenpipe) : lu, jamais affiché.
const SP_ENV = join(homedir(), ".config", "screenpipe", "env");
if (existsSync(SP_ENV)) for (const line of readFileSync(SP_ENV, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?(SCREENPIPE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
const envUrl = Bun.env.FRICTION_TEAMSTORE_URL ?? fileEnv.FRICTION_TEAMSTORE_URL ?? "";
const anonKey = Bun.env.FRICTION_TEAMSTORE_ANON_KEY ?? fileEnv.FRICTION_TEAMSTORE_ANON_KEY ?? "";
const remote = opt("--serveur") ?? envUrl;
const restPath = "/rest/v1"; // Supabase, et accepté aussi par le serveur local
const url = remote || `http://127.0.0.1:${LOCAL_PORT}`;
const TEAMS_DIR = join(homedir(), ".config", "friction-assist");

// ---- vérification d'un stockage (après avoir collé schema.sql dans Supabase, par exemple)
if (mode === "verifier") {
  console.log(`Stockage vérifié : ${url}`);
  const store = new SupabaseStore(url, anonKey, restPath);
  const ok = (b: boolean, s: string) => console.log(`${b ? "✅" : "❌"} ${s}`);
  try {
    const t = await Team.create(store, "verification");
    await t.publish("solution", { id: "x", step: "vérification", title: "ok", body: "ok" });
    ok((await t.pull()).length === 1, "créer une équipe, écrire, relire en clair");
    const blocked = await fetch(`${url}${restPath}/blobs?select=*`, { headers: apiKeyHeaders(anonKey) });
    ok(blocked.status === 401 || blocked.status === 403 || blocked.status === 404, `lecture directe des tables refusée (HTTP ${blocked.status})`);
    ok(await store.put(t.id, "faux", "solution", 1, "x").then(() => false, (e) => e instanceof AccessDenied), "faux jeton refusé");
    await t.rotate();
    ok(t.epoch === 2, "changement de clé");
    ok(await t.destroy(), "suppression de l'équipe de vérification");
    console.log("Le stockage est prêt pour l'équipe.");
  } catch (e) {
    ok(false, (e as Error).message);
    console.log("Supabase : le schéma est-il installé (teamstore/server/schema.sql dans l'éditeur SQL) ? L'URL et la clé anon sont-elles bonnes ? Serveur local : est-il lancé (bun teamstore/server/local-server.ts) ?");
    process.exit(1);
  }
  process.exit(0);
}

// ---- boucle de nuit (teamstore/nuit/) : relire ce qui a suivi chaque friction restée sans réponse, et proposer
// des règles à la responsable. --exemple : l'exemple préparé (fils du Slack de PipingTable), jugé par la vraie IA.
if (mode === "nuit") {
  if (!process.env.SCREENPIPE_API_KEY) { console.error("Jeton Screenpipe absent : scripts/screenpipe-env.sh"); process.exit(1); }
  const nuit = await import("./nuit");
  const { chat, search } = await import("../agent/screenpipe");
  const { redact } = await import("../agent/qualify");
  const { SCOPE } = await import("../agent/config");
  let cases: import("./nuit").NightCase[];
  if (flag("--exemple")) cases = opt("--cas") ? nuit.EXEMPLE.filter((c) => c.label?.includes(opt("--cas")!)) : nuit.EXEMPLE;
  else {
    // Lire l'historique de l'écran exige le consentement donné au démon (agent/main.ts activer).
    if (!existsSync(join(import.meta.dir, "..", "agent", ".state", "consent.json"))) {
      console.error("Pas de consentement sur ce poste (bun agent/main.ts activer). Pour l'exemple préparé : --exemple");
      process.exit(1);
    }
    const d = opt("--depuis");
    const since = d ? new Date(`${new Date().toISOString().slice(0, 10)}T${d.padStart(5, "0")}:00`).getTime() : Date.now() - 24 * 3_600_000;
    const day = nuit.dayCases(join(import.meta.dir, ".."), since);
    console.log(`${day.length} friction(s) sans réponse depuis ${new Date(since).toLocaleString("fr-FR")}.`);
    cases = [];
    for (const c of day) cases.push({ ...c, context: await nuit.contextAfter(c.at, search, SCOPE) });
  }
  const findings: import("./nuit").Finding[] = [];
  for (const c of cases) {
    const f = await nuit.judge(c, chat, redact);
    findings.push(f);
    console.log(f.resolved ? `✓ résolue  · ${c.label ?? c.step} → « ${f.title} » (${f.how}, confiance ${f.confidence})` : `… en attente · ${c.label ?? c.step} (confiance ${f.confidence})`);
  }
  if (flag("--sans-publier")) process.exit(0);
  const store = new SupabaseStore(url, anonKey, restPath);
  const list: Membership[] = opt("--lien") ? [membershipFromInvite(opt("--lien")!)]
    : existsSync(join(TEAMS_DIR, "teams.json")) ? JSON.parse(readFileSync(join(TEAMS_DIR, "teams.json"), "utf8")) : [];
  if (!list.length) { console.error('Aucune équipe pour publier : --lien "<lien>" ou equipe-rejoindre côté démon. (--sans-publier pour seulement voir)'); process.exit(1); }
  const teams = await Promise.all(list.map((m) => Team.open(store, m)));
  try {
    const r = await nuit.publish(findings, teams);
    console.log(`Publié dans ${teams.map((t) => t.name).join(", ")} : ${r.proposals} proposition(s) à valider, ${r.pending} friction(s) en attente. Le démon de la responsable les lui notifie ([Certifier]).`);
  } catch (e) {
    console.error(`Publication impossible : ${(e as Error).message}`);
    if (/check constraint|blobs_kind_check/.test((e as Error).message)) console.error("Le stockage ne connaît pas encore les propositions : coller teamstore/server/migrations/2026-10-17-boucle-de-nuit.sql dans l'éditeur SQL de Supabase.");
    process.exit(1);
  }
  process.exit(0);
}

// ---- postes simulés du démon (« simuler » : Léa et Karim) branchés sur ce stockage :
// on écrit les fichiers d'équipe que le démon lit (teams-lea.json, teams-karim.json).
if (mode === "equipe-demo") {
  if (!remote) console.log("Pas de Supabase configuré : l'équipe est créée sur le serveur local (bun teamstore/server/local-server.ts doit tourner).");
  const t = await Team.create(new SupabaseStore(url, anonKey, restPath), "Support");
  const member = membershipFromInvite(t.invite());
  mkdirSync(TEAMS_DIR, { recursive: true });
  for (const [who, m] of [["karim", t.m], ["lea", member]] as const) {
    const f = join(TEAMS_DIR, `teams-${who}.json`);
    if (existsSync(f)) console.log(`(remplacé : ${f})`);
    writeFileSync(f, JSON.stringify([m], null, 2), { mode: 0o600 });
    chmodSync(f, 0o600);
  }
  console.log(`Équipe « Support » créée sur ${url} : Karim en est responsable, Léa membre.
Lien pour qu'un autre poste (un vrai démon) rejoigne la même équipe, à garder privé :
${t.invite()}

Lancer la simulation :
  source ~/.config/screenpipe/env && source ~/.config/friction-assist/team.env
  FRICTION_REQUEST_JITTER=0 bun agent/main.ts simuler
  bun agent/main.ts injecter lea "Quelqu'un sait si on peut offrir un geste commercial à un client premium ?"`);
  process.exit(0);
}
