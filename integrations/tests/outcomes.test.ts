import { describe, expect, test } from "bun:test";
import { StatusBook } from "../src/notify/outcomes.ts";
import { Store } from "../src/notify/store.ts";
import type { EpisodeStatus } from "../src/notify/types.ts";
import { episode, ruleHelp } from "./fixtures.ts";

function setup(initial: EpisodeStatus = "shown") {
	const store = new Store(":memory:");
	const book = new StatusBook(store, () => 1_000);
	const ep = episode(ruleHelp);
	store.insertEpisode(ep, initial, 0);
	const heard: [string, EpisodeStatus, string | undefined][] = [];
	book.onChange((id, status, detail) => heard.push([id, status, detail]));
	return { store, book, id: ep.id, heard, status: () => store.getEpisode(ep.id)?.status };
}

describe("StatusBook", () => {
	test("avance : affichée → vue → fermée", () => {
		const t = setup();
		expect(t.book.advance(t.id, "seen")).toBe(true);
		expect(t.book.advance(t.id, "dismissed")).toBe(true);
		expect(t.status()).toBe("dismissed");
	});

	test("ne recule jamais : un clic n'est pas effacé par une fermeture", () => {
		const t = setup();
		t.book.advance(t.id, "clicked");
		expect(t.book.advance(t.id, "dismissed")).toBe(false);
		expect(t.book.advance(t.id, "seen")).toBe(false);
		expect(t.status()).toBe("clicked");
	});

	test("un 👍 peut devenir 👎, et inversement", () => {
		const t = setup();
		t.book.advance(t.id, "helpful");
		expect(t.book.advance(t.id, "unhelpful")).toBe(true);
		expect(t.book.advance(t.id, "helpful")).toBe(true);
		expect(t.book.advance(t.id, "helpful")).toBe(false);
	});

	test("« non confirmée » seulement depuis « affichée »", () => {
		const t = setup();
		t.book.advance(t.id, "seen");
		expect(t.book.advance(t.id, "unconfirmed")).toBe(false);
		const u = setup();
		expect(u.book.advance(u.id, "unconfirmed")).toBe(true);
	});

	test("un épisode masqué ou rejeté ne bouge plus", () => {
		for (const initial of ["suppressed", "rejected"] as const) {
			const t = setup(initial);
			expect(t.book.advance(t.id, "clicked")).toBe(false);
		}
	});

	test("le commentaire de 👎 reste local, les écouteurs ne le reçoivent pas", () => {
		const t = setup();
		t.book.advance(t.id, "unhelpful", "La règle a changé en septembre");
		expect(t.heard).toEqual([[t.id, "unhelpful", undefined]]);
		expect(t.store.events(t.id).find((event) => event.type === "comment")?.detail).toBe("La règle a changé en septembre");
	});

	test("épisode inconnu : rien", () => {
		const t = setup();
		expect(t.book.advance("inconnu", "clicked")).toBe(false);
		expect(t.heard).toEqual([]);
	});
});
