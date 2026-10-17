// Point d'entrée unique (Mac, Windows, Linux/WSL). Voir teamstore/README.md.
//
//   bun teamstore/start.ts                    démo : les 5 collègues de PipingTable simulés sur cette machine
//   bun teamstore/start.ts moi                mon poste : avec mes vrais collègues
//   bun teamstore/start.ts moi --heberger     … et cette machine sert de stockage à l'équipe (même réseau)
//   bun teamstore/start.ts moi --serveur http://192.168.1.20:3001     … stockage hébergé par un collègue
//   bun teamstore/start.ts verifier           vérifie le stockage configuré (Supabase ou autre)
//   options : --supabase (démo sur le Supabase configuré), --local, --port 4323, --sans-navigateur
//
// Stockage, par ordre de priorité : --serveur, puis FRICTION_TEAMSTORE_URL (environnement ou
// ~/.config/friction-assist/team.env, le même fichier que le démon), sinon un stockage local sur cette machine.
import { existsSync, readFileSync } from "node:fs";
import { homedir, networkInterfaces, platform } from "node:os";
import { join } from "node:path";
import { startPage } from "./demo/server";
import { LocalTeamServer } from "./local-server";
import { AccessDenied, apiKeyHeaders, SupabaseStore, Team } from "./client";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const mode = argv.find((a) => !a.startsWith("--") && a !== opt("--serveur") && a !== opt("--port")) ?? "demo";
const PAGE_PORT = Number(opt("--port") ?? Bun.env.DEMO_PORT ?? 4322);
const LOCAL_PORT = Number(Bun.env.TEAMSTORE_LOCAL_PORT ?? 3001);

if (!["demo", "moi", "verifier", "aide"].includes(mode) || flag("--help") || flag("-h") || mode === "aide") {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).slice(0, 11).map((l) => l.slice(3)).join("\n"));
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
const envUrl = Bun.env.FRICTION_TEAMSTORE_URL ?? fileEnv.FRICTION_TEAMSTORE_URL ?? "";
const anonKey = Bun.env.FRICTION_TEAMSTORE_ANON_KEY ?? fileEnv.FRICTION_TEAMSTORE_ANON_KEY ?? "";
// La démo reste locale (remise à zéro possible) sauf --supabase ; « moi » et « verifier » prennent le stockage configuré.
const remote = opt("--serveur") ?? ((mode !== "demo" || flag("--supabase")) && !flag("--local") ? envUrl : "");
const restPath = "/rest/v1"; // Supabase, et accepté aussi par le stockage local

// Adresses à donner aux collègues : Wi-Fi/Ethernet d'abord, sans les interfaces virtuelles (VPN, Docker, OrbStack…).
function lanAddresses() {
  const all = Object.entries(networkInterfaces()).flatMap(([name, list]) => (list ?? []).filter((i) => i.family === "IPv4" && !i.internal).map((i) => ({ name, address: i.address })));
  const real = all.filter((i) => !/^(utun|bridge|docker|veth|vmnet|vbox|br-|tun|tap|zt|tailscale|vEthernet)/i.test(i.name));
  return (real.length ? real : all).map((i) => `${i.address}  (${i.name})`);
}
function openBrowser(url: string) {
  const cmd = platform() === "darwin" ? ["open", url]
    : platform() === "win32" ? ["cmd", "/c", "start", "", url]
    : Bun.env.WSL_DISTRO_NAME ? ["cmd.exe", "/c", "start", "", url.replace(/&/g, "^&")]
    : ["xdg-open", url];
  try { Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }); } catch { /* pas de navigateur : l'adresse est affichée */ }
}
async function reachable(url: string) {
  try { const r = await fetch(`${url}${restPath}/rpc/list_blobs`, { method: "POST", headers: { "Content-Type": "application/json", ...apiKeyHeaders(anonKey) }, body: "{}", signal: AbortSignal.timeout(5000) }); return r.status; }
  catch { return 0; }
}

// ---- vérification d'un stockage (après avoir collé schema.sql dans Supabase, par exemple)
if (mode === "verifier") {
  const url = remote || `http://127.0.0.1:${LOCAL_PORT}`;
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
    console.log("Supabase : le schéma est-il installé (teamstore/schema.sql dans l'éditeur SQL) ? L'URL et la clé anon sont-elles bonnes ?");
    process.exit(1);
  }
  process.exit(0);
}

// ---- stockage : distant, ou local sur cette machine
let store: { url: string; anonKey: string; restPath: string; label: string };
let local: LocalTeamServer | null = null;
if (remote) {
  const status = await reachable(remote);
  if (!status) {
    console.error(`Stockage injoignable : ${remote}\n- serveur d'un collègue : est-il lancé avec --heberger ? êtes-vous sur le même réseau ? (certains wifi isolent les machines : utiliser Supabase)\n- Supabase : vérifier l'URL dans ${TEAM_ENV}`);
    process.exit(1);
  }
  store = { url: remote, anonKey, restPath, label: remote.includes("supabase.co") ? `Supabase (${new URL(remote).host})` : `stockage d'un collègue (${remote})` };
} else {
  const host = flag("--heberger") ? "0.0.0.0" : "127.0.0.1";
  const file = Bun.env.TEAMSTORE_LOCAL_DB ?? join(import.meta.dir, ".data", mode === "demo" && !flag("--heberger") ? "demo.sqlite" : "equipe.sqlite");
  local = new LocalTeamServer(file);
  try { local.serve(LOCAL_PORT, host); }
  catch {
    console.error(`Le port ${LOCAL_PORT} est déjà pris (une autre instance est sans doute lancée : la fermer, ou TEAMSTORE_LOCAL_PORT=3002).`);
    process.exit(1);
  }
  store = { url: `http://127.0.0.1:${LOCAL_PORT}`, anonKey: "", restPath, label: flag("--heberger") ? "stockage hébergé sur cette machine, partagé avec l'équipe" : "stockage local sur cette machine (SQLite, mêmes règles que Supabase)" };
}

const shared = Boolean(remote) || flag("--heberger");
try {
  await startPage({
    port: PAGE_PORT,
    store,
    operator: local ? () => local!.operatorView() : undefined,
    reset: local && !shared ? () => local!.reset() : undefined,
  });
} catch {
  console.error(`Le port ${PAGE_PORT} est déjà pris : friction-assist est sans doute déjà lancé. Ouvrir http://127.0.0.1:${PAGE_PORT}${mode === "moi" ? "/moi" : "/"} ou fermer l'autre fenêtre.`);
  process.exit(1);
}

const page = `http://127.0.0.1:${PAGE_PORT}${mode === "moi" ? "/moi" : "/"}`;
console.log(`\nfriction-assist : ${mode === "moi" ? "mon poste" : "démo PipingTable (5 collègues simulés)"}`);
console.log(`  page     : ${page}`);
console.log(`  stockage : ${store.label}`);
if (flag("--heberger")) {
  const ips = lanAddresses();
  console.log(`\nÀ donner aux collègues (même réseau) :`);
  for (const ip of ips) { const [addr, name] = ip.split("  "); console.log(`  bun teamstore/start.ts moi --serveur http://${addr}:${LOCAL_PORT}    ${name}`); }
  if (!ips.length) console.log("  (aucune adresse réseau trouvée : êtes-vous connecté ?)");
  console.log("  Si le système demande d'autoriser les connexions entrantes pour « bun », accepter.");
}
console.log("\nCtrl+C pour arrêter.");
if (!flag("--sans-navigateur")) openBrowser(page);
