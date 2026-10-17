import type { Server } from "bun";
import type { StatusBook } from "./outcomes.ts";
import type { Store } from "./store.ts";
import { targetUrl } from "./templates.ts";

/** Les seules destinations qu'on accepte de rouvrir : le web et l'appli Slack. */
const ALLOWED_SCHEMES = new Set(["https:", "http:", "slack:"]);

export function isAllowedTarget(target: string): boolean {
	try {
		return ALLOWED_SCHEMES.has(new URL(target).protocol);
	} catch {
		return false;
	}
}

const EXPIRED_PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Aide expirée</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font:16px system-ui,sans-serif;margin:15vh auto;max-width:28rem;padding:0 16px;color:#222;background:#fff}
@media (prefers-color-scheme:dark){body{color:#eee;background:#1b1b1b}}</style></head>
<body><h1>Cette aide a expiré</h1><p>Le lien ne correspond plus à une aide en cours. Tu peux fermer cet onglet.</p></body></html>`;

export interface RedirectServer {
	/** Le lien à mettre dans le bouton de la notification. */
	link(episodeId: string): string;
	readonly port: number;
	stop(): void;
}

/**
 * `GET /go/:id` : note le clic, puis renvoie le navigateur vers la cible **enregistrée** de l'épisode.
 * Aucune adresse n'est lue dans la requête : pas de redirection ouverte.
 * N'écoute que sur 127.0.0.1.
 */
export function startRedirectServer(options: { port: number; store: Store; book: StatusBook }): RedirectServer {
	const { store, book } = options;
	let server: Server<undefined>;
	try {
		server = Bun.serve({
			hostname: "127.0.0.1",
			port: options.port,
			fetch(request) {
				const url = new URL(request.url);
				if (url.pathname === "/health") return new Response("ok");
				const match = /^\/go\/([^/]+)$/.exec(url.pathname);
				if (request.method !== "GET" || !match?.[1]) return new Response("Not found", { status: 404 });
				const episodeId = decodeURIComponent(match[1]);
				const episode = store.getEpisodeData(episodeId);
				if (!episode) {
					return new Response(EXPIRED_PAGE, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
				}
				const target = targetUrl(episode);
				if (!isAllowedTarget(target)) return new Response("Destination refusée", { status: 400 });
				book.advance(episodeId, "clicked");
				return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
			},
		});
	} catch (error) {
		throw new Error(`Port ${options.port} indisponible pour la redirection : changer FRICTION_PORT`, { cause: error });
	}
	const port = server.port ?? options.port;
	return {
		port,
		link: (episodeId) => `http://127.0.0.1:${port}/go/${encodeURIComponent(episodeId)}`,
		stop: () => server.stop(true),
	};
}
