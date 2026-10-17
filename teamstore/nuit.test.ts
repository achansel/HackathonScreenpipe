// Tests unitaires de la boucle de nuit (nuit.ts) : sans réseau ni modèle (le modèle et Screenpipe sont simulés).
// bun test teamstore/nuit.test.ts
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextAfter, dayCases, EXEMPLE, judge, publish, type Finding } from "./nuit";

const answer = (o: object) => async () => `Voici : ${JSON.stringify(o)}`;
const noRedact = (s: string) => s;
const CASE = { step: "Crisp : un client demande un dédommagement", at: 0, context: "Claire : 1 mois max, Premium seulement." };

describe("judge : verdict du modèle", () => {
  test("une règle claire et confiante est retenue", async () => {
    const f = await judge(CASE, answer({ resolved: true, title: "Dédommagement : 1 mois offert maximum", body: "Premium ou Groupe.", how: "slack", confidence: 0.9 }), noRedact);
    expect(f).toMatchObject({ resolved: true, title: "Dédommagement : 1 mois offert maximum", how: "slack", confidence: 0.9 });
  });
  test("sous le seuil de confiance (0,7), la friction reste en attente", async () => {
    const f = await judge(CASE, answer({ resolved: true, title: "Peut-être 1 mois", body: "", confidence: 0.5 }), noRedact);
    expect(f.resolved).toBe(false);
    expect(f.title).toBeUndefined();
  });
  test("le modèle dit non résolue : en attente", async () => {
    expect((await judge(CASE, answer({ resolved: false, confidence: 0.95 }), noRedact)).resolved).toBe(false);
  });
  test("pas de titre : en attente", async () => {
    expect((await judge(CASE, answer({ resolved: true, title: "", confidence: 0.95 }), noRedact)).resolved).toBe(false);
  });
  test("une réponse illisible du modèle ne publie rien", async () => {
    const f = await judge(CASE, async () => "désolé, je ne peux pas", noRedact);
    expect(f).toMatchObject({ resolved: false, confidence: 0 });
  });
  for (const [what, title, body] of [
    ["un prénom de collègue", "Demander à Claire", "Elle sait."],
    ["un nom de client", "Geste pour Jean Dupont", "1 mois."],
    ["un e-mail", "Écrire à support@pipingtable.fr", "."],
    ["un téléphone", "Appeler le 06 39 98 12 34", "."],
  ]) test(`une règle qui contient ${what} est refusée`, async () => {
    expect((await judge(CASE, answer({ resolved: true, title, body, confidence: 0.95 }), noRedact)).resolved).toBe(false);
  });
  test("« max » en minuscule n'est pas le prénom Max (règle gardée)", async () => {
    expect((await judge(CASE, answer({ resolved: true, title: "Dédommagement : 1 mois offert max", body: "Maximum un mois.", confidence: 0.95 }), noRedact)).resolved).toBe(true);
  });
  test("le contexte passe par le masquage avant le modèle", async () => {
    let seen = "";
    await judge({ ...CASE, context: "écrire à jean@resto.fr" }, async (_s, u) => { seen = u; return "{}"; }, (s) => s.replace(/\S+@\S+/g, "[EMAIL]"));
    expect(seen).toContain("[EMAIL]");
    expect(seen).not.toContain("jean@resto.fr");
  });
  test("le contexte envoyé au modèle est borné (8 000 caractères)", async () => {
    let seen = "";
    await judge({ ...CASE, context: "x".repeat(20_000) }, async (_s, u) => { seen = u; return "{}"; }, noRedact);
    expect(seen.length).toBeLessThan(8_300);
  });
  test("titre et texte sont tronqués", async () => {
    const f = await judge(CASE, answer({ resolved: true, title: "T".repeat(200), body: "B".repeat(900), confidence: 0.9 }), noRedact);
    expect(f.title!.length).toBe(80);
    expect(f.body!.length).toBe(400);
  });
});

describe("dayCases : frictions du jour restées sans réponse (journal du démon)", () => {
  const root = mkdtempSync(join(tmpdir(), "fa-nuit-"));
  const base = join(root, "andrea", "daemon", ".state");
  mkdirSync(join(base, "lea"), { recursive: true });
  const ev = (o: object) => JSON.stringify(o);
  writeFileSync(join(base, "events.jsonl"), [
    ev({ at: "2026-10-17T08:00:00Z", kind: "asked", step: "trop vieille", requestId: "r0" }),
    ev({ at: "2026-10-17T10:00:00Z", kind: "asked", step: "facture introuvable", requestId: "r1" }),
    ev({ at: "2026-10-17T10:05:00Z", kind: "shown", solution: "x" }),
    "pas du json",
  ].join("\n"));
  writeFileSync(join(base, "lea", "events.jsonl"), [
    ev({ at: "2026-10-17T11:00:00Z", kind: "asked", step: "dédommagement", requestId: "r2" }),
    ev({ at: "2026-10-17T11:00:08Z", kind: "solved", requestId: "r2" }),
    ev({ at: "2026-10-17T12:00:00Z", kind: "asked", step: "prospect belge", requestId: "r3" }),
  ].join("\n"));
  const cases = dayCases(root, Date.parse("2026-10-17T09:00:00Z"));
  test("garde les demandes sans solution, de toutes les instances", () => expect(cases.map((c) => c.step).sort()).toEqual(["facture introuvable", "prospect belge"]));
  test("ignore celles d'avant le début de la période", () => expect(cases.some((c) => c.step === "trop vieille")).toBe(false));
  test("ignore celles que l'équipe a résolues", () => expect(cases.some((c) => c.requestId === "r2")).toBe(false));
  test("garde l'heure et l'id de la demande", () => expect(cases.find((c) => c.requestId === "r3")?.at).toBe(Date.parse("2026-10-17T12:00:00Z")));
  test("sans journal du démon : rien", () => expect(dayCases(mkdtempSync(join(tmpdir(), "fa-vide-")), 0)).toEqual([]));
});

describe("contextAfter : ce qui a été vu dans les 15 minutes", () => {
  const frames = [
    { timestamp: "2026-10-17T10:02:00Z", app_name: "Slack", window_name: "#support", text: "Claire : 1 mois max\nok" },
    { timestamp: "2026-10-17T10:01:00Z", app_name: "Google Chrome", window_name: "Contacts | HubSpot", text: "0 contacts\nClaire : 1 mois max" },
    { timestamp: "2026-10-17T10:03:00Z", app_name: "Spotify", window_name: "Daft Punk", text: "Musique perso" },
  ];
  let asked: Record<string, string>[] = [];
  const search = async (p: Record<string, string>) => { asked.push(p); return p.content_type === "ocr" ? frames : []; };
  test("seulement les outils de travail, dans l'ordre, sans doublon ni ligne courte", async () => {
    asked = [];
    const ctx = await contextAfter(Date.parse("2026-10-17T10:00:00Z"), search, /slack|hubspot|crisp|notion/i);
    expect(ctx.split("\n")).toEqual(["0 contacts", "Claire : 1 mois max"]);
    expect(ctx).not.toContain("Musique");
  });
  test("fenêtre de 15 minutes après la friction", async () => {
    asked = [];
    await contextAfter(Date.parse("2026-10-17T10:00:00Z"), search, /slack/i);
    expect(asked[0]).toMatchObject({ start_time: "2026-10-17T10:00:00.000Z", end_time: "2026-10-17T10:15:00.000Z" });
  });
});

describe("publish : routage et contenu publié", () => {
  const fakeTeam = (name: string, scope?: string) => {
    const sent: { kind: string; data: any }[] = [];
    return { sent, team: { name, m: { scope }, publish: async (kind: string, data: any) => { sent.push({ kind, data }); return 1; } } as any };
  };
  test("proposition et attente, vers l'équipe dont le périmètre correspond", async () => {
    const support = fakeTeam("Support", "crisp|facture"), ventes = fakeTeam("Ventes", "remise|prospect");
    const findings: Finding[] = [
      { step: "Crisp : dédommagement", resolved: true, title: "1 mois max", body: "Premium.", how: "slack", confidence: 0.9 },
      { step: "Retrouver une facture", resolved: false, confidence: 0.9, requestId: "r1" },
      { step: "Notion : page perdue", resolved: false, confidence: 0.9 },
    ];
    const r = await publish(findings, [support.team, ventes.team]);
    expect(r).toEqual({ proposals: 1, pending: 1 });
    expect(support.sent.map((s) => [s.kind, s.data.type])).toEqual([["candidate", "proposition"], ["candidate", "attente"]]);
    expect(support.sent[1].data.requestId).toBe("r1");
    expect(ventes.sent).toEqual([]);
  });
  test("l'id d'une proposition est stable (la même règle ne crée pas deux propositions)", async () => {
    const a = fakeTeam("A"), b = fakeTeam("B");
    const f: Finding = { step: "x", resolved: true, title: "Même règle", body: "", confidence: 0.9 };
    await publish([f], [a.team]); await publish([f], [b.team]);
    expect(a.sent[0].data.id).toBe(b.sent[0].data.id);
    expect(a.sent[0].data.id).toMatch(/^nuit-[0-9a-f]{10}$/);
  });
  test("rien ne part sans texte d'écran ni nom : seulement l'étape, la règle et le jour", async () => {
    const t = fakeTeam("Support");
    await publish([{ step: "x", resolved: true, title: "R", body: "B", how: "slack", confidence: 0.9, label: "Jean Dupont" }], [t.team]);
    expect(Object.keys(t.sent[0].data).sort()).toEqual(["body", "confidence", "day", "how", "id", "requestId", "step", "title", "type"]);
  });
});

describe("l'exemple préparé", () => {
  test("4 cas, dont 1 sans solution", () => {
    expect(EXEMPLE.length).toBe(4);
    expect(EXEMPLE.filter((c) => /revien/.test(c.context)).length).toBe(1);
  });
});
