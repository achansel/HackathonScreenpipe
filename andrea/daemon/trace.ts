// Trace de l'agent de CE poste (Live View « Mon agent, en direct ») : ce que fait le démon, étape par étape,
// pour le voir travailler (démo, confiance). Elle reste sur ce poste : jamais publiée à l'équipe, sans texte
// d'écran ; des étapes, des délais, l'aide affichée.
import { API, KEY } from "./config";

export const AGENT_PIPE = "friction-agent";
export const AGENT_DEEPLINK = "screenpipe://live-view/friction-agent";
const auth = { Authorization: `Bearer ${KEY}` };
const events: { at: number; title: string; subtitle: string }[] = [];
const stats = { judged: 0, frictions: 0 };
let lastHelp: { ms: number; title: string } | null = null;
let dirty = true;

const fmt = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);
export const seconds = fmt;

export function trace(title: string, subtitle = "") {
  events.unshift({ at: Date.now(), title, subtitle });
  if (events.length > 20) events.length = 20;
  dirty = true;
}
export function judged(friction: boolean) {
  stats.judged++;
  if (friction) stats.frictions++;
  dirty = true;
}
export function helped(ms: number, title: string) {
  lastHelp = { ms, title };
  dirty = true;
}

/** Remplit la vue si quelque chose a changé. Une erreur ne remonte pas : la trace ne doit rien bloquer. */
export async function publishTrace() {
  if (!dirty) return;
  dirty = false;
  const blocks: Record<string, unknown> = {
    delai: lastHelp ? { value: fmt(lastHelp.ms), label: "entre le geste et l'aide", delta: lastHelp.title } : { value: "—", label: "pas encore d'aide" },
    jugees: { value: stats.judged, label: "épisodes jugés par le modèle", delta: `${stats.frictions} friction(s) retenue(s)` },
    etapes: { items: events.map((e) => ({ title: e.title.slice(0, 200), timestamp: new Date(e.at).toISOString(), subtitle: e.subtitle.slice(0, 500) })) },
  };
  try {
    const r = await fetch(`${API}/outputs/targets?pipe=${AGENT_PIPE}`, { headers: auth, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return;
    for (const t of ((await r.json()).data ?? []) as { id: string; revision: number }[]) {
      const payload = blocks[t.id.split(":").at(-1)!];
      if (!payload) continue;
      await fetch(`${API}/outputs/targets/${encodeURIComponent(t.id)}/submit`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ target_revision: t.revision, source_pipe: AGENT_PIPE, payload }),
      });
    }
  } catch {
    dirty = true; // nouvel essai au tour suivant
  }
}
