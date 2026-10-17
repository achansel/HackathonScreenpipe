// friction-assist : aide en direct quand on bloque sur une étape de process.
//
// Commandes (depuis la racine du dépôt, après `source ~/.config/screenpipe/env`
// et `source ~/.config/friction-assist/team.env`) :
//   bun andrea/daemon/main.ts activer        consentement explicite, à faire une fois
//   bun andrea/daemon/main.ts relais         instance de relais (clics des boutons → ce daemon)
//   bun andrea/daemon/main.ts equipe-creer Support --perimetre "crisp|rembourse"   (recommandé : stockage RPC, teamstore/)
//   bun andrea/daemon/main.ts equipe-rejoindre "<lien>" [--perimetre …] | equipe-liste | equipe-quitter <nom>
//   bun andrea/daemon/main.ts equipe-rotation <nom>       départ d'un membre : nouvelle clé, nouveau lien
//   bun andrea/daemon/main.ts equipe-certifier <nom> <solution-id>   responsable : signe une solution
//   bun andrea/daemon/main.ts equipe-init    (ancien) base Postgres directe + clé unique (--cle <base64> pour rejoindre)
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
  API, CALL, CRISP, DATABASE_URL, DOSSIER_MS, INSTANCE, KEY, LABEL, MIN_CONFIDENCE, NIGHTLY_HOUR, PIPE_NAME, POLL_MS, PORT, SIM,
  SKIP_CONFIDENCE, SOLUTION_COOLDOWN_MS, STATE_DIR, TEAM_DIR, TEAM_KEY_FILE, TEAM_POLL_MS,
} from "./config";
import { type CustomerCard, HubSpotLookup } from "../../minguk/src/assist/hubspot-lookup";
import { CallEpisodes } from "../../minguk/src/detect/call-episodes";
import { listenToMeeting } from "../../minguk/src/detect/call-listener";
import { CrispWatcher } from "../../minguk/src/detect/crisp-watcher";
import { HubSpot } from "../../minguk/src/seed/hubspot";
import { EpisodeBuilder, type Episode } from "./episodes";
import { groundedRequest, qualify } from "./qualify";
import { feedbackSince, notify, relayUrl, removeRelay, ScreenpipeClosed, search, setupRelay, withoutOwnNotifications } from "./screenpipe";
import { loadSolutions, saveSolutions, type Solution } from "./solutions";
import { publishMap, MAP_DEEPLINK } from "./map";
import { TeamSync } from "./team";
import { loadMemberships, openTeamStore, PostgresTeamStore, RpcTeamStore, saveMemberships, supabase, teamKey, teamstoreConfigured, type TeamStore } from "./teamstore";
import { membershipFromInvite, Team } from "../../teamstore/client";
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
    body: `${s.body}\nRéglé ${s.uses} fois dans l'équipe.${s.certified ? ` Certifiée par le responsable${s.team ? ` (${s.team})` : ""}.` : ""}`,
    pipe_name: PIPE_NAME,
    priority: "normal",
    timeout: 60_000,
    actions,
  };
}

// Fiche client (code de Minguk) : la réponse à « client introuvable » quand un client Crisp est en cours.
// On connaît son nom par Crisp, la fiche HubSpot se retrouve par le nom (son adresse Crisp diffère de
// celle du contrat). Clé HubSpot : HUBSPOT_SEED_TOKEN (~/.config/friction/env), en lecture seule si
// possible. Sans clé, la notification habituelle part. Le nom ne va qu'à HubSpot, jamais au modèle.
function cardNotification(episode: string, s: Solution, card: CustomerCard) {
  const n = helpNotification(episode, s) as { title: string; body: string; actions: Record<string, unknown>[] };
  const who = [card.name, card.company?.name, card.company?.plan].filter(Boolean).join(" · ");
  return {
    ...n,
    title: `${LABEL}Client : ${who}`,
    body: `Fiche HubSpot retrouvée par son nom : il écrit avec une autre adresse que celle du contrat.${card.deal ? `\nVente : ${card.deal.name}.` : ""}`,
    // 3 boutons au plus dans le panneau : [Y aller] (ouvre la fiche dans le navigateur), puis les retours.
    actions: [{ id: "open", label: "Y aller", type: "link", url: card.contactUrl, primary: true },
      ...n.actions.filter((a) => a.id !== "copy").map((a) => ({ ...a, primary: false }))],
  };
}
const hubspotToken = process.env.HUBSPOT_SEED_TOKEN;
let hubspot: Promise<HubSpotLookup | null> | null = null;
const cards = new Map<string, CustomerCard | null>();
async function customerCard(name: string): Promise<CustomerCard | null> {
  if (!hubspotToken) return null;
  if (cards.has(name)) return cards.get(name)!;
  hubspot ??= (async () => {
    const api = new HubSpot(hubspotToken);
    const account = await api.accountDetails();
    return new HubSpotLookup(api, { portalId: account.portalId, uiDomain: account.uiDomain });
  })().catch((e) => { log("HubSpot :", (e as Error).message); return null; });
  const lookup = await hubspot;
  if (!lookup) return null;
  const found = await lookup.byName(name).catch((e) => { log("HubSpot :", (e as Error).message); return null; });
  if (!found) return null; // erreur passagère : pas mémorisée, on réessaiera au prochain épisode
  const card = found.length === 1 ? found[0]! : null; // deux homonymes : pas de fiche plutôt qu'une fausse
  cards.set(name, card);
  return card;
}

// ---- traitement d'un épisode (direct ou injecté en simulation)
const solutions = loadSolutions();
const lastShown = new Map<string, number>();
const stats = { skipped: 0, qualified: 0 };
let team: TeamSync | null = null;
let teamStore: TeamStore | null = null;

// Contexte du dossier : le dernier message client lu dans Crisp par le code de Minguk (ses « yeux »).
// Contexte seulement, pas une friction (docs/demo.md, choix techniques) ; le nom reste local.
let dossier: { name: string; text: string; at: number } | null = null;
const crisp = CRISP && !SIM
  ? new CrispWatcher({ screenpipeUrl: API, apiKey: KEY, onEvent: (e) => {
      if (e.kind !== "message" || !e.preview) return;
      dossier = { name: e.name, text: e.preview, at: e.detectedAt };
      log(`Crisp : nouveau message client (contexte ${DOSSIER_MS / 60_000} min)`);
      void customerCard(e.name); // fiche prête avant que Léa cherche dans HubSpot
    } })
  : null;
const dossierText = () => (dossier && Date.now() - dossier.at < DOSSIER_MS ? dossier.text : undefined);

// Appel client (code de Minguk, ses « oreilles ») : la transcription en direct d'une réunion Screenpipe.
// Le client est nommé par le titre (« Appel Jean Dupont ») : sa fiche part dès le décroché. Ses phrases
// sont le contexte du dossier ; une phrase de l'employé fait un épisode, qualifié comme les autres.
function callCardNotification(meetingId: number, card: CustomerCard) {
  const plan = card.company?.plan ? `Client **${card.company.plan}**` : "Client";
  return {
    id: `fa-call-${meetingId}-${card.contactId}`,
    title: `${LABEL}En ligne : ${[card.name, card.company?.name].filter(Boolean).join(", ")}`,
    body: `${plan}${card.deal ? ` · vente « ${card.deal.name} »` : ""}.\nFiche HubSpot retrouvée par le titre de l'appel.`,
    pipe_name: PIPE_NAME,
    priority: "normal",
    timeout: 60_000,
    actions: [{ id: "open", label: "Ouvrir sa fiche", type: "link", url: card.contactUrl, primary: true }],
  };
}
const calls = CALL && !SIM
  ? new CallEpisodes({
      onCallStart: ({ meetingId, customer }) => {
        log(`appel en cours (réunion ${meetingId})${customer ? " : client nommé par le titre" : ""}`);
        if (!customer) return;
        dossier = { name: customer, text: "(appel téléphonique en cours)", at: Date.now() };
        void (async () => {
          const card = await customerCard(customer);
          if (!card) { log("appel : pas de fiche HubSpot unique pour ce client"); return; }
          const n = callCardNotification(meetingId, card);
          log(`notification « ${n.title.replace(LABEL, "")} » (fiche client, appel) : ${await notify(n)}`);
        })().catch((e) => log("appel :", (e as Error).message));
      },
      onCustomerSentence: (text) => { if (dossier) dossier = { ...dossier, text, at: Date.now() }; },
      onCallEnd: () => log("appel terminé"),
      onEpisode: (ep) => void handleEpisode(ep).catch((e) => log("appel :", (e as Error).message)),
    })
  : null;
function listenToCalls() {
  if (!calls) return;
  const listener = listenToMeeting({
    screenpipeUrl: API, apiKey: KEY,
    onStatus: async ({ active, activeMeetingId }) => {
      if (!active || activeMeetingId === null || activeMeetingId === calls.activeMeetingId) return calls.status(active, activeMeetingId);
      const meeting = await fetch(`${API}/meetings/${activeMeetingId}`, { headers: { Authorization: `Bearer ${KEY}` } })
        .then((r) => (r.ok ? (r.json() as Promise<{ title?: string | null }>) : {})).catch(() => ({}));
      calls.status(true, activeMeetingId, (meeting as { title?: string | null }).title);
    },
    onSentence: (item) => calls.sentence(item),
    onClose: () => setTimeout(listenToCalls, 5000), // Screenpipe redémarré : on se reconnecte
  });
  listener.opened.catch(() => {});
}

async function handleEpisode(ep: Episode) {
  // Notre propre notification relue par l'OCR : retirée du texte, épisode ignoré si c'était l'essentiel.
  const own = withoutOwnNotifications(ep.text);
  if (own.echo) { log(`épisode ${ep.app} ignoré : surtout le texte de notre notification`); return { echo: true }; }
  ep = { ...ep, text: own.text };
  // Filtre appris hors ligne : écarte le travail normal sans appel au modèle.
  const detector = approvedDetector();
  if (detector) {
    const d = detector(ep);
    if (!d.friction && d.confidence >= SKIP_CONFIDENCE) { stats.skipped++; return { skipped: true }; }
  }
  stats.qualified++;
  // Pas de contexte dans la conversation du client elle-même : son message y est déjà à l'écran, et le
  // contexte ferait juger « client introuvable » avant toute recherche (mesuré en répétition, 19:10:25).
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const context = dossier && fold(ep.window).includes(fold(dossier.name)) ? undefined : dossierText();
  const v = await qualify(ep, solutions, context);
  if (debug) log("épisode", { app: ep.app, window: ep.window, titles: ep.titles, text: ep.text, dossier: context, verdict: v });
  else log(`épisode ${ep.app} → ${v ? `${v.detour} (${v.type}/${v.control}) solution=${v.solution_id ?? "aucune"} conf=${v.confiance}` : "non qualifié"}`);
  if (!v?.friction || v.confiance < MIN_CONFIDENCE) return { verdict: v };
  if (team) await team.sign(v);
  if (v.solution_id) {
    const s = solutions.find((x) => x.id === v.solution_id)!;
    const card = s.id === "client-introuvable" && dossier && dossierText() ? await customerCard(dossier.name) : null;
    // Anti-répétition par aide ET par client : la fiche de Jean n'est pas une répétition de l'aide générique
    // montrée une minute plus tôt (mesuré en répétition : la fiche bloquée 10 min).
    // Une solution qui collectionne les « Pas ça » (score ≤ -2) ne part qu'à 0,95 de confiance.
    if ((s.score ?? 0) <= -2 && v.confiance < 0.95) { log(`aide « ${s.title} » retenue : souvent jugée « Pas ça » (score ${s.score})`); return { verdict: v, held: true }; }
    const shownKey = card ? `${s.id}|${card.contactId}` : s.id;
    if (Date.now() - (lastShown.get(shownKey) ?? 0) < SOLUTION_COOLDOWN_MS) return { verdict: v, cooldown: true };
    const n = card ? cardNotification(ep.id, s, card) : helpNotification(ep.id, s);
    const message = await notify(n);
    lastShown.set(shownKey, Date.now());
    record({ kind: "shown", episode: ep.id, solution: s.id, detour: v.detour, type: v.type, control: v.control, message });
    log(`notification « ${n.title.replace(LABEL, "")} »${card ? " (fiche client)" : ""} : ${message}`);
    return { verdict: v, notified: s.id };
  }
  // Notifier peu, compter beaucoup : une demande anonyme part vers toute l'équipe, donc seulement sur une
  // question explicite (éval du 17/10 : 4 demandes justes sur 12). Le reste est déjà compté sur la carte (sign).
  if (team && v.detour !== "demande_aide") { log(`friction « ${v.step} » (${v.detour}) comptée sur la carte, sans demande`); return { verdict: v, counted: true }; }
  if (team) {
    if (!groundedRequest(v.step, ep.text)) { log(`demande anonyme retenue : « ${v.step} » ne s'appuie pas sur le texte de l'épisode`); return { verdict: v, held: true }; }
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

async function startTeam() {
  if (teamstoreConfigured() && loadMemberships().length) {
    const store = new RpcTeamStore(log);
    await store.init();
    teamStore = store;
    team = new TeamSync(store, solutions, { register, helpNotification, record, log });
    log("équipe connectée par RPC (blocs chiffrés par équipe, sans identité)");
    return;
  }
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
  await startTeam();
  listenToCalls();
  const builder = new EpisodeBuilder();
  const queue: Episode[] = [];
  let inFlight = 0;
  const MAX_IN_FLIGHT = 3;
  let cursor = Date.now() - 5000;
  let tick = 0;
  log(`friction-assist ${SIM ? "en SIMULATION (aucun écran lu)" : "actif"} (port ${PORT}, ${solutions.length} solutions). « pause » pour couper.`);

  for (;;) {
    await Bun.sleep(POLL_MS);
    if (existsSync(PAUSED)) continue;
    try {
      if (!SIM) {
        const since = new Date(cursor - 1500).toISOString(); // la frame arrive ~1 s après la capture
        // L'une après l'autre : en parallèle, Screenpipe répond 503 « search is busy » (mesuré par Minguk).
        const inputs = await search({ content_type: "input", start_time: since });
        const frames = await search({ content_type: "ocr", start_time: since });
        for (const ev of inputs) builder.addInput(ev);
        for (const f of frames) builder.addFrame(f);
        cursor = Date.now();
        if (crisp) await crisp.tick().catch((e) => debug && log("Crisp :", (e as Error).message));
        // Jugés en parallèle (3 au plus) : un appel au modèle prend ~3 s, la lecture de l'écran et l'équipe
        // ne l'attendent pas, et l'échec d'un épisode ne fait pas perdre les autres.
        for (const ep of builder.ready(Date.now())) queue.push(ep);
        while (queue.length && inFlight < MAX_IN_FLIGHT) {
          const ep = queue.shift()!;
          inFlight++;
          handleEpisode(ep).catch((e) => log("épisode non traité :", (e as Error).message)).finally(() => inFlight--);
        }
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
    console.log({ instance: INSTANCE || "poste", consentement: existsSync(CONSENT), pause: existsSync(PAUSED), port: PORT, solutions: solutions.length, equipe: teamstoreConfigured() ? loadMemberships().map((m) => `${m.name} (époque ${m.epoch}${m.admin ? ", responsable" : ""})`) : Boolean(DATABASE_URL && existsSync(TEAM_KEY_FILE)) });
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
    const store = await openTeamStore(log);
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
    const store = await openTeamStore(log);
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
    const store = await openTeamStore(log);
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
  // ---- équipes par RPC (teamstore/) : clés par équipe dans ~/.config/friction-assist/teams.json (600)
  case "equipe-creer":
  case "equipe-rejoindre":
  case "equipe-liste":
  case "equipe-quitter":
  case "equipe-rotation":
  case "equipe-certifier": {
    if (!teamstoreConfigured()) {
      console.error("FRICTION_TEAMSTORE_URL absent (et FRICTION_TEAMSTORE_ANON_KEY) : voir teamstore/FICHE.md, puis source ~/.config/friction-assist/team.env");
      process.exit(1);
    }
    const opt = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
    const list = loadMemberships();
    const find = (name?: string) => list.find((m) => m.name.toLowerCase() === (name ?? "").toLowerCase()) ?? (console.error(`équipe inconnue : ${name} (equipe-liste)`), process.exit(1));
    if (cmd === "equipe-creer") {
      if (!args[1]) { console.error('usage : equipe-creer <nom> [--perimetre "crisp|rembourse"]'); process.exit(1); }
      const t = await Team.create(supabase(), args[1], opt("--perimetre"));
      saveMemberships([...list, t.m]);
      console.log(`Équipe « ${t.name} » créée (tu en es le responsable : rotation, certification).
Lien d'invitation, à transmettre EN PRIVÉ à chaque membre (il contient la clé de l'équipe) :
${t.invite()}
Chez le membre : bun andrea/daemon/main.ts equipe-rejoindre "<lien>" [--perimetre …]`);
    } else if (cmd === "equipe-rejoindre") {
      const m = membershipFromInvite(args[1] ?? "", opt("--perimetre"));
      const t = await Team.open(supabase(), m);
      await t.pull(Number.MAX_SAFE_INTEGER); // vérifie le jeton sans rien télécharger
      saveMemberships([...list.filter((x) => x.teamId !== m.teamId), m]);
      console.log(`Équipe « ${m.name} » rejointe (époque ${m.epoch}${m.ownerPub ? ", solutions certifiées vérifiables" : ""}).`);
    } else if (cmd === "equipe-liste") {
      for (const m of list) console.log(`- ${m.name} : époque ${m.epoch}${m.scope ? `, périmètre /${m.scope}/` : ", sans périmètre"}${m.admin ? ", responsable" : ""}`);
      if (!list.length) console.log("aucune équipe (equipe-creer ou equipe-rejoindre)");
    } else if (cmd === "equipe-quitter") {
      const m = find(args[1]);
      saveMemberships(list.filter((x) => x !== m));
      console.log(`Clés de « ${m.name} » effacées de cette machine.`);
    } else if (cmd === "equipe-rotation") {
      const m = find(args[1]);
      const t = await Team.open(supabase(), m);
      const r = await t.rotate();
      saveMemberships(list.map((x) => (x === m ? t.m : x)));
      console.log(`Clé de « ${m.name} » changée (époque ${t.epoch}) : ${r.republished} solution(s) republiée(s), l'ancien lien ne donne plus accès à rien.
Nouveau lien, à renvoyer EN PRIVÉ aux membres restants seulement :
${r.invite}`);
    } else {
      const m = find(args[1]);
      const s = solutions.find((x) => x.id === args[2]);
      if (!s) { console.error(`solution inconnue : ${args[2]}`); process.exit(1); }
      const t = await Team.open(supabase(), m);
      const { score, shared, ...publishable } = s;
      await t.publish("solution", await t.certify(publishable));
      console.log(`Solution « ${s.title} » certifiée et publiée dans « ${m.name} ».`);
    }
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
