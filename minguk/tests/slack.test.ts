import { describe, expect, test } from "bun:test";
import { Slack, type SlackManifest, seedSlack, wipeSlack } from "../src/seed/slack.ts";
import type { StoryChannel } from "../src/seed/slack-story.ts";

const STORY: StoryChannel[] = [
	{
		name: "bugs",
		purpose: "Signaler un bug",
		messages: [
			{ from: "claire", text: "Modèle", pin: true },
			{ from: "yasmine", text: "[Bug] …", replies: [{ from: "max", text: "Corrigé" }] },
		],
	},
	{ name: "support", purpose: "Entraide", messages: [{ from: "karim", text: "Rappel" }] },
];

/** Un faux Slack : #support existe déjà (canal de l'équipe), et une méthode peut échouer une fois. */
function fakeSlack(options: { failOnce?: string } = {}) {
	const calls: { method: string; body: Record<string, unknown> }[] = [];
	let ts = 1;
	let failed = false;
	const fetch = async (input: string | URL | Request, init?: RequestInit) => {
		const method = String(input).split("/api/")[1]!;
		const body = JSON.parse(String(init?.body ?? "{}"));
		calls.push({ method, body });
		if (method === options.failOnce && !failed) {
			failed = true;
			return Response.json({ ok: false, error: "fatal_error" });
		}
		if (method === "conversations.create") {
			return body.name === "support" ? Response.json({ ok: false, error: "name_taken" }) : Response.json({ ok: true, channel: { id: `C-${body.name}` } });
		}
		if (method === "conversations.list") return Response.json({ ok: true, channels: [{ id: "C-equipe", name: "support" }] });
		if (method === "chat.postMessage") return Response.json({ ok: true, ts: `${ts++}.0` });
		return Response.json({ ok: true });
	};
	const slack = new Slack("xoxb-secret", { fetch: fetch as typeof globalThis.fetch, sleep: async () => {}, minGapMs: 0 });
	const manifest: SlackManifest = { teamId: "T1", channels: {} };
	return { slack, calls, manifest, posts: () => calls.filter((call) => call.method === "chat.postMessage") };
}

describe("Historique Slack", () => {
	test("les portraits restent sous la limite de longueur de Slack", async () => {
		const { PERSONAS } = await import("../src/seed/slack-story.ts");
		expect(Object.values(PERSONAS).filter((persona) => persona.avatar.length > 250)).toEqual([]);
	});

	test("canaux, messages sous un nom emprunté, fils et épingle", async () => {
		const t = fakeSlack();
		await seedSlack(t.slack, t.manifest, () => {}, () => {}, STORY);
		expect(t.posts().map((call) => [call.body.channel, call.body.username, call.body.thread_ts ?? null])).toEqual([
			["C-bugs", "Claire Morin (resp. support)", null],
			["C-bugs", "Yasmine Roche (support)", null],
			["C-bugs", "Max Durand (tech)", "2.0"],
			["C-equipe", "Karim Bensaïd (support)", null],
		]);
		expect(t.calls.find((call) => call.method === "pins.add")?.body).toEqual({ channel: "C-bugs", timestamp: "1.0" });
		expect(t.manifest.channels.support).toMatchObject({ id: "C-equipe", created: false, complete: true });
	});

	test("une erreur en route : le nouvel essai reprend sans reposter", async () => {
		const t = fakeSlack({ failOnce: "chat.postMessage" });
		await expect(seedSlack(t.slack, t.manifest, () => {}, () => {}, STORY)).rejects.toThrow("fatal_error");
		await seedSlack(t.slack, t.manifest, () => {}, () => {}, STORY);
		const posted = t.posts().filter((call) => call.method === "chat.postMessage");
		// 1 échec + 4 messages, chacun une seule fois.
		expect(posted.map((call) => call.body.text)).toEqual(["Modèle", "Modèle", "[Bug] …", "Corrigé", "Rappel"]);
	});

	test("wipe archive les canaux créés, jamais un canal de l'équipe", async () => {
		const t = fakeSlack();
		await seedSlack(t.slack, t.manifest, () => {}, () => {}, STORY);
		await wipeSlack(t.slack, t.manifest, () => {}, () => {});
		expect(t.calls.filter((call) => call.method === "chat.delete")).toHaveLength(4);
		expect(t.calls.filter((call) => call.method === "conversations.archive").map((call) => call.body.channel)).toEqual(["C-bugs"]);
		expect(t.manifest.channels).toEqual({});
	});
});
