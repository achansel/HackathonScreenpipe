import { describe, expect, test } from "bun:test";
import { CallEpisodes, customerFromTitle } from "../src/detect/call-episodes.ts";
import type { DaemonEpisode } from "../src/detect/hubspot-detours.ts";

const T0 = Date.parse("2026-10-18T09:00:00Z");
let next = 0;
const say = (deviceType: "input" | "output", text: string, offsetS: number) => ({
	meetingId: 7,
	itemId: `i${next++}`,
	deviceType,
	text,
	capturedAt: new Date(T0 + offsetS * 1000).toISOString(),
});

function setup() {
	const episodes: DaemonEpisode[] = [];
	const events: string[] = [];
	const calls = new CallEpisodes({
		onEpisode: (episode) => episodes.push(episode),
		onCallStart: (call) => events.push(`start ${call.meetingId} ${call.customer ?? "?"}`),
		onCustomerSentence: (text) => events.push(`client ${text}`),
		onCallEnd: () => events.push("end"),
		now: () => T0,
	});
	return { calls, episodes, events };
}

describe("Appel client → épisodes du démon", () => {
	test("le client se lit dans le titre de la réunion", () => {
		expect(customerFromTitle("Appel Jean Dupont")).toBe("Jean Dupont");
		expect(customerFromTitle("Appel Client inconnu")).toBeUndefined();
		expect(customerFromTitle("Essai appel")).toBeUndefined();
		expect(customerFromTitle(null)).toBeUndefined();
	});

	test("début et fin d'appel, une seule fois même si le statut se répète", () => {
		const t = setup();
		t.calls.status(true, 7, "Appel Jean Dupont");
		t.calls.status(true, 7, "Appel Jean Dupont");
		t.calls.status(false, null);
		t.calls.status(false, null);
		expect(t.events).toEqual(["start 7 Jean Dupont", "end"]);
	});

	test("la phrase du client est du contexte ; celle de Léa fait un épisode avec la conversation", () => {
		const t = setup();
		t.calls.status(true, 7, "Appel Jean Dupont");
		t.calls.sentence(say("output", "Votre page de réservation est en panne depuis ce matin, je veux un dédommagement.", 0));
		expect(t.episodes).toEqual([]);
		t.calls.sentence(say("input", "Oui.", 3));
		expect(t.episodes).toEqual([]);
		t.calls.sentence(say("input", "Je ne sais pas ce qu'on peut vous offrir, je vérifie.", 6));
		expect(t.events).toContain("client Votre page de réservation est en panne depuis ce matin, je veux un dédommagement.");
		expect(t.episodes).toHaveLength(1);
		expect(t.episodes[0]).toMatchObject({ app: "Appel", window: "Appel téléphonique" });
		expect(t.episodes[0]!.text).toContain("Client : « Votre page de réservation est en panne");
		expect(t.episodes[0]!.text).toContain("Employé : « Je ne sais pas ce qu'on peut vous offrir, je vérifie. »");
		// Le nom du client n'est pas dans l'épisode : il ne va qu'à HubSpot.
		expect(t.episodes[0]!.text).not.toContain("Jean");
	});

	test("une phrase relue ne refait pas d'épisode ; les phrases anciennes sortent de l'épisode", () => {
		const t = setup();
		t.calls.status(true, 7, "Appel Jean Dupont");
		const old = say("output", "Bonjour, c'est au sujet de ma facture du mois dernier.", 0);
		t.calls.sentence(old);
		const question = say("input", "Je regarde, vous pouvez patienter un instant ?", 120);
		t.calls.sentence(question);
		t.calls.sentence(question);
		expect(t.episodes).toHaveLength(1);
		expect(t.episodes[0]!.text).not.toContain("facture");
	});
});
