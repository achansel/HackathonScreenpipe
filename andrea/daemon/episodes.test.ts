import { expect, test } from "bun:test";
import { EpisodeBuilder } from "./episodes";

const T0 = Date.parse("2026-10-17T10:00:00Z");
const frame = (app: string, window: string, text: string, dt: number, source = "accessibility") =>
  ({ app_name: app, window_name: window, text, text_source: source, timestamp: new Date(T0 + dt).toISOString() });

test("un épisode sort après le debounce, pas avant", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("Slack.exe", "#support - Slack", "Quelqu'un sait quel pipeline choisir pour ce ticket", 0));
  expect(b.ready(T0 + 1000)).toHaveLength(0);
  const eps = b.ready(T0 + 2500);
  expect(eps).toHaveLength(1);
  expect(eps[0].text).toContain("pipeline");
  expect(b.ready(T0 + 5000)).toHaveLength(0); // un changement ne sort qu'une fois
});

test("hors périmètre : une autre appli titrée « … - Slack » est ignorée", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("claude.exe", "logistics (Channel) - Piping Company - Slack", "texte d'une autre appli confidentiel", 0));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
});

test("Firefox : texte d'accessibilité ignoré (autre onglet possible), OCR gardé", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("firefox.exe", "Camille Martin | Crisp — Mozilla Firefox", "texte d'un autre onglet boite de reception", 0, "accessibility"));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
  b.addFrame(frame("firefox.exe", "Camille Martin | Crisp — Mozilla Firefox", "je veux obtenir un remboursement pour ma commande", 6000, "ocr"));
  expect(b.ready(T0 + 9000)).toHaveLength(1);
});

test("aperçus alt-tab ignorés", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("chrome.exe", "Task Switching", "Crisp HubSpot Slack WhatsApp Gmail", 0));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
});

test("identifiant déterministe : même historique, même épisode", () => {
  const run = () => {
    const b = new EpisodeBuilder();
    b.addFrame(frame("Slack.exe", "#support - Slack", "question sur le pipeline support ou support old", 0));
    return b.ready(T0 + 3000)[0].id;
  };
  expect(run()).toBe(run());
});
