// Détecteur généré hors ligne : une fonction pure `detect(e)` exécutée dans un bac à sable
// (pas d'accès au système, 50 ms max). Le daemon n'exécute que la version APPROUVÉE.
import { existsSync, readFileSync, statSync } from "node:fs";
import vm from "node:vm";
import { STATE_DIR } from "../daemon/config";

export type DetectorInput = { app: string; window: string; titles: string[]; text: string };
export type DetectorOutput = { friction: boolean; detour: string; confidence: number };
export type Detector = (e: DetectorInput) => DetectorOutput;

export const CANDIDATE = `${STATE_DIR}detector.candidate.js`;
export const APPROVED = `${STATE_DIR}detector.approved.js`;

export function compileDetector(code: string): Detector {
  const ctx = vm.createContext({});
  vm.runInContext(`${code}\nthis.__detect = detect;`, ctx, { timeout: 500 });
  const fn = (ctx as any).__detect;
  if (typeof fn !== "function") throw new Error("le code ne définit pas detect(e)");
  return (e) => {
    const r = vm.runInNewContext("f(e)", { f: fn, e: structuredClone(e) }, { timeout: 50 }) as DetectorOutput;
    return { friction: Boolean(r?.friction), detour: String(r?.detour ?? "aucun"), confidence: Number(r?.confidence ?? 0) };
  };
}

let cache: { mtime: number; fn: Detector } | null = null;
/** Détecteur approuvé, rechargé si le fichier change ; null s'il n'y en a pas. */
export function approvedDetector(): Detector | null {
  if (!existsSync(APPROVED)) return (cache = null);
  const mtime = statSync(APPROVED).mtimeMs;
  if (cache?.mtime !== mtime) cache = { mtime, fn: compileDetector(readFileSync(APPROVED, "utf8")) };
  return cache.fn;
}
