// Vue « Frictions de l'équipe » (live-view:friction-map:*), dans l'app Screenpipe : une seule vue, 5 blocs.
// Fusion de la carte d'Andrea (détours sur 7 jours, en fourchettes) et du tableau « Frictions en direct » de
// Haytham (en attente, résolues, règles certifiées, boucle de nuit), dont on réutilise le calcul tel quel
// (teamstore/board.ts). Les Live Views sont en lecture seule : les actions passent par les notifications.
// On compte des DÉTOURS par étape, jamais des personnes : rien dans les blocs n'a d'identité.
import { Board } from "../../teamstore/board";
import { API, KEY } from "./config";
import { canonicalSteps } from "./steps";
import type { Kind, TeamStore } from "./teamstore";

export const MAP_PIPE = "friction-map"; // pipe auquel les blocs sont liés (rempli ici, via source_pipe)
export const MAP_DEEPLINK = "screenpipe://live-view/friction-map";
const auth = { Authorization: `Bearer ${KEY}` };
const WEEK_MS = 7 * 24 * 3600_000;

const range = (n: number) => (n < 5 ? "moins de 5" : n < 10 ? "5 à 10" : n < 20 ? "10 à 20" : "plus de 20");
const ORDER = ["en attente de réponse", "à documenter", "solution partagée", "règle certifiée"];
const ROWS = 8; // le tableau tient dans la vue sans défiler
const short = (s: string) => (s.length > 60 ? `${s.slice(0, 59)}…` : s);
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export async function buildMap(store: TeamStore, now = Date.now()) {
  const kinds: Kind[] = ["signature", "request", "solution", "candidate"];
  const rows = Object.fromEntries(await Promise.all(kinds.map(async (k) => [k, await listAll(store, k).catch(() => [])]))) as Record<Kind, Awaited<ReturnType<typeof listAll>>>;

  // Libellés regroupés en étapes canoniques (modèle + cache) : l'IA formule la même étape de plusieurs façons.
  const labels = kinds.flatMap((k) => rows[k].map((r) => r.payload?.step)).filter(Boolean);
  const canon = await canonicalSteps(labels);
  const step = (label: string) => canon.get(label) ?? label;

  // Calcul de Haytham (board.ts) : en attente, résolues et délai, règles certifiées, boucle de nuit.
  const board = new Board();
  const byTeam = new Map<string, { seq: number; kind: Kind; data: any }[]>();
  for (const k of kinds) for (const r of rows[k]) {
    if (!r.payload) continue;
    const team = String(r.payload.team ?? "Équipe");
    // L'heure portée par le bloc (arrondie) ; sinon celle du stockage : une vieille demande n'est pas « en attente ».
    const data = { ...r.payload, step: r.payload.step ? step(r.payload.step) : r.payload.step, at: r.payload.at ?? r.at };
    byTeam.set(team, [...(byTeam.get(team) ?? []), { seq: r.id, kind: k, data }]);
  }
  for (const [team, list] of byTeam) board.add(team, team, 0, list as any);
  const st = board.state(now);
  const live = Board.liveView(st, now);

  // Tableau des étapes sur 7 jours, avec l'état selon la règle de Haytham.
  const since = now - WEEK_MS;
  const signatures = rows.signature.filter((r) => r.payload?.step && Date.parse(r.at || r.payload.day) >= since).map((r) => step(r.payload.step));
  const solutions = rows.solution.map((r) => r.payload).filter(Boolean);
  const answered = new Set(solutions.map((s) => s.requestId).filter(Boolean));
  const pending = new Set(st.pending.map((p) => norm(p.step)));
  const certified = new Set(solutions.filter((s) => s.certified).map((s) => norm(step(s.step ?? ""))));
  const solved = new Set([...solutions.map((s) => norm(step(s.step ?? ""))), ...rows.request.filter((r) => answered.has(r.payload?.requestId)).map((r) => norm(step(r.payload.step)))]);
  const counts = new Map<string, { step: string; n: number }>();
  for (const s of signatures) { const e = counts.get(norm(s)) ?? { step: s, n: 0 }; e.n++; counts.set(norm(s), e); }
  for (const p of st.pending) if (!counts.has(norm(p.step))) counts.set(norm(p.step), { step: p.step, n: 0 });
  const status = (k: string) => (pending.has(k) ? "en attente de réponse" : certified.has(k) ? "règle certifiée" : solved.has(k) ? "solution partagée" : "à documenter");

  return {
    "en-attente": live["en-attente"],
    resolues: live.resolues,
    detours: { value: range(signatures.length), label: "détours sur des étapes de process", unit: "7 jours" },
    // Trié par état (ce qui demande une action d'abord), puis par détours ; 8 lignes pour tenir à l'écran.
    etapes: { items: [...counts.entries()]
      .map(([k, e]) => ({ ...e, status: status(k) }))
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.n - a.n)
      .slice(0, ROWS)
      .map((e) => ({ label: short(e.step), value: range(e.n), status: e.status })) },
    nuit: { items: (live.nuit as { items: unknown[] }).items.slice(0, 5) },
  };
}

async function listAll(store: TeamStore, kind: Kind) {
  const out: { id: number; at: string; payload: any }[] = [];
  for (let after = 0; ; ) {
    const page = await store.list(kind, after);
    if (!page.length) return out;
    out.push(...page);
    after = page.at(-1)!.id;
  }
}

/** Remplit chaque bloc de la Live View. Renvoie les blocs mis à jour. */
export async function publishMap(store: TeamStore): Promise<string[]> {
  const payloads = await buildMap(store);
  const r = await fetch(`${API}/outputs/targets?pipe=${MAP_PIPE}`, { headers: auth });
  if (!r.ok) throw new Error(`/outputs/targets HTTP ${r.status}`);
  const targets = ((await r.json()).data ?? []) as { id: string; revision: number }[];
  const done: string[] = [];
  for (const t of targets) {
    const block = t.id.split(":").at(-1)!;
    const payload = (payloads as Record<string, unknown>)[block];
    if (!payload) continue;
    const s = await fetch(`${API}/outputs/targets/${encodeURIComponent(t.id)}/submit`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ target_revision: t.revision, source_pipe: MAP_PIPE, payload }),
    });
    if (!s.ok) throw new Error(`soumission ${t.id} : HTTP ${s.status} ${(await s.text()).slice(0, 200)}`);
    done.push(block);
  }
  return done;
}
