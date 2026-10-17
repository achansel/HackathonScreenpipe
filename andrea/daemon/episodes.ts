// Transforme le flux de frames et d'événements d'entrée en épisodes :
// une fenêtre dont le texte a changé puis est resté stable DEBOUNCE_MS.
// Rien n'est conservé au-delà de LOOKBACK_MS.
import { DEBOUNCE_MS, IGNORE, LOOKBACK_MS } from "./config";
import type { Item } from "./screenpipe";

export type Episode = {
  id: string;
  app: string;
  window: string;
  titles: string[]; // fenêtres traversées récemment, dans l'ordre
  text: string; // texte nouveau de la fenêtre, nettoyé
  at: number;
};

type WindowState = { app: string; window: string; lastWords: Set<string>; delta: string[]; changedAt: number };

const t = (c: Item) => new Date(c.timestamp).getTime();
const words = (s: string) => s.split(/\s+/).filter(Boolean);

// Texte d'interface répété (barres d'outils, menus) : 5-grammes présents dans ≥ 40 % des
// dernières frames d'une appli. Chiffres normalisés pour ignorer les compteurs qui bougent.
const recentByApp = new Map<string, string[][]>();
function interfaceGrams(app: string): Set<string> {
  const frames = recentByApp.get(app) ?? [];
  if (frames.length < 8) return new Set();
  const df = new Map<string, number>();
  for (const w of frames) {
    const seen = new Set<string>();
    for (let i = 0; i + 5 <= w.length; i++) seen.add(w.slice(i, i + 5).join(" "));
    for (const g of seen) df.set(g, (df.get(g) ?? 0) + 1);
  }
  return new Set([...df].filter(([, n]) => n / frames.length >= 0.4).map(([g]) => g));
}
function clean(app: string, text: string): string[] {
  const w = words(text);
  const norm = w.map((x) => x.replace(/\d/g, "#"));
  const list = recentByApp.get(app) ?? [];
  list.push(norm);
  if (list.length > 40) list.shift();
  recentByApp.set(app, list);
  const bp = interfaceGrams(app);
  const drop = new Array(w.length).fill(false);
  for (let i = 0; i + 5 <= w.length; i++) if (bp.has(norm.slice(i, i + 5).join(" "))) for (let k = i; k < i + 5; k++) drop[k] = true;
  return w.filter((_, i) => !drop[i]);
}

export class EpisodeBuilder {
  private windows = new Map<string, WindowState>();
  private titles: { at: number; title: string }[] = [];
  private seq = 0;

  addInput(ev: Item) {
    if (!["app_switch", "window_focus"].includes(ev.event_type)) return;
    const title = `${ev.app_name ?? ""} | ${ev.window_title ?? ""}`;
    if (IGNORE.test(title)) return;
    if (this.titles.at(-1)?.title !== title) this.titles.push({ at: t(ev), title });
  }

  addFrame(f: Item) {
    const app = f.app_name ?? "";
    const window = f.window_name ?? "";
    if (!f.text || IGNORE.test(`${app} ${window}`)) return;
    // Firefox : le texte d'accessibilité peut venir d'un autre onglet (mesuré) → OCR seulement.
    if (/firefox/i.test(app) && f.text_source === "accessibility") return;
    const key = `${app}|${window}`;
    const st = this.windows.get(key) ?? { app, window, lastWords: new Set<string>(), delta: [], changedAt: 0 };
    const w = clean(app, f.text);
    const fresh = st.lastWords.size ? w.filter((x) => !st.lastWords.has(x)) : w;
    st.lastWords = new Set(w);
    if (fresh.length >= 3) {
      st.delta.push(fresh.join(" "));
      st.changedAt = t(f);
    }
    this.windows.set(key, st);
  }

  /** Épisodes prêts : texte changé puis stable depuis DEBOUNCE_MS. Chaque changement ne sort qu'une fois. */
  ready(now: number): Episode[] {
    const out: Episode[] = [];
    this.titles = this.titles.filter((x) => now - x.at < LOOKBACK_MS);
    for (const [key, st] of this.windows) {
      if (now - st.changedAt > LOOKBACK_MS) { this.windows.delete(key); continue; }
      if (!st.delta.length || now - st.changedAt < DEBOUNCE_MS) continue;
      out.push({
        id: `ep${now.toString(36)}${(this.seq++).toString(36)}`,
        app: st.app,
        window: st.window,
        titles: this.titles.map((x) => x.title).slice(-8),
        text: st.delta.join(" ").slice(-1500),
        at: st.changedAt,
      });
      st.delta = [];
    }
    return out;
  }
}
