/**
 * Compare les notifications d'aide avant / après réécriture, dans le vrai panneau Screenpipe.
 * Entrée : notification suivante · q : quitter. Rien n'est enregistré, aucun démon n'est nécessaire.
 *
 * `bun run preview:notifs`            toutes les comparaisons
 * `bun run preview:notifs geste bug`  seulement celles-là (fiche, geste, bug, promesse, prospect, collegue)
 */
import { slackUrls } from "../assist/slack-urls.ts";
import { loadConfig } from "../config.ts";
import { sendNotification } from "../notify/client.ts";
import { type PreviewNotification, proposals } from "../notify/proposals.ts";
import { PIPE_NAME } from "../notify/templates.ts";
import type { NotifyAction } from "../notify/types.ts";

const config = loadConfig(process.env, { requireApiKey: false });
const wanted = Bun.argv.slice(2);
const all = proposals({
	jeanContact: process.env.DEMO_HUBSPOT_RECORD_URL || "https://app-eu1.hubspot.com/contacts/149568075/record/0-1/894330156269",
	bugsChannel: slackUrls().bugs,
}).filter((proposal) => wanted.length === 0 || wanted.includes(proposal.key));

const runId = Date.now().toString(36);
async function show(notification: PreviewNotification, id: string): Promise<string> {
	const actions: NotifyAction[] = notification.buttons.map((button, index) =>
		button.url
			? { id: `b${index}`, label: button.label, type: "link", url: button.url, primary: index === 0 }
			: { id: `b${index}`, label: button.label, type: "copy", value: button.copy ?? button.label, primary: index === 0 },
	);
	// Identifiant unique : Screenpipe écarte une notification identique dans les 90 s.
	return sendNotification(
		{ id: `apercu-${runId}-${id}`, title: notification.title, body: notification.body, pipe_name: PIPE_NAME, priority: "normal", timeout: 0, actions },
		{ notifyUrl: config.notifyUrl },
	);
}

const steps = all.flatMap((proposal) => [
	{ label: `AVANT · ${proposal.label}`, notification: proposal.before, id: `${proposal.key}-avant` },
	{ label: `APRÈS · ${proposal.label}`, notification: proposal.after, id: `${proposal.key}-apres` },
]);

console.log(`${steps.length} notifications à comparer, par paires. Entrée : la suivante · q : quitter.\n`);
let index = 0;
const next = async () => {
	const step = steps[index++];
	if (!step) {
		console.log("\nFini. Les notifications restent dans la cloche de Screenpipe.");
		process.exit(0);
	}
	const outcome = await show(step.notification, step.id);
	console.log(`${index}/${steps.length}  ${step.label}  (${outcome})`);
};
await next();
for await (const line of console) {
	if (line.trim().toLowerCase() === "q") process.exit(0);
	await next();
}
