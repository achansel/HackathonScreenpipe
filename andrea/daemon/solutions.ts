// Cache local des solutions d'équipe. Étape 1 : amorcé par solutions.seed.json (règles
// fictives de UseCase.md). Étape 2 : alimenté par le stockage d'équipe chiffré.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STATE_DIR } from "./config";

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
};

const FILE = `${STATE_DIR}solutions.json`;
const SEED = new URL("./solutions.seed.json", import.meta.url).pathname;

export function loadSolutions(): Solution[] {
  return JSON.parse(readFileSync(existsSync(FILE) ? FILE : SEED, "utf8"));
}

export function saveSolutions(list: Solution[]) {
  writeFileSync(FILE, JSON.stringify(list, null, 2));
}
