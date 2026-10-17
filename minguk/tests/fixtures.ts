import type { Episode, Help, PathHelp, RuleHelp, SlackHelp } from "../src/notify/types.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const pathHelp: PathHelp = {
	kind: "path",
	destination: "Produits du contrat signé",
	breadcrumb: ["Contact", "Transactions", "Contrat signé", "Produits"],
	url: "https://app.hubspot.com/contacts/1/record/0-3/2",
	fallbackUrl: "https://app.hubspot.com/contacts/1/record/0-1/3",
	teamCount: 5,
};

export const slackHelp: SlackHelp = {
	kind: "slack",
	reason: "Bug client",
	channel: "#bugs",
	channelUrl: "slack://channel?team=T1&id=C1",
	message: "[Bug] Le Bistro · page en panne\nClient : Jean Dupont",
};

export const ruleHelp: RuleHelp = {
	kind: "rule",
	title: "Geste commercial : 1 mois offert max",
	condition: "Premium seulement.",
	exception: "Sinon : un bon de 10 %.",
	action: "Note `geste commercial` dans HubSpot.",
	confirmedAt: 0,
	recordUrl: "https://app.hubspot.com/contacts/1/record/0-1/3",
	note: "Geste commercial : 1 mois offert.",
	reply: "Bonjour Jean, nous vous offrons un mois.",
};

let counter = 0;

export function episode(help: Help, overrides: Partial<Episode> = {}): Episode {
	counter += 1;
	return {
		id: `ep-${counter}`,
		stage: "etape-test",
		createdAt: 0,
		customerWaiting: false,
		help,
		...overrides,
	};
}
