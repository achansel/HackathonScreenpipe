import { afterEach, describe, expect, test } from "bun:test";
import { StatusBook } from "../src/notify/outcomes.ts";
import { Store } from "../src/notify/store.ts";
import { Tracker } from "../src/notify/tracker.ts";
import type { Help } from "../src/notify/types.ts";
import { episode, pathHelp, ruleHelp } from "./fixtures.ts";
import { startFakeScreenpipe, type FakeScreenpipe } from "./fake-screenpipe.ts";

let fake: FakeScreenpipe | null = null;
afterEach(() => {
	fake?.stop();
	fake = null;
});

function setup(apiKey: string | null = "jeton-de-test") {
	fake = startFakeScreenpipe();
	let now = 1_000_000;
	const store = new Store(":memory:");
	const book = new StatusBook(store, () => now);
	const tracker = new Tracker({
		store,
		book,
		notifyUrl: fake.url,
		screenpipeUrl: fake.url,
		apiKey: apiKey ?? undefined,
		now: () => now,
		quietAfterMs: 60_000,
	});
	const show = (help: Help = ruleHelp) => {
		const ep = episode(help);
		store.insertEpisode(ep, "shown", now);
		store.addEvent(ep.id, "shown", now);
		return ep.id;
	};
	return {
		fake,
		store,
		tracker,
		show,
		status: (id: string) => store.getEpisode(id)?.status,
		advance: (ms: number) => {
			now += ms;
		},
	};
}

describe("Tracker", () => {
	test("dans la cloche, puis dépliée → vue, puis retirée → fermée", async () => {
		const t = setup();
		const id = t.show();
		t.fake.bell.push({ id, read: false });
		await t.tracker.tick();
		expect(t.status(id)).toBe("shown");

		t.fake.bell[0]!.read = true;
		await t.tracker.tick();
		expect(t.status(id)).toBe("seen");

		t.fake.bell.length = 0;
		await t.tracker.tick();
		expect(t.status(id)).toBe("dismissed");
	});

	test("jamais vue dans la cloche (🧭, toast seul) : son absence ne veut pas dire fermée", async () => {
		const t = setup();
		const id = t.show(pathHelp);
		await t.tracker.tick();
		expect(t.status(id)).toBe("shown");
	});

	test("👍 → utile ; puis 👎 avec commentaire → pas utile, commentaire gardé en local", async () => {
		const t = setup();
		const id = t.show();
		t.fake.feedback.push({ target: { kind: "notification", id }, rating: "up", updated_at: "2026-10-17T10:00:00Z" });
		await t.tracker.tick();
		expect(t.status(id)).toBe("helpful");
		expect(t.fake.lastAuth).toBe("Bearer jeton-de-test");

		t.fake.feedback.push({
			target: { kind: "notification", id },
			rating: "down",
			comment: "Plus valable",
			updated_at: "2026-10-17T10:05:00Z",
		});
		// Le suivi s'arrête une fois l'aide jugée : on relit cet épisode en le rouvrant.
		t.store.setStatus(id, "shown", 0);
		await t.tracker.tick();
		expect(t.status(id)).toBe("unhelpful");
		expect(t.store.events(id).find((event) => event.type === "comment")?.detail).toBe("Plus valable");
	});

	test("les retours d'autres notifications sont ignorés", async () => {
		const t = setup();
		const id = t.show();
		t.fake.feedback.push({ target: { kind: "notification", id: "autre" }, rating: "down", updated_at: "x" });
		await t.tracker.tick();
		expect(t.status(id)).toBe("shown");
	});

	test("sans jeton, /feedback n'est pas appelé", async () => {
		const t = setup(null);
		const id = t.show();
		t.fake.feedback.push({ target: { kind: "notification", id }, rating: "up", updated_at: "x" });
		await t.tracker.tick();
		expect(t.fake.lastAuth).toBeNull();
		expect(t.status(id)).toBe("shown");
	});

	test("aucun signal passé le délai → non confirmée", async () => {
		const t = setup();
		const id = t.show();
		t.advance(59_000);
		await t.tracker.tick();
		expect(t.status(id)).toBe("shown");
		t.advance(2_000);
		await t.tracker.tick();
		expect(t.status(id)).toBe("unconfirmed");
	});

	test("Screenpipe injoignable : aucun changement, pas d'exception", async () => {
		const t = setup();
		const id = t.show();
		t.fake.stop();
		await t.tracker.tick();
		expect(t.status(id)).toBe("shown");
	});
});
