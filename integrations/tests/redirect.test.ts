import { afterEach, describe, expect, test } from "bun:test";
import { StatusBook } from "../src/notify/outcomes.ts";
import { isAllowedTarget, startRedirectServer, type RedirectServer } from "../src/notify/redirect.ts";
import { Store } from "../src/notify/store.ts";
import { episode, pathHelp, ruleHelp, slackHelp } from "./fixtures.ts";

let server: RedirectServer | null = null;

afterEach(() => {
	server?.stop();
	server = null;
});

function setup() {
	const store = new Store(":memory:");
	const book = new StatusBook(store);
	server = startRedirectServer({ port: 0, store, book });
	return { store, book, server };
}

const go = (url: string) => fetch(url, { redirect: "manual" });

describe("serveur de redirection", () => {
	test("note le clic et renvoie vers la cible enregistrée", async () => {
		const t = setup();
		const ep = episode(pathHelp);
		t.store.insertEpisode(ep, "shown", 0);
		const response = await go(t.server.link(ep.id));
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(pathHelp.url!);
		expect(t.store.getEpisode(ep.id)?.status).toBe("clicked");
	});

	test("cibles : 🧭 sans URL → la fiche ; 💬 → le canal ; 📘 → la fiche", async () => {
		const t = setup();
		const cases = [
			[episode({ ...pathHelp, url: null }), pathHelp.fallbackUrl],
			[episode(slackHelp), slackHelp.channelUrl],
			[episode(ruleHelp), ruleHelp.recordUrl],
		] as const;
		for (const [ep, expected] of cases) {
			t.store.insertEpisode(ep, "shown", 0);
			expect((await go(t.server.link(ep.id))).headers.get("Location")).toBe(expected);
		}
	});

	test("épisode inconnu : page « aide expirée », pas de redirection", async () => {
		const t = setup();
		const response = await go(t.server.link("inconnu"));
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("Cette aide a expiré");
	});

	test("pas de redirection ouverte : un paramètre d'adresse est ignoré", async () => {
		const t = setup();
		const ep = episode(ruleHelp);
		t.store.insertEpisode(ep, "shown", 0);
		const response = await go(`${t.server.link(ep.id)}?to=https://evil.example`);
		expect(response.headers.get("Location")).toBe(ruleHelp.recordUrl);
	});

	test("une cible dangereuse est refusée", async () => {
		const t = setup();
		const ep = episode({ ...ruleHelp, recordUrl: "javascript:alert(1)" });
		t.store.insertEpisode(ep, "shown", 0);
		expect((await go(t.server.link(ep.id))).status).toBe(400);
		expect(t.store.getEpisode(ep.id)?.status).toBe("shown");
	});

	test("/health", async () => {
		const t = setup();
		expect(await (await fetch(`http://127.0.0.1:${t.server.port}/health`)).text()).toBe("ok");
	});

	test("schémas acceptés", () => {
		expect(isAllowedTarget("https://app.hubspot.com/x")).toBe(true);
		expect(isAllowedTarget("slack://channel?team=T1&id=C1")).toBe(true);
		expect(isAllowedTarget("file:///etc/passwd")).toBe(false);
		expect(isAllowedTarget("pas une url")).toBe(false);
	});

	test("port déjà pris : erreur claire", () => {
		const t = setup();
		expect(() => startRedirectServer({ port: t.server.port, store: t.store, book: t.book })).toThrow(/FRICTION_REDIRECT_PORT/);
	});
});
