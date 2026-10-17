/**
 * Mesure seule : écoute la transcription en direct d'une réunion Screenpipe et affiche, pour chaque
 * phrase, son délai et le besoin lu. Pour l'appel avec les aides, voir `bun run call`.
 *
 * `bun run listen:call`                    écoute la réunion en cours (démarrée à la main)
 * `bun run listen:call --start "Appel"`    démarre une réunion Screenpipe, puis écoute ; Ctrl+C l'arrête
 */
import { parseArgs } from "node:util";
import { classify } from "../assist/crisp-assist.ts";
import { loadConfig } from "../config.ts";
import { listenToMeeting, startMeeting, stopMeeting } from "../detect/call-listener.ts";

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { start: { type: "string" } } });
const config = loadConfig();
const apiKey = config.apiKey!;
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR");
const delay = (capturedAt: string) => `${((Date.now() - Date.parse(capturedAt)) / 1000).toFixed(1)} s après la capture`;
const source = (deviceType: string) => (deviceType === "input" ? "micro" : "son");

const listener = listenToMeeting({
	screenpipeUrl: config.screenpipeUrl,
	apiKey,
	onStatus: (status) => console.log(`${time(Date.now())}  statut : ${JSON.stringify(status).slice(0, 200)}`),
	onPartial: (item) => console.log(`${time(Date.now())}  … ${source(item.deviceType)} : « ${item.text} » · ${delay(item.capturedAt)}`),
	onSentence: (item) => {
		const needs = classify(item.text);
		console.log(`${time(Date.now())}  ✔ ${source(item.deviceType)} : « ${item.text} » · ${delay(item.capturedAt)}${needs.length ? `  → besoin : ${needs.join(", ")}` : ""}`);
	},
});
await listener.opened;
console.log(`${time(Date.now())}  connecté · parlez, Ctrl+C pour arrêter`);
const started = values.start !== undefined;
if (started) console.log(`Réunion démarrée : ${await startMeeting(config.screenpipeUrl, apiKey, values.start || "Appel client")}`);

process.on("SIGINT", async () => {
	if (started) await stopMeeting(config.screenpipeUrl, apiKey);
	listener.close();
	process.exit(0);
});
