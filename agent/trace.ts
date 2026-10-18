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
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;
/** Un changement part tout de suite (regroupé sur 150 ms), sans attendre la fin du tour de la boucle. */
function changed() {
  dirty = true;
  timer ??= setTimeout(() => { timer = undefined; void publishTrace(); }, 150);
}

const fmt = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);
export const seconds = fmt;

export function trace(title: string, subtitle = "") {
  events.unshift({ at: Date.now(), title, subtitle });
  if (events.length > 20) events.length = 20;
  changed();
}
export function judged(friction: boolean) {
  stats.judged++;
  if (friction) stats.frictions++;
  changed();
}
// Le parcours du dernier épisode, repris du parcours guidé de Haithem (teamstore/dashboard/parcours.ts : icône,
// étape, état). La Live View n'a pas de couleur (schéma vérifié) : l'état se lit à l'emoji.
type State = "done" | "active" | "miss" | "skip";
const STAGES = [
  ["crisp", "💬", "Crisp : message client lu"],
  ["model", "🧠", "Le modèle juge l'épisode"],
  ["card", "🪪", "Fiche HubSpot du client"],
  ["help", "💡", "Aide affichée"],
  ["team", "🔒", "Envoi chiffré à l'équipe"],
] as const;
type Stage = (typeof STAGES)[number][0];
const MARK: Record<State, string> = { done: "✅", active: "⏳", miss: "⚠️", skip: "▫️" };
const stages: Partial<Record<Stage, { state: State; detail: string }>> = {};

export function stage(key: Stage, state: State, detail = "") {
  stages[key] = { state, detail };
  changed();
}
/** Un nouvel épisode retenu : on repart de zéro, sauf la lecture de Crisp (le dossier dure 10 min). */
export function newEpisode() {
  for (const k of ["model", "card", "help", "team"] as const) delete stages[k];
  changed();
}
function parcours() {
  const md = (x: string) => x.replace(/[*_`[\]]/g, (c) => `\\${c}`);
  return STAGES.map(([k, icon, label]) => {
    const s = stages[k];
    return s ? `${MARK[s.state]} ${icon} **${label}**${s.detail ? ` · ${md(s.detail)}` : ""}` : `▫️ ${icon} ${label}`;
  }).join("\n\n");
}

export function helped(ms: number, title: string) {
  lastHelp = { ms, title };
  changed();
}

/** Remplit la vue si quelque chose a changé. Une erreur ne remonte pas : la trace ne doit rien bloquer. */
export async function publishTrace(): Promise<void> {
  if (running) return running; // une publication à la fois ; la suivante reprend ce qui a changé entre-temps
  // Après un échec, pas de nouvel essai immédiat : la boucle réessaie à son tour suivant.
  running = publish().then((ok) => { running = undefined; if (ok && dirty) changed(); });
  return running;
}

async function publish(): Promise<boolean> {
  if (!dirty) return true;
  dirty = false;
  const blocks: Record<string, unknown> = {
    delai: lastHelp ? { value: fmt(lastHelp.ms), label: "entre le geste et l'aide", delta: lastHelp.title } : { value: "—", label: "pas encore d'aide" },
    jugees: { value: stats.judged, label: "épisodes jugés par le modèle", delta: `${stats.frictions} friction(s) retenue(s)` },
    parcours: { content: parcours().slice(0, 10_000) },
    etapes: { items: events.map((e) => ({ title: e.title.slice(0, 200), timestamp: new Date(e.at).toISOString(), subtitle: e.subtitle.slice(0, 500) })) },
  };
  try {
    const r = await fetch(`${API}/outputs/targets?pipe=${AGENT_PIPE}`, { headers: auth, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) { dirty = true; return false; }
    for (const t of ((await r.json()).data ?? []) as { id: string; revision: number }[]) {
      const payload = blocks[t.id.split(":").at(-1)!];
      if (!payload) continue;
      await fetch(`${API}/outputs/targets/${encodeURIComponent(t.id)}/submit`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ target_revision: t.revision, source_pipe: AGENT_PIPE, payload }),
      });
    }
    return true;
  } catch {
    dirty = true; // nouvel essai au tour suivant de la boucle
    return false;
  }
}
