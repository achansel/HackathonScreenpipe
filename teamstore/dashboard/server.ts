// Serveur de la page (démo et « mon poste ») : sert les fichiers, relaie les notifications vers Screenpipe
// et montre ce que voit l'opérateur du stockage. Le chiffrement se fait DANS LE NAVIGATEUR (demo/app.ts),
// qui parle directement au stockage : ce serveur ne voit jamais une clé d'équipe.
// Lancé par teamstore/dashboard/serve.ts (une commande, Mac/Windows/Linux).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PageOptions {
  port: number;
  store: { url: string; anonKey: string; restPath: string; label: string; slack?: object; escaladeSeconds?: number; crisp?: boolean; liveView?: boolean; alerteSeconds?: number };
  storeMoi?: { url: string; anonKey: string; restPath: string; label: string }; // « Mon poste » : le stockage de l'équipe, même en mode démo
  operator?: () => unknown;       // vue opérateur (base locale de cette machine)
  reset?: () => void;             // remise à zéro (base locale non partagée seulement)
  notifyUrl?: string;
  live?: (blocks: Record<string, unknown>) => Promise<{ ok: boolean; blocks?: string[]; error?: string }>; // Live View Screenpipe
  regie?: (since: number, publish: boolean) => Promise<unknown>; // régie de répétition : vraies réactions
  night?: (cases: { step: string; context: string; label?: string }[]) => Promise<unknown>; // boucle de nuit (vraie IA)
  match?: (step: string, catalogue: { id: string; step: string }[]) => Promise<string | null>; // quelle solution répond à cette étape
}

const DIR = import.meta.dir;
const SEED = join(DIR, "..", "..", "agent", "solutions.seed.json");
const NO_OPERATOR = { teams: [], blobs: [], note: "Vue opérateur indisponible ici : le stockage est sur une autre machine (Supabase : ouvrir le Table Editor)." };

export async function startPage(o: PageOptions) {
  const bundle = async (entry: string) => {
    const b = await Bun.build({ entrypoints: [join(DIR, entry)], target: "browser" });
    if (!b.success) throw new AggregateError(b.logs, `compilation de ${entry}`);
    return b.outputs[0].text();
  };
  const appJs = await bundle("app.ts");
  const parcoursJs = await bundle("parcours.ts");
  const regieJs = await bundle("regie-page.ts");
  // Événements poussés vers les pages ouvertes (détection Crisp de Minguk) : Server-Sent Events.
  const listeners = new Set<ReadableStreamDefaultController>();
  const broadcast = (event: unknown) => {
    const chunk = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
    for (const c of listeners) { try { c.enqueue(chunk); } catch { listeners.delete(c); } }
  };
  const notifyUrl = o.notifyUrl ?? Bun.env.SCREENPIPE_NOTIFY_URL ?? "http://127.0.0.1:11435";
  const file = (name: string, type: string) => new Response(readFileSync(join(DIR, name)), { headers: { "Content-Type": type } });
  const sameOrigin = (req: Request) => req.headers.get("x-fa-demo") === "1"; // bloque les requêtes d'autres sites

  const server = Bun.serve({
    idleTimeout: 0, // flux d'événements ouvert en continu
    hostname: "127.0.0.1", // la page n'est jamais exposée sur le réseau
    port: o.port,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      try {
        if (path === "/" || path === "/accueil") return file("accueil.html", "text/html; charset=utf-8");
        if (path === "/equipe" || path === "/index.html") return file("index.html", "text/html; charset=utf-8");
        if (path === "/moi") return file("moi.html", "text/html; charset=utf-8");
        if (path === "/parcours") return file("parcours.html", "text/html; charset=utf-8");
        if (path === "/repetition") return file("regie.html", "text/html; charset=utf-8");
        if (path === "/regie.js") return new Response(regieJs, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
        if (path === "/api/regie" && o.regie) {
          const q = new URL(req.url).searchParams;
          return Response.json(await o.regie(Number(q.get("since") ?? Date.now()), q.get("live") === "1"));
        }
        if (path === "/parcours.js") return new Response(parcoursJs, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
        if (path === "/api/events") {
          let ctl: ReadableStreamDefaultController;
          const stream = new ReadableStream({ start(c) { ctl = c; listeners.add(c); c.enqueue(new TextEncoder().encode(": ok\n\n")); }, cancel() { listeners.delete(ctl); } });
          return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
        }
        // Secours et tests : simuler un message Crisp (même format que la détection de Minguk).
        if (path === "/api/crisp/inject" && req.method === "POST" && sameOrigin(req)) {
          const { name, text } = (await req.json()) as { name: string; text: string };
          broadcast({ type: "crisp", simulated: true, event: { kind: "message", name, preview: text, frameAt: Date.now(), detectedAt: Date.now() } });
          return Response.json({ ok: true });
        }
        if (path === "/style.css") return file("style.css", "text/css; charset=utf-8");
        if (path === "/app.js") return new Response(appJs, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
        if (path === "/api/config") return Response.json(new URL(req.url).searchParams.get("page") === "moi" && o.storeMoi ? { ...o.store, ...o.storeMoi } : o.store);
        if (path === "/api/seed") return new Response(readFileSync(SEED), { headers: { "Content-Type": "application/json" } });
        if (path === "/api/operator") return Response.json(o.operator ? o.operator() : NO_OPERATOR);
        if (path === "/api/notify" && req.method === "POST" && sameOrigin(req)) {
          const r = await fetch(`${notifyUrl}/notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await req.text(), signal: AbortSignal.timeout(5000) });
          const j = (await r.json().catch(() => ({}))) as { message?: string };
          return Response.json({ message: j.message ?? `HTTP ${r.status}` });
        }
        if (path === "/api/live" && req.method === "POST" && sameOrigin(req)) {
          if (!o.live) return Response.json({ ok: false, error: "jeton Screenpipe absent" });
          return Response.json(await o.live(((await req.json()) as { blocks: Record<string, unknown> }).blocks));
        }
        if (path === "/api/nuit" && req.method === "POST" && sameOrigin(req)) {
          if (!o.night) return Response.json({ error: "jeton Screenpipe absent" });
          try { return Response.json({ findings: await o.night(((await req.json()) as { cases: any[] }).cases) }); }
          catch (e) { return Response.json({ error: (e as Error).message }); }
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
  return { server, broadcast };
}
