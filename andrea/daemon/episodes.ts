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

// seen : empreintes des mots déjà vus dans la fenêtre (pas le texte), toutes frames confondues : Slack
// alterne OCR (~240 mots) et accessibilité (220 puis 750 mots, historique chargé) [mesuré], comparer à la
// seule frame précédente ferait passer l'historique pour nouveau. seenAt : dernière frame vue.
type WindowState = { app: string; window: string; seen: Set<string>; delta: string[]; changedAt: number; seenAt: number; search: string; searchAt?: number; searchWords?: number };
// Paramètre de recherche de l'URL (noms usuels du web, aucune appli en particulier).
const SEARCH_PARAM = /^(q|query|search|term|keyword|s)$/i;
const searchTerm = (url: string) => { try { for (const [k, v] of new URL(url).searchParams) if (SEARCH_PARAM.test(k) && v.trim()) return v.trim(); } catch {} return ""; };
const SEEN_MAX = 20_000;
const CONTEXT = 4; // mots gardés de part et d'autre d'un mot nouveau
const SEARCH_SETTLE_MS = 6000; // une recherche attend 6 s de calme avant de partir (résultat affiché)
const SEARCH_WORDS = 120; // derniers mots de la page gardés avec une nouvelle recherche (mesuré : « 0 contacts » vers la fin)

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
  // Dernière URL vue par titre de fenêtre : sous Windows, les captures OCR n'ont pas d'URL (mesuré), et
  // « Contacts | All contacts » ne dit pas HubSpot. Même titre, même onglet : on reprend son URL.
  private urlByWindow = new Map<string, string>();

  addInput(ev: Item) {
    if (!["app_switch", "window_focus"].includes(ev.event_type)) return;
    const title = `${ev.app_name ?? ""} | ${ev.window_title ?? ""}`;
    if (IGNORE.test(`${title} ${host(ev.browser_url ?? "")}`) || !inScope(ev.app_name ?? "", ev.window_title ?? "", ev.browser_url)) return;
    if (this.titles.at(-1)?.title !== title) this.titles.push({ at: t(ev), title });
  }

  addFrame(f: Item) {
    const app = f.app_name ?? "";
    const window = f.window_name ?? "";
    if (f.browser_url) this.urlByWindow.set(`${app}|${window}`, f.browser_url);
    else if (this.urlByWindow.has(`${app}|${window}`)) f = { ...f, browser_url: this.urlByWindow.get(`${app}|${window}`) };
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
      this.windows.set(key, { app, window, seen: new Set(w.map(hash)), delta: [], changedAt: t(f), seenAt: t(f), search: searchTerm(f.browser_url ?? "") });
      return;
    }
    const st = this.windows.get(key)!;
    const isFresh = w.map((x) => !st.seen.has(hash(x)));
    for (const x of w) { st.seen.delete(hash(x)); st.seen.add(hash(x)); } // ordre = récence, pour l'éviction
    for (const h of st.seen) { if (st.seen.size <= SEEN_MAX) break; st.seen.delete(h); }
    st.seenAt = t(f);
    // Une nouvelle recherche dans l'URL est un geste de l'utilisateur, même si la page ne change presque pas :
    // deux recherches à 0 résultat de suite n'apportent qu'un mot nouveau (mesuré le 17/10, HubSpot).
    const term = searchTerm(f.browser_url ?? "");
    // Page brute, sans le filtre du texte d'interface : « No Contacts match » revient à chaque recherche vide,
    // il serait retiré comme de l'interface (mesuré). La fin de la page : le résultat suit la navigation.
    const raw = words(f.text);
    const searchText = () => `Recherche « ${st.search} » : ${raw.slice(-SEARCH_WORDS).join(" ")}`;
    if (term && term !== st.search) {
      st.search = term;
      st.delta.push(searchText());
      st.searchAt = st.delta.length - 1;
      st.searchWords = raw.length;
      st.changedAt = t(f);
    } else if ((!term || term === st.search) && st.searchAt !== undefined && st.searchAt < st.delta.length && raw.length > (st.searchWords ?? 0)) {
      // Même recherche, page plus remplie (mesuré : la 1re capture précède l'affichage du résultat ; sous
      // Windows, les captures OCR n'ont pas d'URL et c'est souvent elles qui montrent le résultat).
      st.delta[st.searchAt] = searchText();
      st.searchWords = raw.length;
      st.changedAt = t(f);
    } else if (isFresh.filter(Boolean).length >= 3) {
      // Chaque mot nouveau garde ses voisins : « On peut offrir qqchose a un client premium ou quoi »
      // ne doit pas perdre « un client premium », déjà vu dans l'historique du canal (mesuré).
      const keep = w.map((_, i) => isFresh.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1).some(Boolean));
      st.delta.push(w.filter((_, i) => keep[i]).join(" "));
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
      // Une recherche attend son résultat : les captures arrivent toutes les ~3 s (mesuré).
      if (!st.delta.length || now - st.changedAt < (st.searchAt !== undefined ? SEARCH_SETTLE_MS : DEBOUNCE_MS)) continue;
      out.push({
        id: `ep${st.changedAt.toString(36)}${hash(key)}`,
        app: st.app,
        window: st.window,
        titles: this.titles.map((x) => x.title).slice(-8),
        text: st.delta.join(" ").slice(-1500),
        at: st.changedAt,
      });
      st.delta = [];
      st.searchAt = undefined;
    }
    return out;
  }
}
