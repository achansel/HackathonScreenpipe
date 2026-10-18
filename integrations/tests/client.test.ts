import { afterAll, describe, expect, test } from "bun:test";
import { OUTCOME_BY_MESSAGE, parseNotifyResponse, sendNotification } from "../src/notify/client.ts";
import { buildPayload } from "../src/notify/templates.ts";
import { episode, ruleHelp } from "./fixtures.ts";

let reply: { status: number; body: string } = { status: 200, body: "{}" };
let received: unknown = null;

const fake = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		received = await request.json();
		return new Response(reply.body, { status: reply.status, headers: { "Content-Type": "application/json" } });
	},
});
const notifyUrl = `http://127.0.0.1:${fake.port}`;

afterAll(() => fake.stop(true));

describe("parseNotifyResponse", () => {
	test("les 6 messages de Screenpipe", () => {
		expect(Object.keys(OUTCOME_BY_MESSAGE)).toHaveLength(6);
		for (const [message, outcome] of Object.entries(OUTCOME_BY_MESSAGE)) {
			expect(parseNotifyResponse(200, { success: true, message })).toBe(outcome);
		}
	});

	test("message inconnu, corps invalide, erreur HTTP", () => {
		expect(parseNotifyResponse(200, { success: true, message: "announcement sent" })).toBe("unknown");
		expect(parseNotifyResponse(200, null)).toBe("unknown");
		expect(parseNotifyResponse(500, { message: "Notification sent successfully" })).toBe("unknown");
	});
});

describe("sendNotification", () => {
	const payload = buildPayload(episode(ruleHelp));

	test("envoie le JSON et lit le message", async () => {
		reply = { status: 200, body: JSON.stringify({ success: true, message: "notifications paused" }) };
		expect(await sendNotification(payload, { notifyUrl })).toBe("paused");
		expect(received).toEqual(JSON.parse(JSON.stringify(payload)));
	});

	test("affichée", async () => {
		reply = { status: 200, body: JSON.stringify({ success: true, message: "Notification sent successfully" }) };
		expect(await sendNotification(payload, { notifyUrl })).toBe("shown");
	});

	test("corps illisible → unknown", async () => {
		reply = { status: 200, body: "pas du json" };
		expect(await sendNotification(payload, { notifyUrl })).toBe("unknown");
	});

	test("serveur absent → unreachable, sans exception", async () => {
		const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
		const url = `http://127.0.0.1:${closed.port}`;
		closed.stop(true);
		expect(await sendNotification(payload, { notifyUrl: url, timeoutMs: 1_000 })).toBe("unreachable");
	});
});
