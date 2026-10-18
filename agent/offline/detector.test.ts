import { expect, test } from "bun:test";
import { compileDetector } from "./detector";

const e = { app: "Slack.exe", window: "#support", titles: [], text: "quelqu'un sait ?" };

test("un détecteur valide s'exécute", () => {
  const d = compileDetector(`function detect(e) { return { friction: /\\?/.test(e.text), detour: "demande_aide", confidence: 0.9 }; }`);
  expect(d(e)).toEqual({ friction: true, detour: "demande_aide", confidence: 0.9 });
});

test("bac à sable : pas d'accès au système", () => {
  const d = compileDetector(`function detect(e) { return { friction: typeof process !== "undefined" || typeof require !== "undefined", detour: "x", confidence: 1 }; }`);
  expect(d(e).friction).toBe(false);
});

test("bac à sable : une boucle infinie est coupée", () => {
  const d = compileDetector(`function detect(e) { for (;;) {} }`);
  expect(() => d(e)).toThrow();
});

test("code sans detect(e) : refusé", () => {
  expect(() => compileDetector(`const x = 1;`)).toThrow();
});
