// Transforme le flux de frames et d'événements d'entrée en épisodes :
// une fenêtre dont le texte a changé (après sa première frame) puis est resté stable DEBOUNCE_MS.
// Rien n'est conservé au-delà de LOOKBACK_MS.
import { BASELINE_MS, BROWSERS, DEBOUNCE_MS, IGNORE, LOOKBACK_MS, SCOPE } from "./config";
import type { Item } from "./screenpipe";

export type Episode = {
  id: string;
  app: string;
  window: string;
  titles: string[]; // fenêtres traversées récemment, dans l'ordre
  text: string; // texte nouveau de la fenêtre, nettoyé
  at: number;
};

// lastWords : empreintes des mots de la dernière frame (pas le texte), pour reconnaître ce qui est nouveau
// quand on revient sur une fenêtre ; seenAt : dernière frame vue.
type WindowState = { app: string; window: string; lastWords: Set<string>; delta: string[]; changedAt: number; seenAt: number };

const t = (c: Item) => new Date(c.timestamp).getTime();
// Domaine seulement : l'URL entière peut citer l'outil sans en être (mesuré : connexion Google
// accounts.google.com/…?continue=…hubspot… lue comme HubSpot).
const host = (url: string) => { try { return new URL(url).hostname; } catch { return ""; } };
const inScope = (app: string, window: string, url = "") => (BROWSERS.test(app) ? SCOPE.test(`${window} ${host(url)}`) : SCOPE.test(app));
// Identifiant déterministe (fenêtre + instant du changement) : le rejeu hors ligne ne double pas un épisode.
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
const words = (s: string) => s.split(/\s+/).filter(Boolean);
// Même fenêtre malgré les compteurs de non-lus du titre (mesuré : « 💬1 - Jean Dupont | Crisp »,
// « bugs (Channel) - Piping Company - 4 new items - Slack ») : sinon un message reçu ferait une
// « nouvelle » fenêtre, prise comme référence, et le message serait raté.
const windowKey = (w: string) => w.replace(/^(\(\d+\)|\S*\d+\S*\s+-)\s+/, "").replace(/\s-\s\d+ new items?/g, "").replace(/\d+/g, "#");

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

  addInput(ev: Item) {
    if (!["app_switch", "window_focus"].includes(ev.event_type)) return;
    const title = `${ev.app_name ?? ""} | ${ev.window_title ?? ""}`;
    if (IGNORE.test(`${title} ${host(ev.browser_url ?? "")}`) || !inScope(ev.app_name ?? "", ev.window_title ?? "", ev.browser_url)) return;
    if (this.titles.at(-1)?.title !== title) this.titles.push({ at: t(ev), title });
  }

  addFrame(f: Item) {
    const app = f.app_name ?? "";
    const window = f.window_name ?? "";
    if (!f.text || IGNORE.test(`${app} ${window} ${host(f.browser_url ?? "")}`) || !inScope(app, window, f.browser_url)) return;
    // Firefox : le texte d'accessibilité peut venir d'un autre onglet (mesuré) → OCR seulement.
    if (/firefox/i.test(app) && f.text_source === "accessibility") return;
    const key = `${app}|${windowKey(window)}`;
    const w = clean(app, f.text);
    // Première frame d'une fenêtre = référence, pas un épisode : ce qui est déjà affiché à
    // l'ouverture est de l'historique (mesuré : canal Slack ouvert → question d'un collègue de la
    // veille qualifiée en friction). Changer de canal ou de page change le titre, donc la fenêtre.
    // Les résultats d'une recherche HubSpot s'affichent dans la même page (mesuré) : détectés.
    if (!this.windows.has(key)) {
      this.windows.set(key, { app, window, lastWords: new Set(w.map(hash)), delta: [], changedAt: t(f), seenAt: t(f) });
      return;
    }
    const st = this.windows.get(key)!;
    const fresh = w.filter((x) => !st.lastWords.has(hash(x)));
    st.lastWords = new Set(w.map(hash));
    st.seenAt = t(f);
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
      if (now - st.seenAt > BASELINE_MS) { this.windows.delete(key); continue; }
      if (now - st.changedAt > LOOKBACK_MS) st.delta = []; // le texte, lui, n'est pas gardé au-delà de 3 min
      if (!st.delta.length || now - st.changedAt < DEBOUNCE_MS) continue;
      out.push({
        id: `ep${st.changedAt.toString(36)}${hash(key)}`,
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
