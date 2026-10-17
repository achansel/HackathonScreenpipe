/**
 * Essai « appel » : écoute la transcription en direct d'une réunion Screenpipe et mesure son délai.
 * Chaque phrase finale passe dans la même reconnaissance de besoin que Crisp (src/assist/crisp-assist.ts).
 *
 * `bun run listen:call`                    écoute la réunion en cours (lancée à la main, ou détectée : Meet…)
 * `bun run listen:call --start "Appel"`    démarre une réunion Screenpipe, puis écoute ; Ctrl+C l'arrête
 *
 * Prérequis : transcription en direct des réunions activée dans Screenpipe (meetingLiveTranscriptionEnabled).
 */
import { parseArgs } from "node:util";
import { classify } from "../assist/crisp-assist.ts";
import { loadConfig } from "../config.ts";

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { start: { type: "string" } } });
const config = loadConfig();
const headers = { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" };
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR");

interface Item {
	meetingId: number;
	itemId: string;
	deviceType: string;
	speakerName?: string | null;
	text: string;
	capturedAt: string;
}

let startedHere = false;
if (values.start !== undefined) {
	const response = await fetch(`${config.screenpipeUrl}/meetings/start`, {
		method: "POST",
		headers,
		body: JSON.stringify({ title: values.start || "Appel client", app: "manual" }),
	});
	console.log(`Réunion démarrée : HTTP ${response.status} ${(await response.text()).slice(0, 160)}`);
	startedHere = response.ok;
}

async function stop(): Promise<void> {
	if (startedHere) {
		const response = await fetch(`${config.screenpipeUrl}/meetings/stop`, { method: "POST", headers, body: "{}" });
		console.log(`Réunion arrêtée : HTTP ${response.status}`);
	}
	process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const url = `${config.screenpipeUrl.replace(/^http/, "ws")}/ws/meeting-overlay`;
// Bun accepte des en-têtes à l'ouverture d'un WebSocket ; le jeton passe aussi en paramètre, au cas où.
const socket = new WebSocket(`${url}?token=${encodeURIComponent(config.apiKey ?? "")}`, { headers } as unknown as string[]);
socket.addEventListener("open", () => console.log(`${time(Date.now())}  connecté à ${url} · parlez, Ctrl+C pour arrêter`));
socket.addEventListener("close", (event) => console.log(`${time(Date.now())}  connexion fermée (${event.code} ${event.reason})`));
socket.addEventListener("error", () => console.error(`${time(Date.now())}  erreur WebSocket`));

const lastDelta = new Map<string, number>();
socket.addEventListener("message", (event) => {
	const message = JSON.parse(String(event.data)) as { type: string; data: unknown };
	if (message.type === "status") {
		console.log(`${time(Date.now())}  statut : ${JSON.stringify(message.data).slice(0, 200)}`);
		return;
	}
	if (message.type === "snapshot") {
		const data = message.data as { meetingId: number; items: Item[] };
		console.log(`${time(Date.now())}  réunion ${data.meetingId} : ${data.items.length} phrase(s) déjà transcrite(s)`);
		return;
	}
	const item = message.data as Item;
	const key = `${item.deviceType}:${item.itemId}`;
	const captured = Date.parse(item.capturedAt);
	const delay = Number.isFinite(captured) ? ` · ${((Date.now() - captured) / 1000).toFixed(1)} s après la capture` : "";
	if (message.type === "delta") {
		// Les morceaux en cours : on n'affiche que le premier de chaque phrase, pour mesurer la réactivité.
		if (!lastDelta.has(key)) console.log(`${time(Date.now())}  … ${item.deviceType === "input" ? "micro" : "son"} : « ${item.text} »${delay}`);
		lastDelta.set(key, Date.now());
		return;
	}
	if (message.type === "final") {
		const needs = classify(item.text);
		console.log(`${time(Date.now())}  ✔ ${item.deviceType === "input" ? "micro" : "son"} : « ${item.text} »${delay}${needs.length ? `  → besoin : ${needs.join(", ")}` : ""}`);
	}
});
