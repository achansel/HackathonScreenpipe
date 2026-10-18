/**
 * Un appel client avec l'aide en direct : Screenpipe transcrit, chaque phrase passe par la même
 * reconnaissance de besoin que Crisp, et l'aide arrive dans le panneau de notifications.
 *
 * `bun run call --client "Jean Dupont"`   démarre l'appel, retrouve le client dans HubSpot, aide en direct
 * `bun run call`                          client inconnu : seulement les canaux et les règles
 * `bun run call --client "Jean Dupont" --sans-aide`   seulement l'appel et sa transcription : quand le
 *                                         démon d'Andrea tourne, c'est lui qui écoute et décide de l'aide
 * Ctrl+C termine l'appel.
 *
 * Jetons : ~/.config/screenpipe/env, et ~/.config/friction/env pour la fiche HubSpot.
 */
import { parseArgs } from "node:util";
import { CallAssistant } from "../assist/call-assistant.ts";
import { type CustomerCard, HubSpotLookup } from "../assist/hubspot-lookup.ts";
import { slackUrls } from "../assist/slack-urls.ts";
import { loadConfig } from "../config.ts";
import { listenToMeeting, startMeeting, stopMeeting } from "../detect/call-listener.ts";
import { createNotifier } from "../notify/index.ts";
import { HubSpot } from "../seed/hubspot.ts";

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { client: { type: "string" }, "sans-aide": { type: "boolean" } } });
const DAY_MS = 24 * 60 * 60 * 1000;
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR");
const log = (line: string) => console.log(`${time(Date.now())}  ${line}`);

// Le simulateur Crisp peut tourner en même temps : la redirection des clics prend un autre port.
const config = { ...loadConfig(), port: Number(process.env.FRICTION_CALL_PORT || 4519) };
const apiKey = config.apiKey!;

const name = values.client?.trim() || "Client inconnu";
const withHelp = !values["sans-aide"];
let card: CustomerCard | undefined;
if (withHelp && values.client && process.env.HUBSPOT_SEED_TOKEN) {
	const api = new HubSpot(process.env.HUBSPOT_SEED_TOKEN);
	const account = await api.accountDetails();
	const cards = await new HubSpotLookup(api, account).byName(name);
	card = cards.length === 1 ? cards[0] : undefined;
	log(card ? `client : ${card.name} · ${card.company?.name ?? "?"} · ${card.company?.plan ?? "offre inconnue"}` : `« ${name} » : ${cards.length} fiche(s) HubSpot, aucune choisie`);
} else if (withHelp && values.client) {
	log("HUBSPOT_SEED_TOKEN absent (source ~/.config/friction/env) : pas de fiche client");
}

const notifier = createNotifier(config, { dbPath: ":memory:", slotMs: 6_000, trackIntervalMs: 2_000 });
notifier.onOutcome((id, status, detail) => log(`   ${id.replace(/^crisp-/, "")} → ${status}${detail ? ` (${detail})` : ""}`));
const slack = slackUrls();
const assistant = new CallAssistant({
	customer: { name, card },
	requestHelp: (episode) => notifier.requestHelp(episode),
	context: () => ({ now: Date.now(), slack, ruleConfirmedAt: Date.now() - 5 * DAY_MS }),
	log,
});

const listener = listenToMeeting({
	screenpipeUrl: config.screenpipeUrl,
	apiKey,
	onPartial: (item) => log(`… ${item.deviceType === "input" ? "Léa" : "client"} : « ${item.text} »`),
	onSentence: (item) => {
		const delay = ((Date.now() - Date.parse(item.capturedAt)) / 1000).toFixed(1);
		log(`✔ ${item.deviceType === "input" ? "Léa" : "client"} : « ${item.text} » (${delay} s)`);
		if (withHelp) assistant.onSentence(item.text).catch((error: Error) => log(`⚠ aide : ${error.message}`));
	},
	onClose: (code) => log(`transcription fermée (${code})`),
});
await listener.opened;
const meetingId = await startMeeting(config.screenpipeUrl, apiKey, `Appel ${name}`);
log(`appel « ${name} » en cours (réunion Screenpipe ${meetingId})${withHelp ? "" : ", sans aide : le démon écoute"} · Ctrl+C pour raccrocher`);
// La fiche du client dès le début de l'appel : Léa sait qui parle avant la première phrase.
if (withHelp) await assistant.onSentence("");

async function hangUp(): Promise<never> {
	await stopMeeting(config.screenpipeUrl, apiKey).catch(() => {});
	listener.close();
	notifier.stop();
	log("appel terminé");
	process.exit(0);
}
process.on("SIGINT", hangUp);
process.on("SIGTERM", hangUp);
