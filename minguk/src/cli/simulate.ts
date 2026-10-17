/**
 * Simulateur de clients Crisp : une page locale envoie les messages des clients de la démo, sous leur
 * identité, dans la vraie boîte Crisp. Avec le jeton Screenpipe, il surveille aussi Crisp et affiche
 * le délai réel entre l'envoi et la détection.
 *
 * `bun run simulate`   puis ouvrir http://127.0.0.1:4518 (FRICTION_SIM_PORT pour changer de port)
 */
import { CrispWatcher } from "../detect/crisp-watcher.ts";
import { CRISP_CUSTOMERS } from "../seed/crisp-story.ts";
import { customerPage, indexPage } from "../sim/page.ts";

const port = Number(process.env.FRICTION_SIM_PORT || 4518);
const time = (ms: number) => {
	const date = new Date(ms);
	return `${date.toLocaleTimeString("fr-FR")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
};
/** Comparaison tolérante aux accents et à la casse : l'OCR lit parfois « Elodie » pour « Élodie ». */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const pending: { nickname: string; at: number }[] = [];

Bun.serve({
	hostname: "127.0.0.1",
	port,
	async fetch(request) {
		const url = new URL(request.url);
		const html = (body: string) => new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
		if (url.pathname === "/") return html(indexPage());
		const match = url.pathname.match(/^\/client\/([\w-]+)$/);
		const customer = match && CRISP_CUSTOMERS.find((candidate) => candidate.key === match[1]);
		if (customer) return html(customerPage(customer));
		if (url.pathname === "/sent" && request.method === "POST") {
			const sent = (await request.json()) as { customer: string; text: string; at: number };
			const who = CRISP_CUSTOMERS.find((candidate) => candidate.key === sent.customer);
			if (who) {
				pending.push({ nickname: who.nickname, at: sent.at });
				console.log(`${time(sent.at)}  ➜ envoyé par ${who.nickname} : « ${sent.text.slice(0, 60)} »`);
			}
			return new Response(null, { status: 204 });
		}
		return new Response("Introuvable", { status: 404 });
	},
});
console.log(`Simulateur : http://127.0.0.1:${port}`);

const apiKey = process.env.SCREENPIPE_API_KEY;
if (!apiKey) {
	console.log("SCREENPIPE_API_KEY absent : pas de mesure de détection (source ~/.config/screenpipe/env).");
} else {
	const watcher = new CrispWatcher({
		screenpipeUrl: process.env.SCREENPIPE_URL || "http://127.0.0.1:3030",
		apiKey,
		onEvent: (event) => {
			const capture = `capture → détection ${((event.detectedAt - event.frameAt) / 1000).toFixed(1)} s`;
			if (event.kind === "message") {
				const index = pending.findIndex((sent) => fold(event.name).startsWith(fold(sent.nickname).slice(0, 6)));
				const sent = index >= 0 ? pending.splice(index, 1)[0] : undefined;
				const total = sent ? ` · ${((event.detectedAt - sent.at) / 1000).toFixed(1)} s après l'envoi` : "";
				console.log(`${time(event.detectedAt)}  💬 détecté : ${event.name} « ${event.preview} » (${capture}${total})`);
			} else if (event.kind === "unread") {
				const first = pending[0];
				const total = first ? ` · ${((event.detectedAt - first.at) / 1000).toFixed(1)} s après l'envoi` : "";
				console.log(`${time(event.detectedAt)}  🔴 ${event.count} non lu(s), ${event.where === "crisp" ? "onglet Crisp" : "vu depuis un autre onglet"} (${capture}${total})`);
			} else {
				console.log(`${time(event.detectedAt)}  👀 conversation ouverte : ${event.name}`);
			}
		},
	});
	// Screenpipe refuse parfois une recherche (« search is busy ») : on ne le signale que si ça dure.
	let failures = 0;
	setInterval(() => {
		watcher
			.tick()
			.then(() => {
				failures = 0;
			})
			.catch((error: Error) => {
				if (++failures === 5) console.error(`${time(Date.now())}  Screenpipe ne répond plus depuis 5 s : ${error.message}`);
			});
	}, 1_000);
	console.log("Surveillance de Crisp via Screenpipe : active.");
}
