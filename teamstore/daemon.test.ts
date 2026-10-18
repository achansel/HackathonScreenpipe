// Intégration : le circuit d'équipe du daemon (agent/team.ts, inchangé) sur le stockage RPC.
// Seuls le modèle (matchStep) et /notify sont simulés ; la base, le chiffrement et le routage sont réels.
// Usage : ./local-db.sh up && ./daemon-test.sh
import { afterAll, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import { membershipFromInvite, SupabaseStore, Team } from "./client";

const notified: any[] = [];
mock.module("../agent/qualify", () => ({
  matchStep: async (step: string, list: { id: string; step: string }[]) => list.find((s) => s.step === step)?.id ?? null,
}));
mock.module("../agent/screenpipe", () => ({
  notify: async (p: any) => { notified.push(p); return "sent successfully"; },
  relayUrl: "http://127.0.0.1:3030/connections/n8n/proxy?instance=test",
}));
mock.module("../agent/steps", () => ({ canonicalSteps: async (labels: string[]) => new Map(labels.map((l) => [l, l])) }));
const { TeamSync } = await import("../agent/team");
const { buildMap } = await import("../agent/map");
const { RpcTeamStore, saveMemberships } = await import("../agent/teamstore");
const { TEAMS_FILE, STATE_DIR } = await import("../agent/config");
const seed = (await import("../agent/solutions.seed.json")).default as any[];

const store = new SupabaseStore(process.env.FRICTION_TEAMSTORE_URL!, process.env.FRICTION_TEAMSTORE_ANON_KEY ?? "", process.env.FRICTION_TEAMSTORE_REST_PATH);
const manon = await Team.create(store, "Support", "crisp|rembours|dédommag");
const sam = await Team.create(store, "Ventes", "hubspot|remise");
const lea = await Team.open(store, membershipFromInvite(manon.invite(), manon.m.scope));

// Karim : membre des deux équipes, ses clés dans son fichier d'équipes (comme après equipe-rejoindre).
saveMemberships([membershipFromInvite(manon.invite(), manon.m.scope), membershipFromInvite(sam.invite(), sam.m.scope)]);
const handlers = new Map<string, (a: string) => Promise<void>>();
const logs: string[] = [];
const karimStore = new RpcTeamStore((...a) => logs.push(a.join(" ")));
await karimStore.init();
const karimSolutions = structuredClone(seed);
const karim = new TeamSync(karimStore, karimSolutions, {
  register: (nonce, _ep, h) => handlers.set(nonce, h),
  helpNotification: (_ep, s) => ({ title: s.title }),
  record: () => {},
  log: (...a) => logs.push(a.join(" ")),
});
const geste = seed.find((s) => s.id === "geste-commercial");

afterAll(() => { rmSync(TEAMS_FILE, { force: true }); rmSync(STATE_DIR, { recursive: true, force: true }); });

test("Karim charge ses deux équipes", () => {
  expect(karimStore.teams.map((t) => t.name).sort()).toEqual(["Support", "Ventes"]);
});

test("demande anonyme de Léa (Support) → Karim reçoit « Un collègue bloque » avec Partager", async () => {
  await lea.publish("request", { requestId: "req-lea-1", step: geste.step, type: "unclear", control: "required", detour: "demande_aide" });
  await karim.poll();
  const n = notified.find((x) => x.title?.includes("Un collègue bloque"));
  expect(n?.body).toContain(geste.title);
  expect(n?.body).toContain("Personne ne saura qui a demandé");
  expect(n.actions.map((a: any) => a.id)).toEqual(["share", "skip"]);
});

test("Karim clique Partager → la solution part au Support seulement, Léa la lit en clair", async () => {
  const share = notified.at(-1).actions[0].body.nonce;
  await handlers.get(share)!("share");
  const got = await lea.pull(0, "solution");
  expect(got.map((g) => [g.data.id, g.data.requestId])).toEqual([["geste-commercial", "req-lea-1"]]);
  expect((await sam.pull(0, "solution")).length).toBe(0);
});

test("une friction HubSpot de Karim part aux Ventes seulement", async () => {
  await karim.ask({ friction: true, detour: "blocage", type: "waiting", control: "required", step: "HubSpot : relance d'un devis expiré", solution_id: null, confiance: 0.9 });
  await Bun.sleep(100); // la demande part après un délai aléatoire (anonymat) : 0 ici
  const got = await sam.pull(0, "request");
  expect(got.map((r) => r.data.step)).toEqual(["HubSpot : relance d'un devis expiré"]);
  // l'heure voyage chiffrée, arrondie à 10 min (filtre des demandes périmées de team.ts)
  expect(new Date(got[0].data.at).getTime() % 600_000).toBe(0);
  expect((await lea.pull(0, "request")).some((r) => r.data.step.startsWith("HubSpot"))).toBe(false);
});

test("une friction hors de tout périmètre ne sort pas de la machine", async () => {
  await karim.ask({ friction: true, detour: "recherche", type: "unclear", control: "direct", step: "Notion : page d'onboarding introuvable", solution_id: null, confiance: 0.9 });
  await Bun.sleep(100);
  expect(logs.some((l) => l.includes("aucune équipe ne couvre"))).toBe(true);
});

test("la responsable certifie une solution → le cache de Karim la marque certifiée", async () => {
  await manon.publish("solution", await manon.certify(geste));
  await karim.poll();
  const s = karimSolutions.find((x: any) => x.id === "geste-commercial");
  expect(s.certified).toBe(true);
  expect(s.team).toBe("Support");
});

test("la carte d'équipe (map.ts) se construit sur le stockage RPC : signatures comptées, étape résolue", async () => {
  await karim.sign({ friction: true, detour: "demande_aide", type: "unclear", control: "required", step: geste.step, solution_id: null, confiance: 0.9 });
  const map = await buildMap(karimStore);
  // Libellés raccourcis à 60 caractères pour tenir dans la Live View (« … » au bout).
  const row = map.etapes.items.find((i: any) => geste.step.startsWith(i.label.replace(/…$/, "")));
  expect(map.detours.value).toBe("moins de 5");
  expect(row?.status).toBe("règle certifiée"); // certifiée au test précédent : l'état le plus avancé l'emporte
});

test("Karim retiré du Support (rotation) : son daemon continue avec Ventes et le signale une fois", async () => {
  await manon.rotate();
  await karim.poll();
  await karim.poll();
  expect(logs.filter((l) => l.includes("« Support » : accès refusé")).length).toBe(1);
  await sam.publish("request", { requestId: "req-sam-1", step: "HubSpot : remise supérieure à 15 % bloquée", type: "waiting" });
  await karim.poll();
  expect(notified.some((x) => x.title?.includes("remise supérieure à 15 %"))).toBe(true);
});
