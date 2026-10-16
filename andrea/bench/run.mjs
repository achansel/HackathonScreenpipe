// Banc d'essai de méthodes de détection d'événement d'assistance, via l'API locale de Screenpipe.
// Usage : source ~/.config/screenpipe/env && node andrea/bench/run.mjs [modèle]
import vm from "node:vm";
import { CASES, LABELS } from "./dataset.mjs";

const KEY = process.env.SCREENPIPE_API_KEY;
const URL_ = process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
const MODEL = process.argv[2] ?? "claude-haiku-4-5";
if (!KEY) throw new Error("SCREENPIPE_API_KEY manquant (source ~/.config/screenpipe/env)");

const data = CASES.map(([label, app, titles, text], i) => ({ i, label, app, titles, text }));
const isTest = (c) => c.i % 2 === 1; // moitié pour entraîner la méthode « code généré », moitié pour juger
const TRAIN = data.filter((c) => !isTest(c));

// ---- appel au modèle via Screenpipe (OpenAI-compatible), avec reprise sur réponse vide
async function llm(system, user, { max = 300, tries = 3 } = {}) {
  for (let k = 0; k < tries; k++) {
    const t0 = performance.now();
    const r = await fetch(`${URL_}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: max, reasoning_effort: "low", stream: false,
        messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    const ms = performance.now() - t0;
    const j = await r.json().catch(() => ({}));
    const out = j.choices?.[0]?.message?.content ?? "";
    if (out.trim()) return { out, ms, retries: k };
    max *= 2;
  }
  return { out: "", ms: 0, retries: tries };
}
const pool = async (items, n, fn) => {
  const res = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (;;) { const k = next++; if (k >= items.length) return; res[k] = await fn(items[k], k); } }));
  return res;
};
const word = (s) => (String(s).toLowerCase().match(/[a-zé_]+/g) ?? []).find((w) => LABELS.includes(w)) ?? "?";

// ---- méthodes
const DEF = `Étiquettes: blocage (erreur, refus, champ obligatoire), demande_aide (question à un collègue), recherche (cherche une info), tatonnement (allers-retours, réessais), ressaisie (recopie la même donnée), contournement (astuce hors outil, fichier perso, capture), attente_relance (attend une réponse, relance), parcours (chemin de liens ou de pages anormalement long, retours en arrière, même page relue), aucun (travail normal, réponse courtoise, discussion sociale, message de succès, doc lue sans blocage).`;
const methods = {
  "A mots-clés (regex)": async (c) => {
    const t = `${c.text}`.toLowerCase();
    let l = "aucun";
    if (/erreur|error|impossible|refus|obligatoire|invalide|échou|denied|403|n'a pas pu/.test(t) && !/résolue|succès|enregistré/.test(t)) l = "blocage";
    else if (/des nouvelles|rappel|relance|toujours pas|en attente/.test(t)) l = "attente_relance";
    else if (/quelqu'un|svp|how do i|comment je fais|qq1|bloqu/.test(t)) l = "demande_aide";
    else if (/recherche|stack overflow|aide /.test(t)) l = "recherche";
    return { label: l, ms: 0 };
  },
  "B IA texte seul (1 mot)": async (c) => {
    const r = await llm(`Tu classes un court extrait d'activité à l'écran. Réponds par UN SEUL MOT. ${DEF}`, `[${c.app}] ${c.text}`, { max: 200 });
    return { label: word(r.out), ms: r.ms };
  },
  "C IA titres seuls (sans texte)": async (c) => {
    const r = await llm(`Tu classes une séquence de titres de fenêtres consultées (sans leur contenu). Réponds par UN SEUL MOT. ${DEF}`, `Appli: ${c.app}\nTitres dans l'ordre: ${c.titles.join(" → ")}`, { max: 200 });
    return { label: word(r.out), ms: r.ms };
  },
  "D IA texte + titres (1 mot)": async (c) => {
    const r = await llm(`Tu classes un extrait d'activité à l'écran. Réponds par UN SEUL MOT. ${DEF}`, `[${c.app}] Titres: ${c.titles.join(" → ")}\nTexte: ${c.text}`, { max: 200 });
    return { label: word(r.out), ms: r.ms };
  },
  "E IA binaire (friction oui/non)": async (c) => {
    const r = await llm(`Un employé a-t-il une friction ou un besoin d'aide dans cet extrait (blocage, question à un collègue, recherche, allers-retours, parcours de pages long ou répété, recopie, contournement, attente/relance) ? Réponds uniquement par oui ou non. Non si travail normal, réponse courtoise, discussion sociale, message de succès ou doc lue sans blocage.`, `[${c.app}] ${c.text}`, { max: 120 });
    return { label: /^\s*oui/i.test(r.out) ? "friction" : "aucun", ms: r.ms };
  },
};

// ---- méthode F : le modèle écrit lui-même le code de détection à partir d'exemples d'entraînement
async function generatedCode() {
  const ex = TRAIN.map((c) => `- ${c.label} | titres: ${c.titles.join(" → ")} | texte: ${c.text}`).join("\n");
  const r = await llm(
    `Tu écris du JavaScript. Écris une fonction pure \`classify(text, titles)\` (text: string, titles: string[]) qui renvoie exactement une de ces étiquettes: ${LABELS.join(", ")}. Aucune dépendance, aucun appel réseau. Utilise des règles générales (mots, structures, séquences de titres répétées), pas des phrases recopiées des exemples. Réponds uniquement par un bloc \`\`\`js\`\`\`.`,
    `Exemples d'entraînement:\n${ex}`, { max: 6000 });
  const code = r.out.match(/```(?:js|javascript)?\s*([\s\S]*?)```/)?.[1] ?? r.out;
  let fn = null;
  try { const ctx = vm.createContext({}); vm.runInContext(code + "\nthis.__f = classify;", ctx, { timeout: 500 }); fn = ctx.__f; } catch (e) { console.error("code généré invalide:", e.message); }
  return { fn, code, ms: r.ms };
}

// ---- métriques
const FR = (l) => (l === "aucun" ? "aucun" : "friction");
function score(rows) {
  const n = rows.length, ok = rows.filter((r) => r.pred === r.gold).length;
  const bin = rows.map((r) => [FR(r.gold), FR(r.pred)]);
  const tp = bin.filter(([g, p]) => g === "friction" && p === "friction").length;
  const fp = bin.filter(([g, p]) => g === "aucun" && p === "friction").length;
  const fn = bin.filter(([g, p]) => g === "friction" && p === "aucun").length;
  const prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1);
  const ms = rows.map((r) => r.ms).filter((x) => x > 0).sort((a, b) => a - b);
  return { acc: ok / n, prec, rec, f1: (2 * prec * rec) / (prec + rec || 1), fp, fn, med: ms.length ? ms[Math.floor(ms.length / 2)] / 1000 : 0, n };
}
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);

const results = [];
for (const [name, fn] of Object.entries(methods)) {
  const preds = await pool(data, name === "A mots-clés (regex)" ? 1 : 4, async (c) => ({ ...(await fn(c)), gold: name.startsWith("E ") ? FR(c.label) : c.label, i: c.i }));
  results.push({ name, rows: preds.map((p) => ({ gold: p.gold, pred: p.label, ms: p.ms, i: p.i })), binary: name.startsWith("E ") });
  console.error(`✓ ${name}`);
}
const g = await generatedCode();
if (g.fn) {
  const rows = data.map((c) => { let p = "?"; try { p = String(vm.runInNewContext("f(t,ti)", { f: g.fn, t: c.text, ti: c.titles }, { timeout: 100 })); } catch {} return { gold: c.label, pred: LABELS.includes(p) ? p : "?", ms: 0.001, i: c.i }; });
  results.push({ name: "F code écrit par l'IA (hors ligne)", rows });
}

// ---- méthode G : le code généré filtre (0 ms), l'IA (D) confirme seulement les candidats
const rowsD = results.find((m) => m.name.startsWith("D "))?.rows, rowsF = results.find((m) => m.name.startsWith("F "))?.rows;
if (rowsD && rowsF) {
  results.push({ name: "G filtre code → IA confirme (hybride)", rows: rowsF.map((f, k) => ({ gold: f.gold, i: f.i, pred: FR(f.pred) === "aucun" ? "aucun" : rowsD[k].pred, ms: FR(f.pred) === "aucun" ? 0.001 : rowsD[k].ms })) });
}

const nTest = data.filter(isTest).length;
for (const [title, filt] of [[`Tous les cas (${data.length})`, () => true], [`Cas de TEST seulement (${nTest}, jamais vus par la méthode F)`, (r) => r.i % 2 === 1]]) {
  console.log(`\n=== ${title}`);
  console.log("méthode".padEnd(36), "exact", "précis.", "rappel", "F1  ", "faux+", "faux−", "latence méd.");
  for (const m of results) {
    const rows = m.rows.filter(filt);
    const s = score(m.binary ? rows.map((r) => ({ ...r, gold: FR(r.gold), pred: r.pred })) : rows);
    const exact = m.binary ? "  —  " : pct(s.acc) + "  ";
    console.log(m.name.padEnd(36), exact, pct(s.prec) + "   ", pct(s.rec) + "  ", pct(s.f1), String(s.fp).padStart(4), String(s.fn).padStart(5), s.med ? `  ${s.med.toFixed(2)} s` : "  ~0 s");
  }
}
if (g.fn) console.log(`\n--- code généré (${g.code.split("\n").length} lignes, écrit en ${(g.ms / 1000).toFixed(1)} s) ---\n${g.code.slice(0, 1800)}`);
