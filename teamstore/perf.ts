// Banc de performance du stockage d'équipe chiffré : chiffrement local, appels RPC, délai de bout en bout entre
// deux membres, changement de clé. Les équipes créées sont supprimées à la fin.
//   bun teamstore/perf.ts                      → stockage configuré (team.env : Supabase), sinon local
//   bun teamstore/perf.ts --local              → stockage local (bun teamstore/local-server.ts doit tourner)
// Résultat : mesures/perf-<cible>.json (+ tableau affiché).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { membershipFromInvite, SupabaseStore, Team } from "./client";
import { deriveTeamKeys, open, randomKey, seal } from "./crypto";

const env: Record<string, string> = {};
const f = join(homedir(), ".config", "friction-assist", "team.env");
if (existsSync(f)) for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*(?:export\s+)?(\w+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const local = process.argv.includes("--local") || !env.FRICTION_TEAMSTORE_URL;
const url = local ? "http://127.0.0.1:3001" : env.FRICTION_TEAMSTORE_URL;
const store = new SupabaseStore(url, local ? "" : env.FRICTION_TEAMSTORE_ANON_KEY ?? "", "/rest/v1");
const target = local ? "local" : "supabase";

const stats = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const q = (p: number) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); return { n: s.length, p50: q(0.5), p95: q(0.95), max: +s.at(-1)!.toFixed(1) }; };
const time = async <T>(fn: () => Promise<T>) => { const t = performance.now(); const r = await fn(); return [performance.now() - t, r] as const; };
const out: Record<string, unknown> = { date: new Date().toISOString(), target, host: local ? "127.0.0.1" : new URL(url).host };

// 1. Chiffrement (sur le poste, sans réseau)
const keys = await deriveTeamKeys(randomKey());
const obj = { id: "geste-commercial", step: "Crisp : un client demande un dédommagement", title: "Geste commercial : 1 mois offert maximum", body: "Premium ou Groupe seulement.".repeat(4) };
const sealT: number[] = [], openT: number[] = [];
let blob = "";
for (let i = 0; i < 500; i++) {
  const [a, b] = await time(() => seal(keys, { teamId: "t", kind: "solution", epoch: 1 }, obj)); sealT.push(a); blob = b;
  const [c] = await time(() => open(keys, { teamId: "t", kind: "solution", epoch: 1 }, blob)); openT.push(c);
}
const [deriveMs] = await time(() => deriveTeamKeys(randomKey()));
const us = (xs: number[]) => stats(xs.map((x) => x * 1000)); // microsecondes
out.crypto = { sealUs: us(sealT), openUs: us(openT), deriveKeysMs: +deriveMs.toFixed(2), blobChars: blob.length };

// 2. Appels RPC
const created: Team[] = [];
const createT: number[] = [];
for (let i = 0; i < 3; i++) { const [ms, t] = await time(() => Team.create(store, `perf-${i}`)); createT.push(ms); created.push(t); }
const admin = created[0];
const member = await Team.open(store, membershipFromInvite(admin.invite()));
const putT: number[] = [];
for (let i = 0; i < 30; i++) { const [ms] = await time(() => admin.publish(i % 3 ? "solution" : "signature", { ...obj, id: `s${i}` })); putT.push(ms); }
const listT: number[] = [], listKindT: number[] = [];
for (let i = 0; i < 15; i++) { listT.push((await time(() => member.pull(0)))[0]); listKindT.push((await time(() => member.pull(0, "request")))[0]); }
out.rpc = { createTeamMs: stats(createT), putBlobMs: stats(putT), listAll30Ms: stats(listT), listByKindMs: stats(listKindT) };

// 3. Bout en bout : A publie une demande, B la voit (B relit toutes les 100 ms)
const e2e: number[] = [];
for (let i = 0; i < 10; i++) {
  let cursor = (await member.pull(0)).reduce((m, r) => Math.max(m, r.seq), 0);
  const t0 = performance.now();
  await admin.publish("request", { requestId: `perf-${i}`, step: "x" });
  for (;;) { const rows = await member.pull(cursor); if (rows.some((r) => r.data?.requestId === `perf-${i}`)) break; cursor = rows.reduce((m, r) => Math.max(m, r.seq), cursor); await Bun.sleep(100); }
  e2e.push(performance.now() - t0);
}
out.endToEnd = { publishToSeenMs: stats(e2e), note: "un membre publie, l'autre relit toutes les 100 ms (la page relit toutes les 2 s, le démon toutes les 5 s)" };

// 4. Changement de clé avec 20 solutions et 10 signatures (relire, tourner, republier)
const [rotMs, rot] = await time(() => admin.rotate());
out.rotation = { ms: +rotMs.toFixed(0), republishedSolutions: rot.republished };

// ménage
for (const t of created) await t.destroy().catch(() => false);

mkdirSync(join(import.meta.dir, "mesures"), { recursive: true });
writeFileSync(join(import.meta.dir, "mesures", `perf-${target}.json`), JSON.stringify(out, null, 2));
const c = out.crypto as any, r = out.rpc as any;
console.log(`Stockage ${target} (${out.host})`);
console.log(`chiffrer ${c.sealUs.p50} µs · déchiffrer ${c.openUs.p50} µs (p50, n=500) · dériver les clés ${c.deriveKeysMs} ms · bloc ${c.blobChars} car.`);
console.log(`créer une équipe ${r.createTeamMs.p50} ms · écrire ${r.putBlobMs.p50} ms (p95 ${r.putBlobMs.p95}) · relire 30 blocs ${r.listAll30Ms.p50} ms (p95 ${r.listAll30Ms.p95}) · relire par type ${r.listByKindMs.p50} ms`);
console.log(`bout en bout (publier → vu par un autre membre) : p50 ${(out.endToEnd as any).publishToSeenMs.p50} ms · p95 ${(out.endToEnd as any).publishToSeenMs.p95} ms`);
console.log(`changement de clé (20 solutions, 10 signatures) : ${(out.rotation as any).ms} ms`);
process.exit(0);
