// Collecte hors ligne : rejoue l'historique de Screenpipe dans le MÊME découpage en épisodes
// que le daemon en direct, pour que le détecteur apprenne sur ce qu'il verra en direct.
// Les épisodes restent sur la machine (agent/.state/, ignoré par git).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STATE_DIR } from "../config";
import { EpisodeBuilder, type Episode } from "../episodes";
import { search } from "../screenpipe";

export const EPISODES = `${STATE_DIR}episodes.jsonl`;
const CURSOR = `${STATE_DIR}collect-cursor`;

export function loadEpisodes(): Episode[] {
  if (!existsSync(EPISODES)) return [];
  return readFileSync(EPISODES, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export async function collect(sinceIso?: string): Promise<{ since: string; frames: number; inputs: number; added: number; total: number }> {
  const since = sinceIso ?? (existsSync(CURSOR) ? readFileSync(CURSOR, "utf8").trim() : new Date(Date.now() - 24 * 3600_000).toISOString());
  const until = new Date().toISOString();
  // L'une après l'autre : en parallèle, Screenpipe répond 503 « search is busy » (mesuré).
  const frames = await search({ content_type: "ocr", start_time: since, end_time: until }, 20_000);
  const inputs = await search({ content_type: "input", start_time: since, end_time: until }, 20_000);
  const items = [...frames.map((c) => ({ kind: "f", c })), ...inputs.map((c) => ({ kind: "i", c }))]
    .sort((a, b) => new Date(a.c.timestamp).getTime() - new Date(b.c.timestamp).getTime());

  const builder = new EpisodeBuilder();
  const out: Episode[] = [];
  for (const { kind, c } of items) {
    const t = new Date(c.timestamp).getTime();
    out.push(...builder.ready(t)); // horloge virtuelle : le debounce se juge sur le temps des frames
    if (kind === "f") builder.addFrame(c);
    else builder.addInput(c);
  }
  out.push(...builder.ready(Date.parse(until) + 60_000));

  const known = new Set(loadEpisodes().map((e) => e.id));
  const fresh = out.filter((e) => !known.has(e.id) && e.text.length >= 20);
  if (fresh.length) writeFileSync(EPISODES, fresh.map((e) => JSON.stringify(e)).join("\n") + "\n", { flag: "a" });
  writeFileSync(CURSOR, until);
  return { since, frames: frames.length, inputs: inputs.length, added: fresh.length, total: known.size + fresh.length };
}
