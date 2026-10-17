// Apprentissage hors ligne :
//   1. étiquette les épisodes collectés (modèle via Screenpipe, cache ; étiquettes humaines prioritaires) ;
//   2. génère le code d'un détecteur `detect(e)` à partir du jeu d'entraînement ;
//   3. le valide sur un jeu de test jamais vu, contre le détecteur approuvé ;
//   4. écrit un candidat + un rapport. Aucune approbation automatique : `approuver` est humain.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { MAX_LABELS_PER_RUN, MIN_FRICTIONS_KEPT, SKIP_CONFIDENCE, STATE_DIR } from "../daemon/config";
import type { Episode } from "../daemon/episodes";
import { redact } from "../daemon/qualify";
import { chat } from "../daemon/screenpipe";
import { CASES } from "../bench/dataset.mjs";
import { loadEpisodes } from "./collect";
import { APPROVED, CANDIDATE, compileDetector, type Detector, type DetectorInput } from "./detector";

const LABELS = ["blocage", "demande_aide", "recherche", "tatonnement", "parcours", "ressaisie", "contournement", "attente_relance", "aucun"];
const MODEL_LABELS = `${STATE_DIR}labels.model.json`; // cache des étiquettes du modèle
const HUMAN_LABELS = `${STATE_DIR}labels.human.json`; // { "<id épisode>": "<étiquette>" }, prioritaire
export const REPORT = `${STATE_DIR}report.json`;

type Example = DetectorInput & { id: string; label: string; source: "synthetique" | "reel" };

const readJson = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const isTest = (id: string) => hash(id) % 10 < 3; // 30 % en test, stable d'un passage à l'autre

const LABEL_PROMPT = `Tu étiquettes un extrait d'écran d'un employé. Friction = détour sur une étape de PROCESS (règle non écrite, champ obligatoire, validation, information introuvable). Pas une friction : travail normal, réponse courtoise, discussion sociale, message de succès, panne technique.
Réponds par UN SEUL MOT parmi : ${LABELS.join(", ")}.`;

async function labelEpisodes(eps: Episode[]): Promise<Record<string, string>> {
  const cache = readJson(MODEL_LABELS) as Record<string, string>;
  const todo = eps.filter((e) => !cache[e.id]).slice(-MAX_LABELS_PER_RUN);
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (e) => {
      const out = await chat(LABEL_PROMPT, `Appli : ${e.app}\nFenêtres : ${e.titles.map(redact).join(" → ")}\nTexte : ${redact(e.text)}`, 200).catch(() => "");
      const w = (out.toLowerCase().match(/[a-zé_]+/g) ?? []).find((x) => LABELS.includes(x));
      if (w) cache[e.id] = w;
    }));
    writeFileSync(MODEL_LABELS, JSON.stringify(cache));
  }
  return cache;
}

function examples(eps: Episode[], modelLabels: Record<string, string>): Example[] {
  const human = readJson(HUMAN_LABELS) as Record<string, string>;
  const real = eps
    .map((e) => ({ id: e.id, app: e.app, window: e.window, titles: e.titles, text: e.text, label: human[e.id] ?? modelLabels[e.id], source: "reel" as const }))
    .filter((e) => LABELS.includes(e.label));
  const synth = (CASES as [string, string, string[], string][]).map(([label, app, titles, text], i) => ({
    id: `synth${i}`, app, window: titles.at(-1) ?? "", titles, text, label, source: "synthetique" as const,
  }));
  return [...synth, ...real];
}

const GEN_PROMPT = `Tu écris du JavaScript. Écris une fonction pure detect(e), où e = { app, window, titles: string[], text }, qui renvoie { friction: boolean, detour: string, confidence: number }.
detour ∈ ${LABELS.join(", ")} ; friction = (detour !== "aucun") ; confidence entre 0 et 1.
Contraintes : aucune dépendance, aucun accès réseau ou fichier, rapide (< 5 ms). Utilise des règles GÉNÉRALES (structures de phrases, signaux d'erreur ou de question, répétitions dans titles, retours en arrière), jamais des phrases recopiées des exemples, ni des noms d'applis précises.
Rôle : FILTRE placé avant un modèle qui confirmera. Il doit écarter le travail CLAIREMENT normal (friction=false, confidence élevée) et laisser passer tout le reste : au moindre doute, friction=true. Une friction écartée à tort est grave ; une fausse alerte ne coûte qu'une vérification.
Réponds uniquement par un bloc \`\`\`js\`\`\`.`;

async function generate(train: Example[]): Promise<{ code: string; fn: Detector }> {
  const sample = train.slice(0, 120).map((e) => `- ${e.label} | titres: ${e.titles.map(redact).join(" → ").slice(0, 160)} | texte: ${redact(e.text).slice(0, 300)}`).join("\n");
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat(GEN_PROMPT, `Exemples d'entraînement :\n${sample}${lastErr ? `\n\nLa version précédente a échoué : ${lastErr}` : ""}`, 6000);
    const code = out.match(/```(?:js|javascript)?\s*([\s\S]*?)```/)?.[1] ?? out;
    try {
      const fn = compileDetector(code);
      fn({ app: "x", window: "x", titles: [], text: "test" });
      return { code, fn };
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`génération du détecteur impossible : ${lastErr}`);
}

// Mesuré comme le daemon l'utilise : un épisode est écarté si friction=false avec confidence ≥ SKIP_CONFIDENCE.
type Score = { frictionsKept: number; normalSkipped: number; frictions: number; normal: number; missed: number; msPerEpisode: number };
function score(fn: Detector, test: Example[]): Score {
  let frictions = 0, normal = 0, missed = 0, skippedNormal = 0;
  const t0 = performance.now();
  for (const e of test) {
    let r = { friction: true, detour: "aucun", confidence: 0 };
    try { r = fn(e); } catch {}
    const skipped = !r.friction && r.confidence >= SKIP_CONFIDENCE;
    if (e.label !== "aucun") { frictions++; if (skipped) missed++; }
    else { normal++; if (skipped) skippedNormal++; }
  }
  return {
    frictionsKept: 1 - missed / (frictions || 1), // part des frictions qui atteignent le modèle
    normalSkipped: skippedNormal / (normal || 1), // part du travail normal écartée sans appel au modèle
    frictions, normal, missed, msPerEpisode: (performance.now() - t0) / (test.length || 1),
  };
}

export async function learn() {
  const eps = loadEpisodes();
  const modelLabels = await labelEpisodes(eps);
  const all = examples(eps, modelLabels);
  const train = all.filter((e) => !isTest(e.id));
  const test = all.filter((e) => isTest(e.id));
  const { code, fn } = await generate(train);
  writeFileSync(CANDIDATE, code);

  const candidate = score(fn, test);
  const approved = existsSync(APPROVED) ? score(compileDetector(readFileSync(APPROVED, "utf8")), test) : null;
  // Porte de validation : plancher absolu (ne pas perdre de frictions), puis mieux que l'approuvé
  // (autant de frictions conservées, plus de travail normal écarté).
  const floorOk = candidate.frictionsKept >= MIN_FRICTIONS_KEPT;
  const better = floorOk && (!approved || (candidate.frictionsKept >= approved.frictionsKept && candidate.normalSkipped > approved.normalSkipped));
  const report = {
    at: new Date().toISOString(),
    data: { episodes: eps.length, labelled: all.length, train: train.length, test: test.length, real: all.filter((e) => e.source === "reel").length },
    candidate, approved, better,
    note: better ? "candidat meilleur : à relire puis `approuver`"
      : !floorOk ? `rejeté : seulement ${(candidate.frictionsKept * 100).toFixed(0)} % des frictions conservées (plancher ${MIN_FRICTIONS_KEPT * 100} %)`
      : "rejeté : pas mieux que le détecteur approuvé",
  };
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  return report;
}
