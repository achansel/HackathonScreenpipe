// Serveur de la page (démo et « mon poste ») : sert les fichiers, relaie les notifications vers Screenpipe
// et montre ce que voit l'opérateur du stockage. Le chiffrement se fait DANS LE NAVIGATEUR (demo/app.ts),
// qui parle directement au stockage : ce serveur ne voit jamais une clé d'équipe.
// Lancé par teamstore/start.ts (une commande, Mac/Windows/Linux).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PageOptions {
  port: number;
  store: { url: string; anonKey: string; restPath: string; label: string; slack?: object; escaladeSeconds?: number };
  operator?: () => unknown;       // vue opérateur (base locale de cette machine)
  reset?: () => void;             // remise à zéro (base locale non partagée seulement)
  notifyUrl?: string;
  match?: (step: string, catalogue: { id: string; step: string }[]) => Promise<string | null>; // quelle solution répond à cette étape
}

const DIR = import.meta.dir;
const SEED = join(DIR, "..", "..", "andrea", "daemon", "solutions.seed.json");
const NO_OPERATOR = { teams: [], blobs: [], note: "Vue opérateur indisponible ici : le stockage est sur une autre machine (Supabase : ouvrir le Table Editor)." };

export async function startPage(o: PageOptions) {
  const build = await Bun.build({ entrypoints: [join(DIR, "app.ts")], target: "browser" });
  if (!build.success) throw new AggregateError(build.logs, "compilation de la page");
  const appJs = await build.outputs[0].text();
  const notifyUrl = o.notifyUrl ?? Bun.env.SCREENPIPE_NOTIFY_URL ?? "http://127.0.0.1:11435";
  const file = (name: string, type: string) => new Response(readFileSync(join(DIR, name)), { headers: { "Content-Type": type } });
  const sameOrigin = (req: Request) => req.headers.get("x-fa-demo") === "1"; // bloque les requêtes d'autres sites

  return Bun.serve({
    hostname: "127.0.0.1", // la page n'est jamais exposée sur le réseau
    port: o.port,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      try {
        if (path === "/" || path === "/index.html") return file("index.html", "text/html; charset=utf-8");
        if (path === "/moi") return file("moi.html", "text/html; charset=utf-8");
        if (path === "/style.css") return file("style.css", "text/css; charset=utf-8");
        if (path === "/app.js") return new Response(appJs, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
        if (path === "/api/config") return Response.json(o.store);
        if (path === "/api/seed") return new Response(readFileSync(SEED), { headers: { "Content-Type": "application/json" } });
        if (path === "/api/operator") return Response.json(o.operator ? o.operator() : NO_OPERATOR);
        if (path === "/api/notify" && req.method === "POST" && sameOrigin(req)) {
          const r = await fetch(`${notifyUrl}/notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await req.text(), signal: AbortSignal.timeout(5000) });
          const j = (await r.json().catch(() => ({}))) as { message?: string };
          return Response.json({ message: j.message ?? `HTTP ${r.status}` });
        }
        if (path === "/api/match" && req.method === "POST" && sameOrigin(req)) {
          const { step, catalogue } = (await req.json()) as { step: string; catalogue: { id: string; step: string }[] };
          return Response.json({ id: o.match ? await o.match(step, catalogue) : null });
        }
        if (path === "/api/reset" && req.method === "POST" && sameOrigin(req)) {
          if (!o.reset) return Response.json({ error: "Remise à zéro impossible : le stockage est partagé (collègues ou Supabase). « Oublier mes clés » sur /moi efface seulement ce navigateur." });
          o.reset();
          return Response.json({ ok: true });
        }
        return new Response("not found", { status: 404 });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 500 });
      }
    },
  });
}
