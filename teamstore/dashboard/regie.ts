// Régie de répétition : relève les VRAIES réactions pendant qu'on joue le déroulé d'Andrea (docs/demo-live.md)
// avec les vrais outils. Lecture seule, rien n'est modifié chez Andrea ni chez Minguk, et aucune recherche
// Screenpipe en plus (le démon a l'autorité, et chaque lecteur de plus surcharge /search).
//   - notifications réellement affichées : historique de Screenpipe (127.0.0.1:11435/notifications)
//   - clics sur les boutons : journal de l'app Screenpipe (« native notification action », Mac)
//   - ce que fait le démon d'Andrea : agent/.state/**/events.jsonl, et son /health
//   - ce que partage l'équipe : les blocs chiffrés, déchiffrés avec les clés du démon de CE poste
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Board } from "../board";
import { SupabaseStore, Team, type Membership } from "../client";

const API = () => process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
const NOTIFY = () => process.env.SCREENPIPE_NOTIFY_URL ?? "http://127.0.0.1:11435";
const ROOT = join(import.meta.dir, "..");
const TEAM_DIR = join(homedir(), ".config", "friction-assist");

async function ping(url: string, init?: RequestInit) {
  try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(1500) }); return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "" }; }
  catch { return { ok: false, status: 0, text: "" }; }
}
const envHas = (file: string, name: string) => existsSync(file) && new RegExp(`^\\s*(export\\s+)?${name}\\s*=\\s*\\S`, "m").test(readFileSync(file, "utf8"));

/** Ce qui doit être vrai avant de jouer (docs/demo-live.md, « 15 min avant »). */
export async function checks(storeUrl: string, crispFlag: boolean) {
  const port = Number(process.env.FRICTION_PORT ?? 8787);
  const daemon = await ping(`http://127.0.0.1:${port}/health`);
  const sim = await ping("http://127.0.0.1:4518/");
  const sp = await ping(`${API()}/health`);
  const notif = await ping(`${NOTIFY()}/notifications?limit=1`);
  const teams = teamFiles();
  const views = await ping(`${API()}/live-views`, { headers: { Authorization: `Bearer ${process.env.SCREENPIPE_API_KEY ?? ""}` } });
  const viewIds = views.ok ? (JSON.parse(views.text) as { id: string }[]).map((v) => v.id) : [];
  return [
    { id: "screenpipe", label: "Screenpipe tourne (API)", ok: sp.ok, detail: sp.ok ? "" : "ouvrir l'app Screenpipe" },
    { id: "notify", label: "Notifications Screenpipe joignables", ok: notif.ok, detail: notif.ok ? "" : "port 11435 fermé : relancer l'app" },
    { id: "daemon", label: `Démon d'Andrea lancé (port ${port})`, ok: daemon.ok, detail: daemon.ok ? "" : "bun agent/main.ts (voir docs/demo-live.md)" },
    { id: "team", label: "Équipe sur le stockage chiffré (lisible par la régie)", ok: Boolean(storeUrl && teams.length), detail: storeUrl && teams.length ? `${teams.length} équipe(s)` : storeUrl ? "bun agent/main.ts equipe-rejoindre \"<lien>\"" : "FRICTION_TEAMSTORE_URL absent (ancien mode Postgres : la régie ne voit pas l'équipe)" },
    { id: "hubspot", label: "Clé HubSpot pour la fiche client (Léa)", ok: envHas(join(homedir(), ".config", "friction", "env"), "HUBSPOT_SEED_TOKEN"), detail: "~/.config/friction/env : HUBSPOT_SEED_TOKEN (sinon l'aide générique part)" },
    { id: "sim", label: "Simulateur Crisp de Minguk (facultatif)", ok: sim.ok, detail: sim.ok ? "http://127.0.0.1:4518" : "cd integrations && bun run simulate --sans-aide" },
    { id: "map", label: "Carte d'Andrea installée dans Screenpipe", ok: viewIds.includes("friction-map"), detail: viewIds.includes("friction-map") ? "" : "bun agent/main.ts carte-installer" },
    { id: "single", label: "Un seul décideur (pas de --crisp en même temps que le démon)", ok: !(crispFlag && daemon.ok), detail: crispFlag && daemon.ok ? "relancer start.sh sans --crisp" : "" },
  ];
}

function teamFiles(): Membership[] {
  if (!existsSync(TEAM_DIR)) return [];
  const all = readdirSync(TEAM_DIR).filter((f) => /^teams(-[\w-]+)?\.json$/.test(f)).flatMap((f) => { try { return JSON.parse(readFileSync(join(TEAM_DIR, f), "utf8")) as Membership[]; } catch { return []; } });
  return [...new Map(all.map((m) => [m.teamId, m])).values()];
}

/** Notifications réellement passées par Screenpipe depuis `since`. */
async function notifications(since: number) {
  const r = await ping(`${NOTIFY()}/notifications?limit=50`);
  if (!r.ok) return [];
  return (JSON.parse(r.text) as { id: string; title: string; body?: string; timestamp: string; read?: boolean }[])
    .map((n) => ({ at: Date.parse(n.timestamp), id: n.id, title: n.title, body: (n.body ?? "").slice(0, 160), read: Boolean(n.read) }))
    .filter((n) => n.at >= since).sort((a, b) => a.at - b.at);
}

/** Clics sur les boutons des notifications (journal de l'app Screenpipe ; écrit sur Mac). */
function clicks(since: number) {
  const days = new Set([new Date().toISOString().slice(0, 10), new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)]);
  const out: { at: number; label: string; type: string }[] = [];
  for (const d of days) {
    const f = join(homedir(), ".screenpipe", `screenpipe-app.${d}.log`);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^(\S+Z)\s.*native notification action: (\{.*\})\s*$/);
      if (!m) continue;
      const at = Date.parse(m[1]);
      if (at < since) continue;
      try { const a = JSON.parse(m[2]); out.push({ at, label: a.label ?? a.id ?? "", type: a.type ?? "" }); } catch {}
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Ce que le démon d'Andrea a fait : aide montrée, demande envoyée, partage, retour (métadonnées seulement). */
function daemonEvents(since: number) {
  const base = join(ROOT, "agent", ".state");
  if (!existsSync(base)) return [];
  const files = [["poste", join(base, "events.jsonl")], ...readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => [d.name, join(base, d.name, "events.jsonl")])];
  const out: { at: number; instance: string; kind: string; detail: string }[] = [];
  for (const [instance, f] of files) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        const at = Date.parse(e.at);
        if (at < since) continue;
        const detail = [e.solution, e.step, e.action, e.rating, e.from === "team" ? "venue de l'équipe" : "", e.message].filter(Boolean).join(" · ");
        out.push({ at, instance, kind: e.kind, detail: String(detail).slice(0, 160) });
      } catch {}
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---- l'équipe, vue par ce poste (mêmes clés que le démon), et la Live View « Frictions en direct »
const board = new Board();
const cursors = new Map<string, number>();
let lastLive = { sig: "", at: 0 };
async function teamBoard(storeUrl: string, anonKey: string, since: number) {
  const list = teamFiles();
  if (!storeUrl || !list.length) return null;
  const store = new SupabaseStore(storeUrl, anonKey, "/rest/v1");
  for (const m of list) {
    try {
      const t = await Team.open(store, m);
      const rows = await t.pull(cursors.get(m.teamId) ?? 0);
      for (const r of rows) cursors.set(m.teamId, Math.max(cursors.get(m.teamId) ?? 0, r.seq));
      board.add(t.id, t.name, t.epoch, rows);
    } catch { /* clé changée ou réseau : on garde l'état connu */ }
  }
  return board.state(Date.now(), since);
}

export async function snapshot(o: { since: number; storeUrl: string; anonKey: string; crisp: boolean; live?: (b: Record<string, unknown>) => Promise<unknown>; publish: boolean }) {
  const st = await teamBoard(o.storeUrl, o.anonKey, o.since);
  let live = "";
  if (st && o.publish && o.live) {
    const sig = JSON.stringify([st.pending.map((p) => p.requestId), st.today, st.resolved.length, st.certified, st.timeline.length]);
    if (sig !== lastLive.sig || Date.now() - lastLive.at > 5000) { lastLive = { sig, at: Date.now() }; await o.live(Board.liveView(st)); live = "publiée"; }
  }
  return {
    now: Date.now(),
    checks: await checks(o.storeUrl, o.crisp),
    notifications: await notifications(o.since),
    clicks: clicks(o.since),
    events: daemonEvents(o.since),
    board: st,
    live,
  };
}
