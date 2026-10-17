import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { implicitLabels } from "./learn";

test("étiquettes d'usage : « Ça m'a aidé » et demande résolue confirment ; « Pas ça » donne « aucun » (étiquette faible)", () => {
  const f = `${mkdtempSync(`${tmpdir()}/fa-`)}/events.jsonl`;
  const ev = [
    { kind: "shown", episode: "ep1", solution: "s", detour: "demande_aide" },
    { kind: "feedback", rating: "up", episode: "ep1" },
    { kind: "shown", episode: "ep2", solution: "s", detour: "blocage" },
    { kind: "feedback", rating: "down", episode: "ep2" },
    { kind: "asked", episode: "ep3", requestId: "r3", detour: "recherche" },
    { kind: "solved", requestId: "r3" },
    { kind: "asked", episode: "ep4", requestId: "r4", detour: "parcours" },
  ];
  writeFileSync(f, ev.map((x) => JSON.stringify(x)).join("\n") + "\n");
  expect(implicitLabels(f)).toEqual({ ep1: "demande_aide", ep2: "aucun", ep3: "recherche" });
});
