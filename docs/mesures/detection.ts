// Recalcule précision et rappel de la détection à partir des évaluations enregistrées (aucun appel réseau).
//   bun docs/mesures/detection.ts
// Fichiers : docs/mesures/detection-<modèle>.json, une ligne par épisode étiqueté (fenêtre, vérité, prédiction, confiance, ms).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Row = { truth: string; pred: string; confidence: number | null; ms: number };
const friction = (x: string) => x !== "aucun";
const THRESHOLDS = [0.5, 0.6, 0.7, 0.72, 0.75, 0.8, 0.85];

for (const f of readdirSync(import.meta.dir).filter((f) => f.startsWith("detection-") && f.endsWith(".json")).sort()) {
  const { model, rows } = JSON.parse(readFileSync(join(import.meta.dir, f), "utf8")) as { model: string; rows: Row[] };
  const positives = rows.filter((r) => friction(r.truth)).length;
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`${model} : ${rows.length} épisodes, ${positives} frictions, modèle médiane ${ms[ms.length >> 1]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
  for (const th of THRESHOLDS) {
    const fired = rows.filter((r) => friction(r.pred) && (r.confidence ?? 0) >= th);
    const tp = fired.filter((r) => friction(r.truth)).length;
    const precision = fired.length ? tp / fired.length : 0;
    console.log(`  seuil ${th.toFixed(2)} : précision ${precision.toFixed(2)}  rappel ${(tp / positives).toFixed(2)}  (${tp} justes, ${fired.length - tp} fausses alertes, ${positives - tp} manquées)`);
  }
}
