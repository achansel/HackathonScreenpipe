import { describe, expect, test } from "bun:test";
import { Scheduler } from "../src/notify/scheduler.ts";
import { Store } from "../src/notify/store.ts";
import type { DeliveryOutcome, EpisodeStatus, NotifyPayload } from "../src/notify/types.ts";
import { episode, pathHelp, ruleHelp, slackHelp } from "./fixtures.ts";

// Midi, heure locale : loin de minuit pour les tests du plafond quotidien.
const NOON = new Date(2026, 9, 17, 12, 0, 0).getTime();

function setup(options: { outcomes?: DeliveryOutcome[]; dailyCap?: number } = {}) {
	let now = NOON;
	const sent: NotifyPayload[] = [];
	const statuses: [string, EpisodeStatus, string | undefined][] = [];
	const outcomes = [...(options.outcomes ?? [])];
	const store = new Store(":memory:");
	const scheduler = new Scheduler({
		store,
		dailyCap: options.dailyCap ?? 8,
		now: () => now,
		slotMs: 60_000,
		pauseBackoffMs: 600_000,
		unreachableBackoffMs: 30_000,
		maxWaitMs: 120_000,
		schedule: () => () => {},
		send: async (payload) => {
			sent.push(payload);
			return outcomes.shift() ?? "shown";
		},
		onStatus: (id, status, detail) => statuses.push([id, status, detail]),
	});
	return {
		store,
		scheduler,
		sent,
		statuses,
		advance: (ms: number) => {
			now += ms;
		},
		final: (id: string) => statuses.filter(([episodeId, status]) => episodeId === id && status !== "queued").at(-1),
	};
}

describe("Scheduler", () => {
	test("cinq épisodes d'un coup : un seul à l'écran, puis un par créneau", async () => {
		const t = setup();
		const episodes = [pathHelp, slackHelp, ruleHelp, pathHelp, slackHelp].map((help) => episode(help));
		for (const ep of episodes) t.scheduler.enqueue(ep);
		await t.scheduler.pump();
		expect(t.sent.map((payload) => payload.id)).toEqual([episodes[0]!.id]);
		expect(t.scheduler.pending).toBe(4);

		t.advance(30_000);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(1);

		t.advance(30_000);
		await t.scheduler.pump();
		expect(t.sent.map((payload) => payload.id)).toEqual([episodes[0]!.id, episodes[1]!.id]);
	});

	test("release libère l'écran tout de suite", async () => {
		const t = setup();
		const [a, b] = [episode(pathHelp), episode(slackHelp)];
		t.scheduler.enqueue(a);
		t.scheduler.enqueue(b);
		await t.scheduler.pump();
		expect(t.scheduler.active).toBe(a.id);
		t.scheduler.release(a.id);
		await t.scheduler.pump();
		expect(t.sent.map((payload) => payload.id)).toEqual([a.id, b.id]);
	});

	test("un épisode n'est servi qu'une fois", async () => {
		const t = setup();
		const ep = episode(ruleHelp);
		expect(t.scheduler.enqueue(ep)).toBe(true);
		expect(t.scheduler.enqueue(ep)).toBe(false);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(1);
	});

	test("un client qui attend passe devant", async () => {
		const t = setup();
		const [first, urgent] = [episode(pathHelp), episode(ruleHelp, { customerWaiting: true })];
		t.scheduler.enqueue(first);
		t.scheduler.enqueue(urgent);
		await t.scheduler.pump();
		expect(t.sent[0]!.id).toBe(urgent.id);
	});

	test("plafond quotidien", async () => {
		const t = setup({ dailyCap: 2 });
		const episodes = [episode(pathHelp), episode(slackHelp), episode(ruleHelp)];
		for (const ep of episodes) {
			t.scheduler.enqueue(ep);
			await t.scheduler.pump();
			t.scheduler.release(ep.id);
			await t.scheduler.pump();
		}
		expect(t.sent).toHaveLength(2);
		expect(t.final(episodes[2]!.id)).toEqual([episodes[2]!.id, "suppressed", "daily_cap"]);
	});

	test("notifications en pause : l'épisode est abandonné, la file attend 10 minutes", async () => {
		const t = setup({ outcomes: ["paused"] });
		const [a, b] = [episode(pathHelp), episode(slackHelp)];
		t.scheduler.enqueue(a);
		t.scheduler.enqueue(b);
		await t.scheduler.pump();
		expect(t.final(a.id)).toEqual([a.id, "suppressed", "paused"]);
		expect(t.sent).toHaveLength(1);

		t.advance(119_000);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(1);

		t.advance(600_000);
		await t.scheduler.pump();
		// b a attendu plus de 2 minutes : la friction est passée.
		expect(t.final(b.id)).toEqual([b.id, "suppressed", "expired"]);
	});

	test("doublon : un seul nouvel essai, avec l'heure en suffixe", async () => {
		const t = setup({ outcomes: ["duplicate", "shown"] });
		const ep = episode(ruleHelp);
		t.scheduler.enqueue(ep);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(2);
		expect(t.sent[1]!.body).toMatch(/ · 12:00:00$/);
		expect(t.sent[1]!.body.split("\n")).toHaveLength(3);
		expect(t.final(ep.id)).toEqual([ep.id, "shown", undefined]);
	});

	test("doublon deux fois : abandonné", async () => {
		const t = setup({ outcomes: ["duplicate", "duplicate"] });
		const ep = episode(ruleHelp);
		t.scheduler.enqueue(ep);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(2);
		expect(t.final(ep.id)).toEqual([ep.id, "suppressed", "duplicate"]);
	});

	test("Screenpipe injoignable : 30 s d'attente", async () => {
		const t = setup({ outcomes: ["unreachable"] });
		const [a, b] = [episode(pathHelp), episode(slackHelp)];
		t.scheduler.enqueue(a);
		t.scheduler.enqueue(b);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(1);
		t.advance(30_000);
		await t.scheduler.pump();
		expect(t.sent.map((payload) => payload.id)).toEqual([a.id, b.id]);
	});

	test("une notification hors contraintes ne part pas", async () => {
		const t = setup();
		const ep = episode({ ...pathHelp, destination: "Une destination beaucoup trop longue pour le panneau" });
		t.scheduler.enqueue(ep);
		await t.scheduler.pump();
		expect(t.sent).toHaveLength(0);
		expect(t.final(ep.id)?.[1]).toBe("rejected");
		expect(t.store.getEpisode(ep.id)?.status).toBe("rejected");
	});

	test("le statut et les événements sont enregistrés", async () => {
		const t = setup();
		const ep = episode(slackHelp);
		t.scheduler.enqueue(ep);
		await t.scheduler.pump();
		expect(t.store.getEpisode(ep.id)?.status).toBe("shown");
		expect(t.store.events(ep.id).map((event) => event.type)).toEqual(["outcome", "shown", "status"]);
	});
});
