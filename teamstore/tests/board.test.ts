// Tests unitaires du tableau « Frictions en direct » (board.ts) : calculs purs, sans réseau.
// bun test teamstore/board.test.ts
import { describe, expect, test } from "bun:test";
import { Board } from "../board";

const T = "team-1";
const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const rows = (list: [number, string, object][]) => list.map(([seq, kind, data]) => ({ seq, kind: kind as any, data }));
const today = new Date().toISOString().slice(0, 10);

describe("demandes en attente et résolues", () => {
  const b = new Board();
  b.add(T, "Support", 1, rows([
    [1, "request", { requestId: "a", step: "dédommagement", at: at(0) }],
    [2, "request", { requestId: "b", step: "facture", at: at(0) }],
    [3, "solution", { id: "geste", step: "dédommagement", title: "1 mois", requestId: "a" }],
    [4, "signature", { step: "dédommagement", day: today }],
    [5, "signature", { step: "dédommagement", day: today }],
    [6, "signature", { step: "vieille", day: "2020-01-01" }],
  ]));
  const s = b.state();
  test("une demande sans solution est en attente", () => expect(s.pending.map((p) => p.step)).toEqual(["facture"]));
  test("une demande avec solution est résolue", () => expect(s.resolved.map((r) => r.step)).toEqual(["dédommagement"]));
  test("seules les signatures du jour comptent", () => expect(s.today).toBe(2));
  test("état des étapes", () => {
    expect(s.steps.find((x) => x.step === "facture")?.status).toBe("en attente de réponse");
    expect(s.steps.find((x) => x.step === "dédommagement")?.status).toBe("solution partagée");
  });
  test("le même bloc relu deux fois ne compte pas double", () => {
    b.add(T, "Support", 1, rows([[4, "signature", { step: "dédommagement", day: today }]]));
    expect(b.state().today).toBe(2);
  });
});

describe("certification et libellés différents", () => {
  test("une règle certifiée est comptée et donne l'état « règle certifiée »", () => {
    const b = new Board();
    b.add(T, "Support", 1, rows([[1, "signature", { step: "geste", day: today }], [2, "solution", { id: "g", step: "geste", title: "1 mois", certified: true }]]));
    expect(b.state().certified).toBe(1);
    expect(b.state().steps[0].status).toBe("règle certifiée");
  });
  test("une étape formulée autrement par l'IA, mais dont la demande a reçu une réponse, est résolue", () => {
    const b = new Board();
    b.add(T, "Support", 1, rows([
      [1, "signature", { step: "Déterminer le dédommagement autorisé", day: today }],
      [2, "request", { requestId: "q", step: "Déterminer le dédommagement autorisé", at: at(0) }],
      [3, "solution", { id: "g", step: "Crisp : un client demande un dédommagement", requestId: "q" }],
    ]));
    expect(b.state().steps.find((x) => x.step.startsWith("Déterminer"))?.status).toBe("solution partagée");
  });
});

describe("changement de clé (époque)", () => {
  test("les blocs républiés ne comptent pas double, et l'attente garde son heure de départ", () => {
    const b = new Board();
    b.add(T, "Support", 1, rows([[1, "request", { requestId: "p", step: "prospect", at: at(30) }], [2, "signature", { step: "prospect", day: today }]]));
    const before = b.state().pending[0].since;
    b.add(T, "Support", 2, rows([[10, "request", { requestId: "p", step: "prospect", at: at(30) }], [11, "signature", { step: "prospect", day: today }]]));
    const s = b.state();
    expect(s.today).toBe(1);
    expect(s.pending[0].since).toBe(before);
    expect(s.timeline.some((t) => t.title.startsWith("Clé changée"))).toBe(true);
  });
});

describe("boucle de nuit", () => {
  test("propositions et attentes listées, une proposition certifiée disparaît", () => {
    const b = new Board();
    b.add(T, "Support", 1, rows([
      [1, "candidate", { type: "proposition", id: "nuit-1", step: "prospect", title: "Prospect belge : Lead" }],
      [2, "candidate", { type: "attente", id: "nuit-2", step: "facture" }],
    ]));
    expect(b.state().night.map((n) => n.type).sort()).toEqual(["attente", "proposition"]);
    b.add(T, "Support", 1, rows([[3, "solution", { id: "nuit-1", step: "prospect", title: "Prospect belge : Lead", certified: true }]]));
    expect(b.state().night.map((n) => n.id)).toEqual(["nuit-2"]);
  });
});

describe("période (régie de répétition)", () => {
  test("`since` ne garde que ce qui s'est passé depuis", () => {
    const b = new Board();
    b.add(T, "Support", 1, rows([[1, "request", { requestId: "old", step: "vieille", at: at(180) }], [2, "request", { requestId: "new", step: "neuve", at: at(0) }]]));
    expect(b.state(Date.now(), Date.now() - 60_000).pending.map((p) => p.step)).toEqual(["neuve"]);
  });
});

describe("Live View : formats acceptés par Screenpipe", () => {
  test("les 9 blocs et leurs bornes (list ≤ 20, table ≤ 50, titres ≤ 200)", () => {
    const b = new Board();
    b.add(T, "Support", 1, rows(Array.from({ length: 30 }, (_, i) => [i + 1, "request", { requestId: `r${i}`, step: `étape ${i} ${"x".repeat(300)}`, at: at(0) }] as [number, string, object])));
    const lv = Board.liveView(b.state()) as any;
    expect(Object.keys(lv).sort()).toEqual(["attente", "aujourdhui", "en-attente", "etapes", "fil", "nuit", "regles", "regles-lecture", "resolues"]);
    expect(lv.attente.items.length).toBe(20);
    expect(lv.fil.items.every((i: any) => i.title.length <= 200 && i.timestamp)).toBe(true);
    expect(lv.etapes.items.every((i: any) => i.label.length <= 200)).toBe(true);
    expect(lv["en-attente"].value).toBe(30);
  });
});
