// Carte d'équipe (étape 4) : agrège les signatures chiffrées de l'équipe sur 7 jours et remplit
// la Live View « Carte des frictions » (live-view:friction-map:*), dans l'app Screenpipe.
// On compte des DÉTOURS par étape, jamais des personnes : les signatures n'ont aucune identité.
// Fourchettes plutôt que chiffres exacts (VISION.md) ; une étape apparaît dès le premier détour.
import { API, KEY } from "./config";
import type { TeamStore } from "./teamstore";

export const MAP_PIPE = "friction-map"; // pipe auquel les blocs sont liés (rempli ici, via source_pipe)
export const MAP_DEEPLINK = "screenpipe://live-view/friction-map";
const auth = { Authorization: `Bearer ${KEY}` };
const WEEK_MS = 7 * 24 * 3600_000;

const range = (n: number) => (n < 5 ? "moins de 5" : n < 10 ? "5 à 10" : n < 20 ? "10 à 20" : "plus de 20");
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

type Signature = { step: string; type: string; control: string; detour: string; day: string; synthetic?: boolean };

export async function buildMap(store: TeamStore) {
  const since = Date.now() - WEEK_MS;
  const fresh = <T>(rows: { at: string; payload: T }[]) => rows.filter((r) => r.payload && Date.parse(r.at) >= since).map((r) => r.payload);
  const signatures = fresh<Signature>(await listAll(store, "signature"));
  const requests = fresh<{ requestId: string; step: string }>(await listAll(store, "request"));
  const solutions = fresh<{ requestId?: string; step: string }>(await listAll(store, "solution"));

  // Étape « résolue » si une solution a été partagée pour une demande sur cette étape.
  const solvedRequests = new Set(solutions.map((s) => s.requestId).filter(Boolean));
  const solvedSteps = new Set(requests.filter((r) => solvedRequests.has(r.requestId)).map((r) => norm(r.step)));
  for (const s of solutions) solvedSteps.add(norm(s.step));

  const bySteps = new Map<string, { step: string; n: number; types: Map<string, number>; controls: Map<string, number> }>();
  const byType = new Map<string, number>();
  for (const s of signatures) {
    const k = norm(s.step);
    const e = bySteps.get(k) ?? { step: s.step, n: 0, types: new Map(), controls: new Map() };
    e.n++;
    e.types.set(s.type, (e.types.get(s.type) ?? 0) + 1);
    e.controls.set(s.control, (e.controls.get(s.control) ?? 0) + 1);
    bySteps.set(k, e);
    byType.set(s.type, (byType.get(s.type) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const steps = [...bySteps.entries()].sort((a, b) => b[1].n - a[1].n);
  const unsolved = steps.filter(([k]) => !solvedSteps.has(k)).length;
  const synthetic = signatures.some((s) => s.synthetic);

  return {
    total: { value: range(signatures.length), label: "détours sur des étapes de process", unit: "7 jours" },
    "sans-solution": { value: unsolved, label: "étapes où personne n'a encore partagé de solution" },
    "par-type": { items: ["unclear", "switching", "rework", "waiting", "handoff"].map((t) => ({ label: t, value: byType.get(t) ?? 0 })) },
    etapes: {
      items: steps.slice(0, 50).map(([k, e]) => {
        const control = top(e.controls);
        return {
          label: e.step,
          value: range(e.n),
          detail: `${top(e.types)} · contrôle ${control} · ${solvedSteps.has(k) ? "solution partagée" : "pas encore de solution"}`,
          status: control === "required" ? "garde-fou : expliquer la règle" : solvedSteps.has(k) ? "résolue" : "à résoudre",
        };
      }),
    },
    regles: {
      content: [
        "**On mesure le process, jamais la personne.** Chaque ligne est une étape ; on compte des détours, pas des gens.",
        "Les signatures sont chiffrées sur les postes et n'ont aucune identité : impossible de savoir qui a bloqué.",
        "Fourchettes sur 7 jours glissants. `required` = garde-fou voulu (validation, conformité) : on l'explique, on ne le contourne pas.",
        synthetic ? "\n**Contient des données de démonstration** (population synthétique, annoncée comme telle)." : "",
      ].join("\n\n"),
    },
  };
}

async function listAll(store: TeamStore, kind: "signature" | "request" | "solution") {
  const out: { id: number; at: string; payload: any }[] = [];
  for (let after = 0; ; ) {
    const page = await store.list(kind, after);
    if (!page.length) return out;
    out.push(...page);
    after = page.at(-1)!.id;
  }
}

/** Remplit chaque bloc de la Live View. Renvoie les blocs mis à jour. */
export async function publishMap(store: TeamStore): Promise<string[]> {
  const payloads = await buildMap(store);
  const r = await fetch(`${API}/outputs/targets?pipe=${MAP_PIPE}`, { headers: auth });
  if (!r.ok) throw new Error(`/outputs/targets HTTP ${r.status}`);
  const targets = ((await r.json()).data ?? []) as { id: string; revision: number }[];
  const done: string[] = [];
  for (const t of targets) {
    const block = t.id.split(":").at(-1)!;
    const payload = (payloads as Record<string, unknown>)[block];
    if (!payload) continue;
    const s = await fetch(`${API}/outputs/targets/${encodeURIComponent(t.id)}/submit`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ target_revision: t.revision, source_pipe: MAP_PIPE, payload }),
    });
    if (!s.ok) throw new Error(`soumission ${t.id} : HTTP ${s.status} ${(await s.text()).slice(0, 200)}`);
    done.push(block);
  }
  return done;
}
