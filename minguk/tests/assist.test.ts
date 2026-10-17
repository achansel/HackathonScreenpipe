import { describe, expect, test } from "bun:test";
import { CrispAssistant } from "../src/assist/assistant.ts";
import { CallAssistant } from "../src/assist/call-assistant.ts";
import { classify, helpsFor } from "../src/assist/crisp-assist.ts";
import type { CustomerCard } from "../src/assist/hubspot-lookup.ts";
import { buildPayload, lintPayload } from "../src/notify/templates.ts";
import type { Episode } from "../src/notify/types.ts";

const NOW = Date.parse("2026-10-17T16:00:00+02:00");
const context = { now: NOW, ruleConfirmedAt: NOW - 5 * 86_400_000, slack: { bugs: "https://slack/bugs", support: "https://slack/support", newLeads: "https://slack/leads" } };

const jean: CustomerCard = {
	contactId: "1",
	name: "Jean Dupont",
	company: { id: "2", name: "Le Bistro", plan: "Premium" },
	deal: { id: "3", name: "Le Bistro · Offre Premium", stage: "closedwon", seller: "Thomas Girard" },
	contactUrl: "https://hubspot/contact/1",
	companyUrl: "https://hubspot/company/2",
	dealUrl: "https://hubspot/deal/3",
};
const elodie: CustomerCard = {
	...jean,
	name: "Élodie Marchand",
	company: { id: "4", name: "Maison Pivoine", plan: "Premium" },
	deal: { id: "5", name: "Maison Pivoine · Offre Premium", stage: "closedwon", seller: "Thomas Girard" },
};

describe("Reconnaître le besoin", () => {
	test("les messages de la démo", () => {
		expect(classify("Bonjour, ma page de réservation est en panne !!")).toEqual(["bug"]);
		expect(classify("Toujours rien… J'ai perdu des réservations ce midi, je veux un dédommagement.")).toEqual(["geste"]);
		expect(classify("Thomas m'avait promis l'installation sur place gratuite")).toEqual(["promesse"]);
		expect(classify("Bonjour, combien pour 3 restaurants ? Nous sommes à Bruxelles.")).toEqual(["prospect"]);
		expect(classify("le restaurant de Toulon n'envoie pas les rappels SMS")).toEqual(["bug"]);
		expect(classify("Merci, tout marche")).toEqual([]);
	});
});

describe("Les aides", () => {
	const all = (episodes: Episode[]) => episodes.map((episode) => buildPayload(episode, { now: () => NOW }));

	test("Jean demande un dédommagement : sa fiche, puis la règle avec sa réponse", () => {
		const helps = helpsFor({ name: "Jean Dupont", text: "je veux un dédommagement" }, jean, context);
		expect(helps.map((help) => help.stage)).toEqual(["qui-est-le-client", "geste-commercial"]);
		const [card, rule] = all(helps);
		expect(card!.title).toBe("🧭 Jean Dupont · Le Bistro");
		expect(card!.body).toContain("Offre Premium · retrouvé par son nom.");
		expect(rule!.body).toContain("Premium : 1 mois offert possible.");
		expect(rule!.actions.find((action) => action.id === "reply")).toMatchObject({ value: expect.stringContaining("un mois d'abonnement") });
	});

	test("client Essentiel : la règle propose le bon de 10 %", () => {
		const essentiel = { ...jean, company: { id: "2", name: "Au Vieux Four", plan: "Essentiel" } };
		const [, rule] = all(helpsFor({ name: "Jeanne Roux", text: "je veux un geste" }, essentiel, context));
		expect(rule!.body).toContain("Ici : un bon de 10 %.");
	});

	test("Élodie et la promesse de Thomas : rien de noté, demander à Thomas", () => {
		const [, rule] = all(helpsFor({ name: "Élodie Marchand", text: "Thomas m'avait promis l'installation gratuite" }, elodie, context));
		expect(rule!.body).toContain("Rien dans « Conditions particulières ».");
		expect(rule!.body).toContain("Demander à Thomas Girard avant de répondre.");
	});

	test("prospect belge, absent de HubSpot : pas de fiche, le canal #new-leads pour Sarah", () => {
		const helps = helpsFor({ name: "Pieter Janssens", text: "combien pour 3 restaurants ? Nous sommes à Bruxelles." }, undefined, context);
		expect(helps.map((help) => help.stage)).toEqual(["nouveau-prospect"]);
		expect(all(helps)[0]!.title).toBe("💬 Prospect belge → Sarah → #new-leads");
	});

	test("toutes les aides de la démo passent le contrôle d'affichage", () => {
		const cases: [string, string, CustomerCard | undefined][] = [
			["Jean Dupont", "ma page de réservation est en panne, je veux un dédommagement", jean],
			["Élodie Marchand", "Thomas m'avait promis l'installation", elodie],
			["Pieter Janssens", "combien pour 3 restaurants à Bruxelles", undefined],
			["Sophie Arnaud", "le restaurant de Toulon n'envoie pas les rappels SMS", { ...jean, name: "Sophie Arnaud", company: { id: "9", name: "Groupe Saveurs du Sud", plan: "Groupe" } }],
		];
		for (const [name, text, card] of cases) {
			for (const payload of all(helpsFor({ name, text }, card, context))) expect({ id: payload.id, problems: lintPayload(payload) }).toEqual({ id: payload.id, problems: [] });
		}
	});
});

describe("L'assistant", () => {
	function setup(cards: Record<string, CustomerCard[]> = { "Jean Dupont": [jean] }) {
		const requested: Episode[] = [];
		const logs: string[] = [];
		const assistant = new CrispAssistant({
			findCustomer: async (name) => cards[name] ?? [],
			requestHelp: async (episode) => {
				requested.push(episode);
			},
			context: () => context,
			log: (line) => logs.push(line),
			now: () => NOW,
		});
		return { assistant, requested, logs };
	}

	test("prénom seul (« Jean > Andrea ») : on attend que la conversation soit ouverte", async () => {
		const t = setup();
		await t.assistant.onEvent({ kind: "message", name: "Jean", preview: "je veux un dédommagement", frameAt: NOW, detectedAt: NOW });
		expect(t.requested).toEqual([]);
		await t.assistant.onEvent({ kind: "opened", name: "Jean Dupont", frameAt: NOW, detectedAt: NOW });
		expect(t.requested.map((episode) => episode.stage)).toEqual(["qui-est-le-client", "geste-commercial"]);
	});

	test("le même message relu ne redemande pas d'aide", async () => {
		const t = setup();
		const event = { kind: "message" as const, name: "Jean Dupont", preview: "ma page est en panne", frameAt: NOW, detectedAt: NOW };
		await t.assistant.onEvent(event);
		await t.assistant.onEvent(event);
		expect(t.requested).toHaveLength(2);
	});

	test("deux contacts du même nom : pas de fiche choisie au hasard", async () => {
		const t = setup({ "Jean Dupont": [jean, { ...jean, contactId: "99" }] });
		await t.assistant.onEvent({ kind: "message", name: "Jean Dupont", preview: "ma page est en panne", frameAt: NOW, detectedAt: NOW });
		expect(t.requested.map((episode) => episode.stage)).toEqual(["signaler-un-bug"]);
		expect(t.logs[0]).toContain("2 contacts");
	});
});

describe("L'assistant d'appel", () => {
	// null = client inconnu (undefined déclencherait la valeur par défaut).
	function setup(known: CustomerCard | null = jean) {
		const card = known ?? undefined;
		const requested: Episode[] = [];
		const assistant = new CallAssistant({
			customer: { name: card?.name ?? "Client inconnu", card },
			requestHelp: async (episode) => {
				requested.push(episode);
			},
			context: () => context,
			log: () => {},
		});
		return { assistant, stages: () => requested.map((episode) => episode.stage) };
	}

	test("la fiche dès le début de l'appel, puis une aide par besoin, une seule fois", async () => {
		const t = setup();
		await t.assistant.onSentence("");
		await t.assistant.onSentence("Bonjour ma page de réservation est en panne.");
		await t.assistant.onSentence("Je vous rends un dédommagement s'il vous plaît.");
		await t.assistant.onSentence("Oui, vraiment, un dédommagement !");
		expect(t.stages()).toEqual(["qui-est-le-client", "signaler-un-bug", "geste-commercial"]);
	});

	test("client inconnu : pas de fiche, mais les règles et les canaux", async () => {
		const t = setup(null);
		await t.assistant.onSentence("");
		await t.assistant.onSentence("Bonjour, combien pour trois restaurants ? On est à Bruxelles.");
		expect(t.stages()).toEqual(["nouveau-prospect"]);
	});
});
