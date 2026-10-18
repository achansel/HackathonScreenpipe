// Dashboard web : ébauche et démo (pages locales), à côté du produit (l'agent et les Live Views Screenpipe).
//
//   bun teamstore/dashboard/serve.ts            démo : les 5 collègues de PipingTable simulés sur cette machine
//   bun teamstore/dashboard/serve.ts moi        mon poste : avec mes vrais collègues
//   bun teamstore/dashboard/serve.ts moi --heberger     … et cette machine sert de stockage à l'équipe (même réseau)
//   bun teamstore/dashboard/serve.ts moi --serveur http://192.168.1.20:3001     … stockage hébergé par un collègue
//   options : --alerte 60 (secondes avant d'alerter la responsable d'une demande en attente ; 120 par défaut)
//   options : --crisp (« moi » : la lecture de Crisp déclenche les frictions ; pas en même temps que l'agent)
//   options : --supabase (démo sur le Supabase configuré), --local, --port 4323, --sans-navigateur
//
// Stockage, par ordre de priorité : --serveur, puis FRICTION_TEAMSTORE_URL (environnement ou
// ~/.config/friction-assist/team.env, le même fichier que l'agent), sinon un stockage local sur cette machine.
// Les outils en ligne de commande (verifier, nuit, equipe-demo) sont dans teamstore/cli.ts.
import { existsSync, readFileSync } from "node:fs";
import { homedir, networkInterfaces, platform } from "node:os";
import { join } from "node:path";
import { startPage } from "./server";
import { LocalTeamServer } from "../local-server";
import { snapshot } from "./regie";
import { AccessDenied, apiKeyHeaders, membershipFromInvite, SupabaseStore, Team, type Membership } from "../client";


const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const VALUED = ["--serveur", "--port", "--escalade", "--alerte"];
const mode = argv.find((a, i) => !a.startsWith("--") && !VALUED.includes(argv[i - 1])) ?? "demo";
const PAGE_PORT = Number(opt("--port") ?? Bun.env.DEMO_PORT ?? 4322);
const LOCAL_PORT = Number(Bun.env.TEAMSTORE_LOCAL_PORT ?? 3001);

if (!["demo", "moi", "aide"].includes(mode) || flag("--help") || flag("-h") || mode === "aide") {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).slice(0, 13).map((l) => l.slice(3)).join("\n"));
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
// Jeton Screenpipe (pour reconnaître une étape avec l'IA de Screenpipe, et pour la carte) : lu, jamais affiché.
const SP_ENV = join(homedir(), ".config", "screenpipe", "env");
if (existsSync(SP_ENV)) for (const line of readFileSync(SP_ENV, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?(SCREENPIPE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
const envUrl = Bun.env.FRICTION_TEAMSTORE_URL ?? fileEnv.FRICTION_TEAMSTORE_URL ?? "";
const anonKey = Bun.env.FRICTION_TEAMSTORE_ANON_KEY ?? fileEnv.FRICTION_TEAMSTORE_ANON_KEY ?? "";
// La démo reste locale (remise à zéro possible) sauf --supabase ; « moi » et « verifier » prennent le stockage configuré.
const remote = opt("--serveur") ?? ((mode !== "demo" || flag("--supabase")) && !flag("--local") && !flag("--heberger") ? envUrl : "");
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

// ---- quelle solution répond à une étape formulée autrement (le démon d'Andrea écrit l'étape avec l'IA) :
// le matchStep d'Andrea (agent/qualify.ts, importé tel quel), sinon des mots en commun.
const words = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9%]+/).filter((w) => w.length > 3));
function overlapMatch(step: string, catalogue: { id: string; step: string }[]) {
  const a = words(step);
  const scored = catalogue.map((c) => { const b = words(c.step); const inter = [...a].filter((w) => b.has(w)).length; return { id: c.id, score: inter / Math.max(1, Math.min(a.size, b.size)) }; });
  const best = scored.sort((x, y) => y.score - x.score)[0];
  return best && best.score >= 0.5 ? best.id : null;
}
async function matchSolution(step: string, catalogue: { id: string; step: string }[]) {
  if (!catalogue.length) return null;
  const exact = catalogue.find((c) => c.step === step);
  if (exact) return exact.id;
  if (process.env.SCREENPIPE_API_KEY) {
    try { const { matchStep } = await import("../../agent/qualify"); return await matchStep(step, catalogue as any); }
    catch { /* IA indisponible : repli */ }
  }
  return overlapMatch(step, catalogue);
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

// Escalade vers Slack (aide « 💬 » de Minguk) : canaux du Slack PipingTable, surchargeables par les variables
// de Minguk (DEMO_SLACK_SUPPORT_URL, DEMO_SLACK_CHANNEL_URL = #bugs…). Ce sont des adresses, pas des secrets.
const WORKSPACE = "https://app.slack.com/client/T0CAR1HU95W";
Object.assign(store, {
  slack: {
    support: Bun.env.DEMO_SLACK_SUPPORT_URL ?? `${WORKSPACE}/C0C9ZBHECDU`,
    bugs: Bun.env.DEMO_SLACK_CHANNEL_URL ?? `${WORKSPACE}/C0CAVM9DR7A`,
    dealDesk: Bun.env.DEMO_SLACK_DEALDESK_URL ?? WORKSPACE,
    newLeads: Bun.env.DEMO_SLACK_NEWLEADS_URL ?? WORKSPACE,
  },
  escaladeSeconds: Number(opt("--escalade") ?? 120),
  crisp: flag("--crisp"),
  liveView: Boolean(process.env.SCREENPIPE_API_KEY),
  alerteSeconds: Number(opt("--alerte") ?? 120),
});

// ---- Live View « Frictions en direct » dans Screenpipe : modèle installé une fois, blocs remplis par la page
// (les chiffres sont calculés dans le navigateur, à partir des blocs déchiffrés ; ce serveur ne voit pas de clé).
let liveInstalled = false;
async function publishLive(blocks: Record<string, unknown>) {
  const api = process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
  const auth = { Authorization: `Bearer ${process.env.SCREENPIPE_API_KEY}`, "Content-Type": "application/json" };
  try {
    if (!liveInstalled) {
      const now = new Date().toISOString();
      const tpl = { ...JSON.parse(readFileSync(join(import.meta.dir, "friction-live.liveview.json"), "utf8")), createdAt: now, updatedAt: now };
      const r = await fetch(`${api}/live-views/${tpl.id}`, { method: "PUT", headers: auth, body: JSON.stringify(tpl) });
      if (!r.ok) return { ok: false, error: `installation de la Live View : HTTP ${r.status}` };
      liveInstalled = true;
    }
    const r = await fetch(`${api}/outputs/targets?pipe=friction-live`, { headers: auth });
    const targets = ((await r.json()).data ?? []) as { id: string; revision: number }[];
    const done: string[] = [];
    for (const t of targets) {
      const block = t.id.split(":").at(-1)!;
      if (!(block in blocks)) continue;
      const s = await fetch(`${api}/outputs/targets/${encodeURIComponent(t.id)}/submit`, { method: "POST", headers: auth, body: JSON.stringify({ target_revision: t.revision, source_pipe: "friction-live", payload: blocks[block] }) });
      if (s.ok) done.push(block); else return { ok: false, error: `${block} : HTTP ${s.status} ${(await s.text()).slice(0, 160)}` };
    }
    return { ok: true, blocks: done };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
const shared = Boolean(remote) || flag("--heberger");
let page: Awaited<ReturnType<typeof startPage>>;
try {
  page = await startPage({
    port: PAGE_PORT,
    store,
    operator: local ? () => local!.operatorView() : undefined,
    reset: local && !shared ? () => local!.reset() : undefined,
    // En mode démo (stockage local), « Mon poste » reste sur le stockage de l'équipe s'il est configuré.
    storeMoi: !remote && envUrl && !flag("--heberger") && !flag("--local") ? { url: envUrl, anonKey, restPath, label: envUrl.includes("supabase.co") ? `Supabase (${new URL(envUrl).host})` : envUrl } : undefined,
    match: matchSolution,
    live: process.env.SCREENPIPE_API_KEY ? publishLive : undefined,
    // Boucle de nuit pour le parcours : le jugement par la vraie IA de Screenpipe (rien n'est publié ici).
    night: process.env.SCREENPIPE_API_KEY ? async (cases) => {
      const nuit = await import("../nuit");
      const { chat } = await import("../../agent/screenpipe");
      const { redact } = await import("../../agent/qualify");
      return Promise.all(cases.map((c) => nuit.judge({ ...c, at: Date.now() }, chat, redact)));
    } : undefined,
    // Régie de répétition : toujours sur le stockage de l'équipe configuré (team.env), comme le démon.
    regie: (since, publish) => snapshot({ since, storeUrl: envUrl, anonKey, crisp: flag("--crisp"), live: process.env.SCREENPIPE_API_KEY ? publishLive : undefined, publish }),
  });
} catch {
  console.error(`Le port ${PAGE_PORT} est déjà pris : friction-assist est sans doute déjà lancé. Ouvrir http://127.0.0.1:${PAGE_PORT}${mode === "moi" ? "/moi" : "/"} ou fermer l'autre fenêtre.`);
  process.exit(1);
}

// Détection Crisp de Minguk (integrations/src/detect/crisp-watcher.ts, importée telle quelle) : chaque nouveau message
// client lu à l'écran via Screenpipe est poussé aux pages ouvertes, qui en font une friction.
if (flag("--crisp")) {
  if (!process.env.SCREENPIPE_API_KEY) { console.error("--crisp : jeton Screenpipe absent (scripts/screenpipe-env.sh)"); process.exit(1); }
  const { CrispWatcher } = await import("../../integrations/src/detect/crisp-watcher.ts");
  const watcher = new CrispWatcher({
    screenpipeUrl: process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030",
    apiKey: process.env.SCREENPIPE_API_KEY,
    onEvent: (event) => { page.broadcast({ type: "crisp", event }); if (event.kind === "message") console.log(`Crisp : message de ${event.name}`); },
  });
  setInterval(() => watcher.tick().catch((e) => console.error("Crisp :", (e as Error).message)), 1000);
}

const pageUrl = `http://127.0.0.1:${PAGE_PORT}${mode === "moi" ? "/moi" : "/"}`;
console.log(`\nfriction-assist : ${mode === "moi" ? "mon poste" : "accueil (parcours guidé, équipe simulée, mon poste)"}`);
console.log(`  page     : ${pageUrl}`);
console.log(`  stockage : ${store.label}`);
if (flag("--heberger")) {
  const ips = lanAddresses();
  console.log(`\nÀ donner aux collègues (même réseau) :`);
  for (const ip of ips) { const [addr, name] = ip.split("  "); console.log(`  bun teamstore/dashboard/serve.ts moi --serveur http://${addr}:${LOCAL_PORT}    ${name}`); }
  if (!ips.length) console.log("  (aucune adresse réseau trouvée : êtes-vous connecté ?)");
  console.log("  Si le système demande d'autoriser les connexions entrantes pour « bun », accepter.");
}
console.log("\nCtrl+C pour arrêter.");
if (flag("--crisp")) console.log("  Crisp    : détection de Minguk active (ouvrir Crisp dans Chrome)");
if (!flag("--sans-navigateur")) openBrowser(pageUrl);
