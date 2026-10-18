/**
 * Studio des notifications : chaque cas de la démo en plusieurs variantes, rendues comme le panneau
 * Screenpipe, modifiables en direct, envoyables dans le vrai panneau, et un choix par cas.
 *
 * `bun run studio:notifs`   puis http://127.0.0.1:4520
 *
 * Tout est enregistré dans build/notification-studio.json (variantes, choix, remarques) : c'est ce fichier
 * qui sert à écrire la proposition pour le démon d'Andrea. Aucun jeton n'est lu : /notify n'en demande pas.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { slackUrls } from "../assist/slack-urls.ts";
import { loadConfig } from "../config.ts";
import { sendNotification } from "../notify/client.ts";
import { PIPE_NAME } from "../notify/templates.ts";
import type { NotifyAction } from "../notify/types.ts";
import { defaultCases, type StudioCase, type StudioVariant } from "../studio/variants.ts";

interface StudioState {
	cases: StudioCase[];
	choices: Record<string, string>;
	notes: Record<string, string>;
	updatedAt?: string;
}

const config = loadConfig(process.env, { requireApiKey: false });
const port = Number(process.env.FRICTION_STUDIO_PORT || 4520);
const stateFile = new URL("../../build/notification-studio.json", import.meta.url).pathname;
const page = new URL("../studio/page.html", import.meta.url).pathname;

const defaults = () =>
	defaultCases({
		jeanContact: process.env.DEMO_HUBSPOT_RECORD_URL || "https://app-eu1.hubspot.com/contacts/149568075/record/0-1/894330156269",
		bugsChannel: slackUrls().bugs,
		notionRule: process.env.DEMO_NOTION_RULE_URL || "https://www.notion.so/",
		myPage: "http://127.0.0.1:4322/moi",
	});

function load(): StudioState {
	if (!existsSync(stateFile)) return { cases: defaults(), choices: {}, notes: {} };
	// Les cas ajoutés depuis le dernier enregistrement apparaissent, sans toucher aux cas déjà modifiés.
	const saved = JSON.parse(readFileSync(stateFile, "utf8")) as StudioState;
	const all = defaults();
	saved.cases = all.map((c) => {
		const kept = saved.cases.find((s) => s.key === c.key);
		if (!kept) return c;
		// Les variantes ajoutées depuis : à la suite des variantes déjà enregistrées.
		const missing = c.variants.filter((v) => !kept.variants.some((k) => k.id === v.id));
		return { ...kept, variants: [...kept.variants, ...missing] };
	});
	return saved;
}

function toPayload(variant: StudioVariant, id: string) {
	const actions: NotifyAction[] = variant.buttons.map((button, index) =>
		button.kind === "lien"
			? { id: `b${index}`, label: button.label, type: "link", url: button.value, primary: button.primary }
			: { id: `b${index}`, label: button.label, type: "copy", value: button.value || "(retour envoyé au démon)", primary: button.primary },
	);
	return { id, title: variant.title, body: variant.body, pipe_name: PIPE_NAME, priority: "normal" as const, timeout: 0, actions };
}

let sent = 0;
Bun.serve({
	port,
	hostname: "127.0.0.1",
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === "/") return new Response(Bun.file(page), { headers: { "Content-Type": "text/html; charset=utf-8" } });
		if (url.pathname === "/api/state" && request.method === "GET") return Response.json(load());
		if (url.pathname === "/api/defaults") return Response.json(defaults());
		if (url.pathname === "/api/state" && request.method === "POST") {
			const state = (await request.json()) as StudioState;
			writeFileSync(stateFile, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, "\t")}\n`);
			return Response.json({ ok: true });
		}
		if (url.pathname === "/api/send" && request.method === "POST") {
			const variant = (await request.json()) as StudioVariant;
			// Identifiant unique : Screenpipe écarte une notification identique dans les 90 s.
			const outcome = await sendNotification(toPayload(variant, `studio-${Date.now().toString(36)}-${sent++}`), { notifyUrl: config.notifyUrl });
			console.log(`${new Date().toLocaleTimeString("fr-FR")}  envoyée « ${variant.title} » : ${outcome}`);
			return Response.json({ outcome });
		}
		return new Response("introuvable", { status: 404 });
	},
});
console.log(`Studio des notifications : http://127.0.0.1:${port}\nChoix et modifications enregistrés dans ${stateFile}`);
