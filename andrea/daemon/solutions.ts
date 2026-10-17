// Cache local des solutions d'équipe. Étape 1 : amorcé par solutions.seed.json (règles
// fictives de UseCase.md). Étape 2 : alimenté par le stockage d'équipe chiffré.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SEED, STATE_DIR } from "./config";

export type Solution = {
  id: string;
  step: string;
  type: "waiting" | "switching" | "rework" | "handoff" | "unclear"; // vocabulaire Screenpipe
  control: "direct" | "influence" | "external" | "required"; // vocabulaire Screenpipe
  detour: string; // notre extension
  title: string;
  body: string;
  copy?: string;
  owner: string;
  reviewed: string;
  uses: number;
  score?: number; // 👍 - 👎 reçus localement
  shared?: boolean; // reçue de l'équipe
};

const FILE = `${STATE_DIR}solutions.json`;
const SEED_FILE = new URL("./solutions.seed.json", import.meta.url).pathname;

export function loadSolutions(): Solution[] {
  if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, "utf8"));
  return SEED ? JSON.parse(readFileSync(SEED_FILE, "utf8")) : [];
}

export function saveSolutions(list: Solution[]) {
  writeFileSync(FILE, JSON.stringify(list, null, 2));
}
