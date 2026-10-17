// friction-assist : aide en direct quand on bloque sur une étape de process.
//
// Commandes (depuis la racine du dépôt, après `source ~/.config/screenpipe/env`) :
//   bun andrea/daemon/main.ts activer     consentement explicite, à faire une fois
//   bun andrea/daemon/main.ts relais      crée l'instance de relais (clics des boutons → daemon)
//   bun andrea/daemon/main.ts             lance le daemon (refuse sans consentement)
//   bun andrea/daemon/main.ts pause | reprendre | statut | test-notif | desactiver
// Options : --debug affiche le texte des épisodes (sinon seules les métadonnées sont journalisées).
//
// Vie privée : rien ne tourne sans `activer`, `pause` coupe tout, aucune mesure par personne,
// aucun texte d'écran écrit sur disque ; le texte d'un épisode ne part que vers le modèle
// configuré dans Screenpipe, identifiants évidents masqués.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { KEY, MIN_CONFIDENCE, NIGHTLY_HOUR, PIPE_NAME, POLL_MS, PORT, SKIP_CONFIDENCE, SOLUTION_COOLDOWN_MS, STATE_DIR } from "./config";
import { EpisodeBuilder } from "./episodes";
import { qualify } from "./qualify";
import { feedbackSince, notify, relayUrl, removeRelay, search, setupRelay } from "./screenpipe";
import { loadSolutions, saveSolutions, type Solution } from "./solutions";
import { collect } from "../offline/collect";
import { approvedDetector } from "../offline/detector";
import { learn } from "../offline/learn";
import { offlineToken } from "../offline/token";

const CONSENT = `${STATE_DIR}consent.json`;
const PAUSED = `${STATE_DIR}paused`;
const EVENTS = `${STATE_DIR}events.jsonl`; // métadonnées seulement : épisode, solution, action, heure
const debug = process.argv.includes("--debug");
const cmd = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "run";

const hms = (t = Date.now()) => new Date(t).toLocaleTimeString("fr-FR");
const log = (...a: unknown[]) => console.log(`[${hms()}]`, ...a);
const record = (e: Record<string, unknown>) => appendFileSync(EVENTS, JSON.stringify({ at: new Date().toISOString(), ...e }) + "\n");

// ---- notification d'aide : titre = la réponse, 2 boutons max, pas d'emoji ni de « ! »
const pending = new Map<string, { episode: string; solution: string; at: number }>(); // nonce → épisode

function helpNotification(episode: string, s: Solution) {
  const nonce = randomBytes(12).toString("hex");
  pending.set(nonce, { episode, solution: s.id, at: Date.now() });
  const actions: Record<string, unknown>[] = [
    { id: "helped", label: "Ça m'a aidé", type: "api", url: relayUrl, method: "POST", primary: true,
      body: { action: "helped", episode, solution: s.id, nonce } },
  ];
  if (s.copy) actions.push({ id: "copy", label: "Copier", type: "copy", value: s.copy });
  return {
    id: `fa-${episode}`,
    title: s.title,
    body: `${s.body}\nRéglé ${s.uses} fois dans l'équipe.`,
    pipe_name: PIPE_NAME,
    priority: "normal",
    timeout: 60_000,
    actions,
  };
}

// ---- serveur local : reçoit les clics relayés par Screenpipe (POST /hook)
function startServer() {
  Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/health") return new Response("ok");
      // Traitement de nuit, déclenché par nos pipes Screenpipe (jeton dans leur pipe.md).
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
      if (path !== "/hook" || req.method !== "POST") return new Response("not found", { status: 404 });
      const body = (await req.json().catch(() => ({}))) as Record<string, string>;
      const p = pending.get(body.nonce ?? "");
      // /notify est ouvert à tout programme : seul un nonce émis par ce daemon est accepté, une fois.
      if (!p || p.episode !== body.episode) return new Response("unknown nonce", { status: 403 });
      pending.delete(body.nonce);
      record({ kind: "click", action: body.action, episode: p.episode, solution: p.solution });
      log(`clic « ${body.action} » sur ${p.solution}`);
      return new Response("ok");
    },
  });
}

// ---- 👍/👎 natifs de Screenpipe → score local des solutions
let feedbackCursor = new Date().toISOString();
async function pollFeedback(solutions: Solution[]) {
  const records = await feedbackSince(feedbackCursor);
  for (const r of records) {
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
function* readEvents() {
  if (!existsSync(EVENTS)) return;
  for (const line of readFileSync(EVENTS, "utf8").split("\n")) if (line) yield JSON.parse(line);
}

// ---- repli du traitement de nuit : si nos pipes n'ont pas tourné aujourd'hui, le daemon s'en charge
async function nightlyFallback() {
  const now = new Date();
  if (now.getHours() !== NIGHTLY_HOUR) return;
  const today = now.toISOString().slice(0, 10);
  const ranToday = [...readEvents()].some((e) => e.kind === "offline/learn" && String(e.at).startsWith(today));
  if (ranToday) return;
  log("traitement de nuit (repli) : collecte puis apprentissage");
  const c = await collect();
  const r = await learn();
  record({ kind: "offline/learn", fallback: true, added: c.added, better: r.better });
  if (r.better) await notify({ id: `fa-learn-${Date.now()}`, title: "Nouveau détecteur prêt", body: "Il a passé la porte de validation. Relire `rapport`, puis `approuver`.", pipe_name: PIPE_NAME, timeout: 0 });
}

// ---- boucle de détection
async function run() {
  if (!KEY) throw new Error("SCREENPIPE_API_KEY manquant : source ~/.config/screenpipe/env");
  if (!existsSync(CONSENT)) {
    console.error("Pas de consentement. Lancer d'abord : bun andrea/daemon/main.ts activer");
    process.exit(1);
  }
  startServer();
  const solutions = loadSolutions();
  const builder = new EpisodeBuilder();
  const lastShown = new Map<string, number>();
  let cursor = Date.now() - 5000;
  let tick = 0;
  const stats = { skipped: 0, qualified: 0 };
  log(`friction-assist actif (port ${PORT}, ${solutions.length} solutions). « pause » pour couper.`);

  for (;;) {
    await Bun.sleep(POLL_MS);
    if (existsSync(PAUSED)) continue;
    try {
      const since = new Date(cursor - 1500).toISOString(); // marge : la frame arrive ~1 s après la capture
      const [inputs, frames] = await Promise.all([search({ content_type: "input", start_time: since }), search({ content_type: "ocr", start_time: since })]);
      for (const ev of inputs) builder.addInput(ev);
      for (const f of frames) builder.addFrame(f);
      cursor = Date.now();

      for (const ep of builder.ready(Date.now())) {
        // Filtre en direct : le détecteur approuvé (appris hors ligne) écarte le travail normal
        // sans appel au modèle. Sans détecteur approuvé, tout épisode va au modèle.
        const detector = approvedDetector();
        if (detector) {
          const d = detector(ep);
          if (!d.friction && d.confidence >= SKIP_CONFIDENCE) { stats.skipped++; continue; }
        }
        stats.qualified++;
        const v = await qualify(ep, solutions);
        if (debug) log("épisode", { app: ep.app, window: ep.window, titles: ep.titles, text: ep.text, verdict: v });
        else log(`épisode ${ep.app} → ${v ? `${v.detour} (${v.type}/${v.control}) solution=${v.solution_id ?? "aucune"} conf=${v.confiance}` : "non qualifié"}`);
        if (!v?.friction || !v.solution_id || v.confiance < MIN_CONFIDENCE) continue;
        if (Date.now() - (lastShown.get(v.solution_id) ?? 0) < SOLUTION_COOLDOWN_MS) continue;
        const s = solutions.find((x) => x.id === v.solution_id)!;
        const message = await notify(helpNotification(ep.id, s));
        lastShown.set(s.id, Date.now());
        record({ kind: "shown", episode: ep.id, solution: s.id, detour: v.detour, type: v.type, control: v.control, message });
        log(`notification « ${s.title} » : ${message}`);
      }
      if (++tick % 10 === 0) await pollFeedback(solutions);
      if (tick % 300 === 0) log(`épisodes écartés par le détecteur : ${stats.skipped}, envoyés au modèle : ${stats.qualified}`);
      if (tick % 60 === 0) await nightlyFallback();
    } catch (e) {
      log("erreur :", (e as Error).message);
    }
  }
}

// ---- commandes
switch (cmd) {
  case "activer":
    writeFileSync(CONSENT, JSON.stringify({ activatedAt: new Date().toISOString() }));
    console.log(`Activé. Ce que fait friction-assist sur CETTE machine :
- lit les frames et les changements de fenêtre de Screenpipe des 3 dernières minutes ;
- envoie le texte nouveau d'une fenêtre (identifiants évidents masqués) au modèle choisi dans Screenpipe ;
- affiche une aide quand une solution d'équipe correspond ; n'écrit aucun texte d'écran sur disque.
« pause » coupe tout, « desactiver » retire le consentement.`);
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
    console.log({ consentement: existsSync(CONSENT), pause: existsSync(PAUSED), port: PORT, solutions: loadSolutions().length });
    break;
  case "relais":
    await setupRelay(PORT);
    console.log(`Instance de relais prête : clic d'un bouton « api » → POST http://127.0.0.1:${PORT}/hook`);
    break;
  case "retirer-relais":
    await removeRelay();
    console.log("Instance de relais supprimée.");
    break;
  case "test-notif": {
    // Chaîne complète sans détection : notification réelle, clic relayé, 👍/👎 lus. 5 minutes.
    startServer();
    const solutions = loadSolutions();
    const s = solutions[0];
    const ep = `test${Date.now().toString(36)}`;
    const message = await notify(helpNotification(ep, s));
    record({ kind: "shown", episode: ep, solution: s.id, test: true, message });
    log(`notification de test « ${s.title} » : ${message}. Clique « Ça m'a aidé » ou donne un 👍/👎 (5 min).`);
    const end = Date.now() + 300_000;
    while (Date.now() < end) { await Bun.sleep(3000); await pollFeedback(solutions).catch((e) => log("erreur :", e.message)); }
    process.exit(0);
  }
  case "run":
    await run();
    break;
  default:
    console.error(`commande inconnue : ${cmd}`);
    process.exit(1);
}
