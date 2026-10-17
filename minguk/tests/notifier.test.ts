import { afterEach, describe, expect, test } from "bun:test";
import type { Config } from "../src/config.ts";
import { escalationId } from "../src/notify/escalate.ts";
import { createNotifier, type Notifier } from "../src/notify/index.ts";
import type { EpisodeStatus } from "../src/notify/types.ts";
import { episode, pathHelp, ruleHelp, slackHelp } from "./fixtures.ts";
import { startFakeScreenpipe, type FakeScreenpipe } from "./fake-screenpipe.ts";

let fake: FakeScreenpipe | null = null;
let notifier: Notifier | null = null;
afterEach(() => {
	notifier?.stop();
	fake?.stop();
	notifier = null;
	fake = null;
});

function setup() {
	fake = startFakeScreenpipe();
	const config: Config = {
		screenpipeUrl: fake.url,
		notifyUrl: fake.url,
		apiKey: "jeton-de-test",
		port: 0,
		dbPath: ":memory:",
		dailyCap: 8,
	};
	notifier = createNotifier(config, { trackIntervalMs: 60_000, slotMs: 60_000 });
	const heard: [string, EpisodeStatus][] = [];
	notifier.onOutcome((id, status) => heard.push([id, status]));
	return { fake, notifier, heard };
}

const fallback = { ...slackHelp, reason: "Demander à l'équipe", channel: "#support" };

describe("Notifier (étapes 3 à 5 ensemble)", () => {
	test("[Y aller] passe par notre redirection, et le clic libère l'écran", async () => {
		const t = setup();
		const [first, second] = [episode(ruleHelp), episode(pathHelp)];
		await t.notifier.requestHelp(first);
		await t.notifier.requestHelp(second);
		expect(t.fake.notified.map((n) => n.id)).toEqual([first.id]);

		const response = await fetch(`http://127.0.0.1:${t.notifier.port}/go/${first.id}`, { redirect: "manual" });
		expect(response.headers.get("Location")).toBe(ruleHelp.recordUrl);
		await Bun.sleep(10);
		expect(t.fake.notified.map((n) => n.id)).toEqual([first.id, second.id]);
	});

	test("👎 sur la 📘 : la 💬 de repli apparaît, une seule fois", async () => {
		const t = setup();
		const ep = episode(ruleHelp, { escalation: fallback });
		await t.notifier.requestHelp(ep);
		t.fake.feedback.push({ target: { kind: "notification", id: ep.id }, rating: "down", updated_at: "1" });
		await t.notifier.trackNow();
		await Bun.sleep(10);
		expect(t.fake.notified.map((n) => n.id)).toEqual([ep.id, escalationId(ep.id)]);
		expect(t.fake.notified[1]!.title).toBe("Demander à l'équipe → #support");

		// Changer d'avis puis revenir au 👎 ne relance pas une 2e escalade.
		t.fake.feedback.push({ target: { kind: "notification", id: ep.id }, rating: "up", updated_at: "2" });
		await t.notifier.trackNow();
		t.fake.feedback.push({ target: { kind: "notification", id: ep.id }, rating: "down", updated_at: "3" });
		await t.notifier.trackNow();
		await Bun.sleep(10);
		expect(t.fake.notified.filter((n) => n.id === escalationId(ep.id))).toHaveLength(1);
	});

	test("👎 sans repli prévu, ou sur une 💬 : pas d'escalade", async () => {
		const t = setup();
		const [noFallback, slack] = [episode(ruleHelp), episode(slackHelp, { escalation: fallback })];
		await t.notifier.requestHelp(noFallback);
		t.fake.feedback.push({ target: { kind: "notification", id: noFallback.id }, rating: "down", updated_at: "1" });
		await t.notifier.trackNow();
		await t.notifier.requestHelp(slack);
		t.fake.feedback.push({ target: { kind: "notification", id: slack.id }, rating: "down", updated_at: "1" });
		await t.notifier.trackNow();
		await Bun.sleep(10);
		expect(t.fake.notified.map((n) => n.id)).toEqual([noFallback.id, slack.id]);
	});

	test("les écouteurs suivent tout le parcours", async () => {
		const t = setup();
		const ep = episode(slackHelp);
		await t.notifier.requestHelp(ep);
		t.fake.bell.find((entry) => entry.id === ep.id)!.read = true;
		await t.notifier.trackNow();
		t.fake.feedback.push({ target: { kind: "notification", id: ep.id }, rating: "up", updated_at: "1" });
		await t.notifier.trackNow();
		expect(t.heard.filter(([id]) => id === ep.id).map(([, status]) => status)).toEqual([
			"queued",
			"shown",
			"seen",
			"helpful",
		]);
	});
});
