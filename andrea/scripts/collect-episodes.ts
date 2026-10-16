// Extrait de Screenpipe des ÉPISODES réels (sessions d'activité sur les applis de travail) pour
// bâtir un jeu de test : titres de fenêtres, texte nettoyé (delta), événements d'entrée horodatés.
// Sortie 100 % locale dans andrea/bench/real/ (ignoré par git : contient du texte d'écran réel).
//
// Garde-fous : liste blanche d'applis de travail + liste noire de services perso ; Firefox : le
// texte d'accessibilité est ignoré (il peut venir d'un autre onglet) ; e-mails, téléphones et
// IBAN masqués. L'étiquetage se fait ensuite à la main dans andrea/bench/real/labels.csv.
//
// Usage : source ~/.config/screenpipe/env && bun andrea/scripts/collect-episodes.ts
//         [--depuis 2026-10-16T18:30] [--autorise "slack|crisp|hubspot"] [--ecart 45]
import { mkdirSync, writeFileSync } from "node:fs";

const KEY = process.env.SCREENPIPE_API_KEY;
const URL_ = process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
if (!KEY) { console.error("SCREENPIPE_API_KEY manquant : source ~/.config/screenpipe/env"); process.exit(1); }

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const depuis = new Date(arg("depuis", new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 16)));
const ALLOW = new RegExp(arg("autorise", "slack|crisp|hubspot"), "i");
const DENY = /mail\.google|gmail|whatsapp|spotify|discord|claude|anthropic|paypal|banque|bank|netflix|youtube|task switching|ms-teams|teams\.(live|microsoft)/i;
const GAP_MS = Number(arg("ecart", "45")) * 1000; // silence qui coupe deux épisodes
const headers = { Authorization: `Bearer ${KEY}` };

type C = Record<string, any>;
async function fetchAll(contentType: string): Promise<C[]> {
  const out: C[] = [];
  for (let off = 0; off < 20000; off += 200) {
    const q = new URLSearchParams({ content_type: contentType, order: "ascending", limit: "200", offset: String(off), start_time: depuis.toISOString() });
    const r = await fetch(`${URL_}/search?${q}`, { headers });
    if (!r.ok) throw new Error(`/search ${contentType}: HTTP ${r.status}`);
    const page = ((await r.json()).data ?? []) as { content: C }[];
    if (!page.length) break;
    out.push(...page.map((p) => p.content));
  }
  return out;
}

const host = (u?: string) => { try { return new URL(u ?? "").hostname; } catch { return ""; } };
const ctxOf = (c: C) => `${c.app_name ?? ""} ${c.window_name ?? c.window_title ?? ""} ${host(c.browser_url)}`;
const permis = (c: C) => ALLOW.test(ctxOf(c)) && !DENY.test(ctxOf(c));

const redact = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
  .replace(/\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{4}[ ]?){3,7}[A-Z0-9]{1,4}\b/g, "<iban>")
  .replace(/(?:\+|00)\d[\d .-]{8,14}\d/g, "<tel>");

console.error(`collecte depuis ${depuis.toISOString()} (allow=${ALLOW.source})`);
const [frames, inputs] = await Promise.all([fetchAll("ocr"), fetchAll("input")]);

// 1. Garder les frames de travail ; Firefox : pas de texte d'accessibilité (onglet possiblement faux)
const gardees = frames.filter((c) => permis(c) && c.text && !(/firefox/i.test(c.app_name ?? "") && c.text_source === "accessibility"));

// 2. Retirer le texte d'interface répété : tout 5-gramme de mots présent dans ≥40 % des frames d'une appli
const parAppli = new Map<string, C[]>();
for (const c of gardees) (parAppli.get(c.app_name) ?? parAppli.set(c.app_name, []).get(c.app_name)!).push(c);
const motsDe = (t: string) => t.split(/\s+/).filter(Boolean);
const norm = (w: string[]) => w.map((x) => x.replace(/\d/g, "#"));
const boilerplate = new Map<string, Set<string>>();
for (const [app, fs] of parAppli) {
  const df = new Map<string, number>();
  for (const f of fs) { const w = norm(motsDe(f.text)), seen = new Set<string>(); for (let i = 0; i + 5 <= w.length; i++) seen.add(w.slice(i, i + 5).join(" ")); for (const g of seen) df.set(g, (df.get(g) ?? 0) + 1); }
  boilerplate.set(app, new Set([...df].filter(([, n]) => fs.length >= 8 && n / fs.length >= 0.4).map(([g]) => g)));
}
function nettoie(c: C): string {
  const w = motsDe(c.text), wn = norm(w), bp = boilerplate.get(c.app_name) ?? new Set<string>(), drop = new Array(w.length).fill(false);
  for (let i = 0; i + 5 <= w.length; i++) if (bp.has(wn.slice(i, i + 5).join(" "))) for (let k = i; k < i + 5; k++) drop[k] = true;
  return redact(w.filter((_, i) => !drop[i]).join(" "));
}

// 3. Épisodes : suites d'activité séparées par un silence ≥ GAP ; texte = delta par fenêtre
const t = (c: C) => new Date(c.timestamp).getTime();
gardees.sort((a, b) => t(a) - t(b));
const episodes: C[] = [];
let cur: C | null = null;
const dernierParFenetre = new Map<string, Set<string>>();
for (const c of gardees) {
  if (!cur || t(c) - cur.finMs > GAP_MS) {
    cur = { debutMs: t(c), finMs: t(c), apps: new Set<string>(), titres: [] as string[], textes: [] as string[], sources: {} as Record<string, number>, frames: 0 };
    episodes.push(cur); dernierParFenetre.clear();
  }
  cur.finMs = t(c); cur.frames++; cur.apps.add(c.app_name);
  const titre = redact(c.window_name ?? "");
  if (cur.titres.at(-1) !== titre) cur.titres.push(titre);
  cur.sources[c.text_source] = (cur.sources[c.text_source] ?? 0) + 1;
  const mots = motsDe(nettoie(c)), cleF = `${c.app_name}|${titre}`, vus = dernierParFenetre.get(cleF);
  const nouveaux = vus ? mots.filter((m) => !vus.has(m)) : mots;
  dernierParFenetre.set(cleF, new Set(mots));
  if (nouveaux.length >= 3) cur.textes.push(nouveaux.join(" ").slice(0, 600));
}

// 4. Événements d'entrée (changements d'appli/fenêtre) rattachés à chaque épisode
const evts = inputs.filter((c) => ["app_switch", "window_focus"].includes(c.event_type) && permis({ app_name: c.app_name, window_name: c.window_title, browser_url: c.browser_url }));
const sortie = episodes.filter((e) => e.frames >= 3 && (e.textes.length > 0 || e.titres.length > 1)).map((e, i) => ({
  id: `ep${String(i + 1).padStart(3, "0")}`,
  debut: new Date(e.debutMs).toISOString(), fin: new Date(e.finMs).toISOString(), duree_s: Math.round((e.finMs - e.debutMs) / 1000),
  apps: [...e.apps], titres: e.titres, texte: e.textes.slice(0, 8), frames: e.frames, sources: e.sources,
  evenements: evts.filter((x) => t(x) >= e.debutMs - 2000 && t(x) <= e.finMs + 2000).map((x) => ({ t: x.timestamp, type: x.event_type, app: x.app_name, titre: redact(x.window_title ?? "") })),
}));

const OUT = new URL("../bench/real/", import.meta.url).pathname; // andrea/bench/real/, quel que soit le cwd
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}episodes.jsonl`, sortie.map((e) => JSON.stringify(e)).join("\n") + "\n");
const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
writeFileSync(`${OUT}labels.csv`, "id;debut;duree_s;apps;titres;apercu;etiquette\n" + sortie.map((e) =>
  [e.id, new Date(e.debut).toLocaleTimeString("fr-FR"), e.duree_s, e.apps.join("+"), e.titres.slice(0, 4).join(" → "), (e.texte[0] ?? "").slice(0, 160), ""].map((x) => esc(String(x))).join(";")).join("\n") + "\n");

const parApp: Record<string, number> = {};
for (const e of sortie) for (const a of e.apps) parApp[a] = (parApp[a] ?? 0) + 1;
console.log(`frames lues: ${frames.length} | gardées (travail): ${gardees.length} | événements d'entrée lus: ${inputs.length}`);
console.log(`épisodes écrits: ${sortie.length} | par appli: ${JSON.stringify(parApp)}`);
console.log(`fichiers: ${OUT}episodes.jsonl, ${OUT}labels.csv`);
