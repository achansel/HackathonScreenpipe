// friction-assist : aide en direct quand on bloque sur une étape de process.
//
// Commandes (depuis la racine du dépôt, après `source ~/.config/screenpipe/env`
// et `source ~/.config/friction-assist/team.env`) :
//   bun andrea/daemon/main.ts activer        consentement explicite, à faire une fois
//   bun andrea/daemon/main.ts relais         instance de relais (clics des boutons → ce daemon)
//   bun andrea/daemon/main.ts equipe-init    base d'équipe + clé d'équipe (--cle <base64> pour rejoindre)
//   bun andrea/daemon/main.ts                lance le daemon (refuse sans consentement)
//   bun andrea/daemon/main.ts simuler        plusieurs daemons (Léa, Karim…) sur cette machine, sans lire l'écran
//   bun andrea/daemon/main.ts injecter lea "texte de l'épisode"
//   bun andrea/daemon/main.ts carte-installer | carte | peupler-demo | nettoyer-demo   carte d'équipe (Live View)
//   bun andrea/daemon/main.ts pause | reprendre | statut | test-notif | desactiver | retirer-relais
// Options : --debug affiche le texte des épisodes (sinon seules les métadonnées sont journalisées).
//
// Vie privée : rien ne lit l'écran sans `activer`, `pause` coupe tout, aucune mesure par personne,
// aucun texte d'écran sur disque ; le texte d'un épisode ne part que vers le modèle choisi dans
// Screenpipe (identifiants évidents masqués) ; l'équipe ne reçoit que des blocs chiffrés sans identité.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  DATABASE_URL, INSTANCE, KEY, LABEL, MIN_CONFIDENCE, NIGHTLY_HOUR, PIPE_NAME, POLL_MS, PORT, SIM,
  SKIP_CONFIDENCE, SOLUTION_COOLDOWN_MS, STATE_DIR, TEAM_DIR, TEAM_KEY_FILE, TEAM_POLL_MS,
} from "./config";
import { EpisodeBuilder, type Episode } from "./episodes";
import { qualify } from "./qualify";
import { feedbackSince, notify, relayUrl, removeRelay, ScreenpipeClosed, search, setupRelay } from "./screenpipe";
import { loadSolutions, saveSolutions, type Solution } from "./solutions";
import { publishMap, MAP_DEEPLINK } from "./map";
import { TeamSync } from "./team";
import { PostgresTeamStore, teamKey } from "./teamstore";
import { collect } from "../offline/collect";
import { approvedDetector } from "../offline/detector";
import { learn } from "../offline/learn";
import { offlineToken } from "../offline/token";

const CONSENT = `${STATE_DIR}consent.json`;
const PAUSED = `${STATE_DIR}paused`;
const EVENTS = `${STATE_DIR}events.jsonl`; // métadonnées seulement : épisode, solution, action, heure
const debug = process.argv.includes("--debug");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const cmd = args[0] ?? "run";

// Équipe simulée : un daemon par personne, chacun son port, son état et son relais.
const SIM_TEAM = [
  { name: "lea", port: 8788, seed: false }, // nouvelle : aucune solution
  { name: "karim", port: 8789, seed: true }, // ancien : connaît les règles
];

const hms = (t = Date.now()) => new Date(t).toLocaleTimeString("fr-FR");
const log = (...a: unknown[]) => console.log(`[${hms()}]${INSTANCE ? ` ${INSTANCE}` : ""}`, ...a);
const record = (e: Record<string, unknown>) => appendFileSync(EVENTS, JSON.stringify({ at: new Date().toISOString(), ...e }) + "\n");
function* readEvents() {
  if (!existsSync(EVENTS)) return;
  for (const line of readFileSync(EVENTS, "utf8").split("\n")) if (line) yield JSON.parse(line);
}

// ---- clics relayés : nonce émis par ce daemon → action. /notify est ouvert à tout programme.
const pending = new Map<string, { episode: string; at: number; handler: (action: string) => Promise<void> }>();
const register = (nonce: string, episode: string, handler: (action: string) => Promise<void>) =>
  pending.set(nonce, { episode, at: Date.now(), handler });

// ---- notification d'aide : titre = la réponse, pas d'emoji ni de « ! ».
// Retour visible d'emblée par nos propres boutons (sous Windows, les 👍/👎 de Screenpipe sont
// cachés dans le menu « … ») ; les deux clics arrivent au daemon par le relais.
function helpNotification(episode: string, s: Solution) {
  const helped = randomBytes(12).toString("hex");
  const notThis = randomBytes(12).toString("hex");
  const onClick = async (action: string) => {
    pending.delete(action === "helped" ? notThis : helped); // un seul retour par notification
    const rating = action === "helped" ? "up" : "down";
    s.score = (s.score ?? 0) + (rating === "up" ? 1 : -1);
    saveSolutions(solutions);
    record({ kind: "feedback", source: "bouton", rating, episode, solution: s.id });
    log(`retour « ${action} » sur ${s.id} (score ${s.score})`);
  };
  register(helped, episode, onClick);
  register(notThis, episode, onClick);
  const actions: Record<string, unknown>[] = [
    { id: "helped", label: "Ça m'a aidé", type: "api", url: relayUrl, method: "POST", primary: true,
      body: { action: "helped", episode, nonce: helped } },
    { id: "not-this", label: "Pas ça", type: "api", url: relayUrl, method: "POST",
      body: { action: "not-this", episode, nonce: notThis } },
  ];
  if (s.copy) actions.push({ id: "copy", label: "Copier", type: "copy", value: s.copy });
  return {
    id: `fa-${episode}`,
    title: `${LABEL}${s.title}`,
    body: `${s.body}\nRéglé ${s.uses} fois dans l'équipe.`,
    pipe_name: PIPE_NAME,
    priority: "normal",
    timeout: 60_000,
    actions,
  };
}

// ---- traitement d'un épisode (direct ou injecté en simulation)
const solutions = loadSolutions();
const lastShown = new Map<string, number>();
const stats = { skipped: 0, qualified: 0 };
let team: TeamSync | null = null;
let teamStore: PostgresTeamStore | null = null;

async function handleEpisode(ep: Episode) {
  // Filtre appris hors ligne : écarte le travail normal sans appel au modèle.
  const detector = approvedDetector();
  if (detector) {
    const d = detector(ep);
    if (!d.friction && d.confidence >= SKIP_CONFIDENCE) { stats.skipped++; return { skipped: true }; }
  }
  stats.qualified++;
  const v = await qualify(ep, solutions);
  if (debug) log("épisode", { app: ep.app, window: ep.window, titles: ep.titles, text: ep.text, verdict: v });
  else log(`épisode ${ep.app} → ${v ? `${v.detour} (${v.type}/${v.control}) solution=${v.solution_id ?? "aucune"} conf=${v.confiance}` : "non qualifié"}`);
  if (!v?.friction || v.confiance < MIN_CONFIDENCE) return { verdict: v };
  if (team) await team.sign(v);
  if (v.solution_id) {
    if (Date.now() - (lastShown.get(v.solution_id) ?? 0) < SOLUTION_COOLDOWN_MS) return { verdict: v, cooldown: true };
    const s = solutions.find((x) => x.id === v.solution_id)!;
    const message = await notify(helpNotification(ep.id, s));
    lastShown.set(s.id, Date.now());
    record({ kind: "shown", episode: ep.id, solution: s.id, detour: v.detour, type: v.type, control: v.control, message });
    log(`notification « ${s.title} » : ${message}`);
    return { verdict: v, notified: s.id };
  }
  if (team) {
    const requestId = await team.ask(v);
    if (requestId) { record({ kind: "asked", episode: ep.id, requestId, detour: v.detour, step: v.step }); log(`aucune solution locale : demande anonyme (« ${v.step} »)`); }
    return { verdict: v, asked: Boolean(requestId) };
  }
  return { verdict: v };
}

// ---- serveur local : clics relayés, traitement de nuit, injection en simulation
function startServer() {
  Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/health") return new Response("ok");
      if ((path === "/offline/collect" || path === "/offline/learn") && req.method === "POST") {
        if (req.headers.get("x-friction-token") !== offlineToken()) return new Response("forbidden", { status: 403 });
        try {
          const result = path.endsWith("collect") ? await collect() : await learn();
          record({ kind: path.slice(1) });
          if (path.endsWith("learn") && (result as any).better)
            await notify({ id: `fa-learn-${Date.now()}`, title: "Nouveau détecteur prêt", body: "Il a passé la porte de validation. Relire `rapport`, puis `approuver`.", pipe_name: PIPE_NAME, timeout: 0 });
          return Response.json(result);
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      }
      if (SIM && path === "/sim/episode" && req.method === "POST") {
        const b = (await req.json().catch(() => ({}))) as Partial<Episode>;
        const ep: Episode = { id: `sim${Date.now().toString(36)}`, app: b.app ?? "Slack.exe", window: b.window ?? "", titles: b.titles ?? [], text: b.text ?? "", at: Date.now() };
        return Response.json(await handleEpisode(ep));
      }
      if (path !== "/hook" || req.method !== "POST") return new Response("not found", { status: 404 });
      const body = (await req.json().catch(() => ({}))) as Record<string, string>;
      const p = pending.get(body.nonce ?? "");
      if (!p || p.episode !== body.episode) return new Response("unknown nonce", { status: 403 });
      pending.delete(body.nonce);
      await p.handler(String(body.action ?? ""));
      return new Response("ok");
    },
  });
}

// ---- 👍/👎 natifs de Screenpipe → score local des solutions
let feedbackCursor = new Date().toISOString();
async function pollFeedback() {
  for (const r of await feedbackSince(feedbackCursor)) {
    feedbackCursor = r.updated_at ?? r.created_at ?? feedbackCursor;
    const id = String(r.target?.id ?? "");
    if (r.producer_ref !== `pipe:${PIPE_NAME}` || !id.startsWith("fa-")) continue;
    const last = [...readEvents()].reverse().find((e) => e.kind === "shown" && `fa-${e.episode}` === id);
    const s = solutions.find((x) => x.id === last?.solution);
    if (!s) continue;
    s.score = (s.score ?? 0) + (r.rating === "up" ? 1 : -1);
    saveSolutions(solutions);
    record({ kind: "feedback", rating: r.rating, solution: s.id, episode: last?.episode });
    log(`retour ${r.rating} sur ${s.id} (score ${s.score})`);
  }
}

// ---- repli du traitement de nuit : si nos pipes n'ont pas tourné aujourd'hui, le daemon s'en charge
async function nightlyFallback() {
  const now = new Date();
  if (SIM || now.getHours() !== NIGHTLY_HOUR) return;
  const today = now.toISOString().slice(0, 10);
  if ([...readEvents()].some((e) => e.kind === "offline/learn" && String(e.at).startsWith(today))) return;
  log("traitement de nuit (repli) : collecte puis apprentissage");
  const c = await collect();
  const r = await learn();
  record({ kind: "offline/learn", fallback: true, added: c.added, better: r.better });
  if (r.better) await notify({ id: `fa-learn-${Date.now()}`, title: "Nouveau détecteur prêt", body: "Il a passé la porte de validation. Relire `rapport`, puis `approuver`.", pipe_name: PIPE_NAME, timeout: 0 });
}

function startTeam() {
  if (!DATABASE_URL || !existsSync(TEAM_KEY_FILE)) {
    log("pas de base d'équipe (equipe-init) : aide locale seulement");
    return;
  }
  teamStore = new PostgresTeamStore(teamKey());
  team = new TeamSync(teamStore, solutions, { register, helpNotification, record, log });
  log("équipe connectée (blocs chiffrés, sans identité)");
}

// ---- boucle principale
async function run() {
  if (!KEY) throw new Error("SCREENPIPE_API_KEY manquant : source ~/.config/screenpipe/env");
  if (!SIM && !existsSync(CONSENT)) {
    console.error("Pas de consentement. Lancer d'abord : bun andrea/daemon/main.ts activer");
    process.exit(1);
  }
  startServer();
  startTeam();
  const builder = new EpisodeBuilder();
  let cursor = Date.now() - 5000;
  let tick = 0;
  log(`friction-assist ${SIM ? "en SIMULATION (aucun écran lu)" : "actif"} (port ${PORT}, ${solutions.length} solutions). « pause » pour couper.`);

  for (;;) {
    await Bun.sleep(POLL_MS);
    if (existsSync(PAUSED)) continue;
    try {
      if (!SIM) {
        const since = new Date(cursor - 1500).toISOString(); // la frame arrive ~1 s après la capture
        const [inputs, frames] = await Promise.all([search({ content_type: "input", start_time: since }), search({ content_type: "ocr", start_time: since })]);
        for (const ev of inputs) builder.addInput(ev);
        for (const f of frames) builder.addFrame(f);
        cursor = Date.now();
        for (const ep of builder.ready(Date.now())) await handleEpisode(ep);
      }
      tick++;
      if (team && tick % Math.round(TEAM_POLL_MS / POLL_MS) === 0) await team.poll();
      if (tick % 10 === 0) await pollFeedback();
      if (tick % 300 === 0) log(`épisodes écartés par le détecteur : ${stats.skipped}, envoyés au modèle : ${stats.qualified}`);
      if (tick % 60 === 0) await nightlyFallback();
      if (teamStore && !INSTANCE && tick % 600 === 0) log(`carte d'équipe rafraîchie : ${(await publishMap(teamStore)).length} blocs`);
    } catch (e) {
      if (e instanceof ScreenpipeClosed) {
        log(`${e.message}. Nouvel essai dans 30 s.`);
        await Bun.sleep(30_000);
      } else log("erreur :", (e as Error).message);
    }
  }
}

// ---- simulation : un processus par membre de l'équipe simulée
async function simulate() {
  const self = new URL(import.meta.url).pathname;
  const env = (m: (typeof SIM_TEAM)[number]) => ({ ...process.env, FRICTION_INSTANCE: m.name, FRICTION_PORT: String(m.port), FRICTION_SIM: "1", FRICTION_SEED: m.seed ? "1" : "0" });
  for (const m of SIM_TEAM) await Bun.spawn(["bun", self, "relais"], { env: env(m), stdout: "inherit", stderr: "inherit" }).exited;
  const procs = SIM_TEAM.map((m) => Bun.spawn(["bun", self, ...(debug ? ["--debug"] : [])], { env: env(m), stdout: "inherit", stderr: "inherit" }));
  console.log(`Équipe simulée : ${SIM_TEAM.map((m) => `${m.name} (port ${m.port}${m.seed ? ", connaît les règles" : ""})`).join(", ")}.
Injecter un épisode chez Léa :  bun andrea/daemon/main.ts injecter lea "Quelqu'un sait quel pipeline choisir pour un ticket, Support ou Support OLD ?"
Ctrl+C pour tout arrêter.`);
  process.on("SIGINT", () => { procs.forEach((p) => p.kill()); process.exit(0); });
  await Promise.all(procs.map((p) => p.exited));
}

// ---- commandes
switch (cmd) {
  case "activer":
    writeFileSync(CONSENT, JSON.stringify({ activatedAt: new Date().toISOString() }));
    console.log(`Activé. Ce que fait friction-assist sur CETTE machine :
- lit les frames et les changements de fenêtre de Screenpipe des 3 dernières minutes, dans le périmètre de travail ;
- envoie le texte nouveau d'une fenêtre (identifiants évidents masqués) au modèle choisi dans Screenpipe ;
- affiche une aide quand une solution correspond ; sinon publie une demande anonyme (étape + type, sans texte) ;
- n'écrit aucun texte d'écran sur disque. « pause » coupe tout, « desactiver » retire le consentement.`);
    break;
  case "desactiver":
    rmSync(CONSENT, { force: true });
    console.log("Consentement retiré : le daemon ne démarrera plus.");
    break;
  case "pause":
    writeFileSync(PAUSED, "");
    console.log("En pause : rien n'est lu ni envoyé.");
    break;
  case "reprendre":
    rmSync(PAUSED, { force: true });
    console.log("Repris.");
    break;
  case "statut":
    console.log({ instance: INSTANCE || "poste", consentement: existsSync(CONSENT), pause: existsSync(PAUSED), port: PORT, solutions: solutions.length, equipe: Boolean(DATABASE_URL && existsSync(TEAM_KEY_FILE)) });
    break;
  case "relais":
    await setupRelay(PORT);
    console.log(`${INSTANCE || "poste"} : relais prêt (clic d'un bouton « api » → POST http://127.0.0.1:${PORT}/hook)`);
    break;
  case "retirer-relais":
    await removeRelay();
    console.log("Instance de relais supprimée.");
    break;
  case "equipe-init": {
    // URL de la base : FRICTION_DATABASE_URL (team.env), jamais dans le dépôt.
    if (!DATABASE_URL) {
      console.error("FRICTION_DATABASE_URL absent. Créer ~/.config/friction-assist/team.env (droits 600) avec la ligne transmise en privé par l'équipe, puis : source ~/.config/friction-assist/team.env");
      process.exit(1);
    }
    mkdirSync(TEAM_DIR, { recursive: true });
    const i = process.argv.indexOf("--cle");
    if (i > 0) writeFileSync(TEAM_KEY_FILE, process.argv[i + 1], { mode: 0o600 });
    else if (!existsSync(TEAM_KEY_FILE)) writeFileSync(TEAM_KEY_FILE, randomBytes(32).toString("base64"), { mode: 0o600 });
    const store = new PostgresTeamStore(teamKey());
    await store.init();
    await store.close();
    console.log(`Équipe prête : table friction_blobs (RLS active), clé d'équipe dans ${TEAM_KEY_FILE}.
Pour un collègue : lui transmettre EN PRIVÉ la clé, puis il lance : bun andrea/daemon/main.ts equipe-init --cle <clé>
${process.argv.includes("--afficher-cle") ? `Clé : ${readFileSync(TEAM_KEY_FILE, "utf8").trim()}` : "(--afficher-cle pour l'afficher)"}`);
    break;
  }
  case "carte-installer": {
    // Crée ou met à jour la Live View « Carte des frictions » dans l'app Screenpipe de ce poste.
    const now = new Date().toISOString();
    const tpl = { ...JSON.parse(readFileSync(new URL("./friction-map.liveview.json", import.meta.url), "utf8")), createdAt: now, updatedAt: now };
    const r = await fetch(`${process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030"}/live-views/${tpl.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(tpl) });
    console.log(`Live View ${tpl.id} : HTTP ${r.status}. Ouvrir : ${MAP_DEEPLINK}`);
    break;
  }
  case "carte": {
    const store = new PostgresTeamStore(teamKey());
    const blocks = await publishMap(store);
    await store.close();
    console.log(`Carte publiée (${blocks.join(", ")}). Ouvrir : ${MAP_DEEPLINK}`);
    await notify({ id: `fa-map-${Date.now()}`, title: "Carte des frictions à jour", body: "Les détours de la semaine, par étape. Jamais par personne.", pipe_name: PIPE_NAME, timeout: 30_000,
      actions: [{ id: "open", label: "Ouvrir la carte", type: "deeplink", url: MAP_DEEPLINK, primary: true }] });
    break;
  }
  case "peupler-demo": {
    // Population synthétique pour la démo (autorisé par les organisateurs), marquée synthetic:true
    // et signalée sur la carte. Étapes tirées de UseCase.md.
    const store = new PostgresTeamStore(teamKey());
    const demo: [string, string, string, string, number, boolean][] = [
      ["Crisp : un client demande un dédommagement", "unclear", "required", "demande_aide", 14, true],
      ["HubSpot : client introuvable depuis un chat Crisp", "unclear", "direct", "recherche", 11, true],
      ["Recopier une conversation Crisp dans HubSpot", "rework", "influence", "ressaisie", 9, false],
      ["HubSpot : choisir le pipeline d'un ticket support", "unclear", "direct", "demande_aide", 8, true],
      ["HubSpot : remise supérieure à 15 % bloquée", "waiting", "required", "attente_relance", 6, false],
      ["HubSpot : retrouver l'offre d'un client (4 clics)", "switching", "direct", "parcours", 5, false],
      ["HubSpot : créer un prospect venu du chat", "handoff", "influence", "demande_aide", 3, true],
    ];
    const day = (i: number) => new Date(Date.now() - (i % 6) * 24 * 3600_000).toISOString().slice(0, 10);
    for (const [step, type, control, detour, n, solved] of demo) {
      for (let i = 0; i < n; i++) await store.put("signature", { step, type, control, detour, day: day(i), synthetic: true });
      if (solved) await store.put("solution", { id: `demo-${step.length}`, step, type, control, detour, title: step, body: "(démo)", owner: "demo", reviewed: day(0), uses: n, synthetic: true });
    }
    await store.close();
    console.log(`Données de démonstration ajoutées (${demo.reduce((a, d) => a + d[4], 0)} signatures). Puis : bun andrea/daemon/main.ts carte`);
    break;
  }
  case "nettoyer-demo": {
    // Retire les données de démonstration (synthetic:true) : à faire avant tout usage réel.
    const store = new PostgresTeamStore(teamKey());
    const ids: number[] = [];
    for (const kind of ["signature", "solution"] as const)
      for (let after = 0; ; ) {
        const page = await store.list(kind, after);
        if (!page.length) break;
        ids.push(...page.filter((r) => r.payload?.synthetic).map((r) => r.id));
        after = page.at(-1)!.id;
      }
    console.log(`Données de démonstration retirées : ${await store.remove(ids)} lignes.`);
    await store.close();
    break;
  }
  case "simuler":
    await simulate();
    break;
  case "injecter": {
    const m = SIM_TEAM.find((x) => x.name === args[1]);
    if (!m || !args[2]) { console.error(`usage : injecter <${SIM_TEAM.map((x) => x.name).join("|")}> "texte"`); process.exit(1); }
    const r = await fetch(`http://127.0.0.1:${m.port}/sim/episode`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: "Slack.exe", window: "#support - Slack", titles: ["chrome.exe | Ticket - HubSpot", "Slack.exe | #support - Slack"], text: args[2] }) });
    console.log(JSON.stringify(await r.json(), null, 2));
    break;
  }
  case "test-notif": {
    // Chaîne complète sans détection : notification réelle, clic relayé, 👍/👎 lus. 5 minutes.
    startServer();
    const s = solutions[0];
    if (!s) { console.error("aucune solution locale"); process.exit(1); }
    const ep = `test${Date.now().toString(36)}`;
    const message = await notify(helpNotification(ep, s));
    record({ kind: "shown", episode: ep, solution: s.id, test: true, message });
    log(`notification de test « ${s.title} » : ${message}. Clique « Ça m'a aidé » ou « Pas ça » (5 min).`);
    const end = Date.now() + 300_000;
    let closedLogged = false;
    while (Date.now() < end) {
      await Bun.sleep(3000);
      await pollFeedback().catch((e) => {
        if (!(e instanceof ScreenpipeClosed)) log("erreur :", e.message);
        else if (!closedLogged) { closedLogged = true; log(e.message); }
      });
    }
    process.exit(0);
  }
  case "run":
    await run();
    break;
  default:
    console.error(`commande inconnue : ${cmd}`);
    process.exit(1);
}
