// Tableau « Frictions en direct » : ce que vit l'équipe, calculé sur le poste à partir des blocs déchiffrés
// (demandes, solutions, signatures). Affiché dans la page, et publié dans une Live View Screenpipe.
// Rien de personnel : des étapes, des compteurs, des délais. Jamais qui a bloqué.
import type { Received } from "../client";

type Ev = { key: string; team: string; kind: string; data: any; seenAt: number };
export interface BoardState {
  pending: { requestId: string; step: string; team: string; since: number }[];
  today: number;
  resolved: { step: string; delayMs: number }[];
  certified: number;
  steps: { step: string; n: number; status: string }[];
  timeline: { at: number; title: string; subtitle: string }[];
}

const DAY = 86_400_000;
const fmt = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : ms < 3_600_000 ? `${Math.floor(ms / 60_000)} min ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")} s` : `${Math.floor(ms / 3_600_000)} h`);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export class Board {
  private events = new Map<string, Ev>();
  private epochs = new Map<string, number>();
  private firstSeen = new Map<string, number>(); // requestId → heure vue avant un changement de clé
  private extra: { at: number; title: string; subtitle: string }[] = []; // événements gardés après un changement de clé

  /** Ajoute ce qu'un poste vient de relire pour une équipe. Un changement d'époque (clé changée) repart de zéro
   *  pour cette équipe : les blocs républiés arrivent avec de nouveaux numéros et ne doivent pas compter double. */
  add(teamId: string, teamName: string, epoch: number, rows: Received[]) {
    const prev = this.epochs.get(teamId);
    if (prev !== undefined && epoch !== prev) {
      for (const [k, e] of this.events) if (k.startsWith(`${teamId}:`)) {
        if (e.kind === "request" && e.data.requestId) this.firstSeen.set(e.data.requestId, e.seenAt); // l'attente ne repart pas de zéro
        this.events.delete(k);
      }
      this.extra.push({ at: Date.now(), title: `Clé changée · ${teamName}`, subtitle: `époque ${epoch} : un membre est parti, les solutions sont conservées` });
    }
    this.epochs.set(teamId, epoch);
    const now = Date.now();
    for (const r of rows) {
      const key = `${teamId}:${r.seq}`;
      if (this.events.has(key) || !r.data) continue;
      // Heure vue sur ce poste ; pour l'historique déjà en base, l'heure (arrondie) portée par la demande si plus ancienne.
      const at = typeof r.data.at === "string" ? Date.parse(r.data.at) : NaN;
      const kept = r.kind === "request" ? this.firstSeen.get(r.data.requestId) : undefined;
      this.events.set(key, { key, team: teamName, kind: r.kind, data: r.data, seenAt: kept ?? (Number.isNaN(at) ? now : Math.min(now, at + 600_000)) });
    }
  }

  state(now = Date.now()): BoardState {
    const evs = [...this.events.values()];
    const day = new Date(now).toISOString().slice(0, 10);
    const answered = new Map<string, Ev>();
    for (const e of evs) if (e.kind === "solution" && e.data.requestId && !answered.has(e.data.requestId)) answered.set(e.data.requestId, e);
    const requests = evs.filter((e) => e.kind === "request" && e.data.requestId && now - e.seenAt < DAY);
    const pending = requests.filter((r) => !answered.has(r.data.requestId)).map((r) => ({ requestId: r.data.requestId, step: r.data.step, team: r.team, since: r.seenAt })).sort((a, b) => a.since - b.since);
    const resolved = requests.filter((r) => answered.has(r.data.requestId)).map((r) => ({ step: r.data.step, delayMs: Math.max(0, answered.get(r.data.requestId)!.seenAt - r.seenAt) }));
    const sigs = evs.filter((e) => e.kind === "signature" && e.data.day === day);
    const sols = evs.filter((e) => e.kind === "solution");
    const certifiedIds = new Set(sols.filter((s) => s.data.certified).map((s) => s.data.id));
    const byStep = new Map<string, number>();
    for (const s of sigs) byStep.set(s.data.step, (byStep.get(s.data.step) ?? 0) + 1);
    for (const p of pending) if (!byStep.has(p.step)) byStep.set(p.step, 0);
    const solvedSteps = new Set(sols.map((s) => s.data.step));
    const certSteps = new Set(sols.filter((s) => s.data.certified).map((s) => s.data.step));
    const pendingSteps = new Set(pending.map((p) => p.step));
    const steps = [...byStep.entries()].sort((a, b) => b[1] - a[1]).map(([step, n]) => ({
      step, n,
      status: pendingSteps.has(step) ? "en attente de réponse" : certSteps.has(step) ? "règle certifiée" : solvedSteps.has(step) ? "solution partagée" : "à documenter",
    }));
    const timeline = [
      ...requests.map((r) => ({ at: r.seenAt, title: `Demande anonyme · ${r.data.step}`, subtitle: `${r.team} · ${answered.has(r.data.requestId) ? `réponse en ${fmt(answered.get(r.data.requestId)!.seenAt - r.seenAt)}` : "en attente"}` })),
      ...sols.map((s) => ({ at: s.seenAt, title: `${s.data.certified ? "Règle certifiée" : s.data.requestId ? "Solution partagée" : "Solution ajoutée"} · ${s.data.title ?? s.data.step}`, subtitle: `${s.team}${s.data.certified ? " · signée par la responsable" : ""}` })),
      ...this.extra,
    ].sort((a, b) => b.at - a.at).slice(0, 20);
    return { pending, today: sigs.length, resolved, certified: certifiedIds.size, steps, timeline };
  }

  /** Les blocs de la Live View Screenpipe « friction-live » (formats lus dans /outputs/targets). */
  static liveView(s: BoardState, now = Date.now()) {
    const oldest = s.pending[0];
    return {
      "en-attente": { value: s.pending.length, label: "demandes sans réponse", ...(oldest ? { delta: `la plus ancienne attend depuis ${fmt(now - oldest.since)}` } : {}) },
      "aujourdhui": { value: s.today, label: "frictions aujourd'hui", unit: "détours" },
      "resolues": { value: s.resolved.length, label: "demandes résolues par un collègue", ...(s.resolved.length ? { delta: `délai médian ${fmt(median(s.resolved.map((r) => r.delayMs)))}` } : {}) },
      "regles": { value: s.certified, label: "règles certifiées par une responsable" },
      "attente": { items: s.pending.slice(0, 20).map((p) => ({ id: p.requestId, title: p.step, subtitle: `${p.team} · personne n'a encore répondu`, status: `en attente depuis ${fmt(now - p.since)}`, source: p.team })) },
      "fil": { items: s.timeline.map((t) => ({ title: t.title.slice(0, 200), timestamp: new Date(t.at).toISOString(), subtitle: t.subtitle.slice(0, 500) })) },
      "etapes": { items: s.steps.slice(0, 50).map((x) => ({ label: x.step.slice(0, 200), value: x.n, status: x.status })) },
      "regles-lecture": { content: [
        "**On mesure le process, jamais la personne.** Les demandes sont anonymes, les blocs chiffrés sur les postes : ce tableau est calculé ici, à partir de ce que l'équipe partage.",
        `Mis à jour en direct (${new Date(now).toLocaleTimeString("fr-FR")}).`,
      ].join("\n\n") },
    };
  }

  /** Le même tableau, dans la page. */
  static html(s: BoardState, now = Date.now()) {
    const tile = (v: unknown, l: string, d = "", tone = "") => `<div class="tile ${tone}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div>${d ? `<div class="d">${esc(d)}</div>` : ""}</div>`;
    const oldest = s.pending[0];
    return `<div class="tiles">
      ${tile(s.pending.length, "demandes sans réponse", oldest ? `depuis ${fmt(now - oldest.since)}` : "", s.pending.length ? "warn" : "")}
      ${tile(s.today, "frictions aujourd'hui")}
      ${tile(s.resolved.length, "résolues par un collègue", s.resolved.length ? `médiane ${fmt(median(s.resolved.map((r) => r.delayMs)))}` : "", s.resolved.length ? "ok" : "")}
      ${tile(s.certified, "règles certifiées")}</div>
      <div class="bcols">
        <div><h4>En attente</h4>${s.pending.length ? s.pending.map((p) => `<div class="pend"><b>${esc(p.step)}</b><span>${esc(p.team)} · ${fmt(now - p.since)}</span></div>`).join("") : '<p class="muted">Aucune demande en attente.</p>'}
          <h4>Étapes</h4><table>${s.steps.map((x) => `<tr><td>${esc(x.step)}</td><td>${x.n}</td><td class="st-${x.status.split(" ")[0]}">${esc(x.status)}</td></tr>`).join("") || '<tr><td class="muted">—</td></tr>'}</table></div>
        <div><h4>Fil en direct</h4>${s.timeline.map((t) => `<div class="ev"><span class="muted">${new Date(t.at).toLocaleTimeString("fr-FR")}</span> <b>${esc(t.title)}</b><br><span class="muted">${esc(t.subtitle)}</span></div>`).join("") || '<p class="muted">—</p>'}</div>
      </div>`;
  }
}
