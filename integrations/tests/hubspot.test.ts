import { describe, expect, test } from "bun:test";
import type { FrameElement } from "../src/detect/crisp-inbox.ts";
import { type DaemonEpisode, HubSpotDetours, parseHubSpotUrl, resultCount } from "../src/detect/hubspot-detours.ts";

// Deux vraies captures de la recherche dans les contacts HubSpot (17 octobre, nom de l'agent masqué).
const noMatch: FrameElement[] = await Bun.file(new URL("./data/hubspot-frame-11710.json", import.meta.url)).json();
const tenMatches: FrameElement[] = await Bun.file(new URL("./data/hubspot-frame-11712.json", import.meta.url)).json();

const BASE = "https://app-eu1.hubspot.com/contacts/149568075";
const list = (query: string) => `${BASE}/objects/0-1/views/all/list?query=${encodeURIComponent(query)}`;
const record = (type: string, id: string) => `${BASE}/record/${type}/${id}?eschref=x`;

describe("Lecture d'une page HubSpot", () => {
	test("la recherche et la fiche se lisent dans l'URL", () => {
		expect(parseHubSpotUrl(list("jean.d@example.com"))).toEqual({ object: "contact", kind: "liste", query: "jean.d@example.com" });
		expect(parseHubSpotUrl(record("0-3", "52"))).toEqual({ object: "transaction", kind: "fiche", recordId: "52" });
		expect(parseHubSpotUrl("https://app.crisp.chat/website/x")).toBeUndefined();
	});

	test("le nombre de résultats, pour l'objet de la page seulement", () => {
		expect(resultCount(noMatch, "contact")).toBe(0);
		expect(resultCount(tenMatches, "contact")).toBe(10);
		// « 51 Deals » apparaît dans un menu de la page des contacts : ce n'est pas le résultat.
		expect(resultCount(noMatch, "contact")).not.toBe(51);
	});
});

interface FakeFrame {
	id: number;
	at: number;
	window: string;
	url?: string;
	type: "accessibility" | "ocr";
	app?: string;
	elements?: FrameElement[];
}

function setup() {
	let now = Date.parse("2026-10-17T18:00:00Z");
	const frames: FakeFrame[] = [];
	const episodes: DaemonEpisode[] = [];
	const fetch = async (input: string | URL | Request) => {
		const url = new URL(String(input));
		const elements = url.pathname.match(/^\/frames\/(\d+)\/elements$/);
		if (elements) return Response.json({ data: frames.find((frame) => frame.id === Number(elements[1]))?.elements ?? [] });
		const since = Date.parse(url.searchParams.get("start_time")!);
		const type = url.searchParams.get("content_type");
		const app = url.searchParams.get("app_name");
		const data = frames
			.filter((frame) => frame.at >= since && frame.type === type && (!app || frame.app === app) && (type !== "accessibility" || frame.url?.includes("hubspot.com")))
			.map((frame) => ({ content: { frame_id: frame.id, timestamp: new Date(frame.at).toISOString(), app_name: frame.app ?? "Google Chrome", window_name: frame.window, browser_url: frame.url ?? null } }));
		return Response.json({ data });
	};
	const detours = new HubSpotDetours({ screenpipeUrl: "http://sp", apiKey: "k", fetch: fetch as typeof globalThis.fetch, now: () => now, onEpisode: (episode) => episodes.push(episode) });
	let nextId = 1;
	return {
		detours,
		episodes,
		capture: (frame: Omit<FakeFrame, "id" | "at" | "type"> & { type?: FakeFrame["type"] }) => {
			now += 3_000;
			frames.push({ type: "accessibility", ...frame, id: nextId++, at: now });
		},
	};
}

describe("Détours dans HubSpot", () => {
	test("Léa cherche l'adresse de Jean : aucun résultat, puis « Jean » : 10 résultats", async () => {
		const t = setup();
		await t.detours.tick();
		t.capture({ window: "Contacts | All contacts", url: list("jean.d@example.com"), elements: noMatch });
		await t.detours.tick();
		t.capture({ window: "Contacts | All contacts", url: list("jean"), elements: tenMatches });
		await t.detours.tick();
		expect(t.episodes.map((episode) => episode.text)).toEqual([
			"Recherche HubSpot dans les contacts : « jean.d@example.com » (aucun résultat). La recherche ne trouve rien.",
			"Recherches HubSpot successives dans les contacts : « jean.d@example.com » (aucun résultat), puis « jean » (10 résultats). Aucune ne désigne un seul résultat.",
		]);
		expect(t.episodes[0]).toMatchObject({ app: "Google Chrome", window: "Contacts | All contacts" });
	});

	test("la même capture relue ne refait pas d'épisode ; une recherche qui trouve tout de suite, rien", async () => {
		const t = setup();
		await t.detours.tick();
		t.capture({ window: "Contacts | All contacts", url: list("jean"), elements: tenMatches });
		await t.detours.tick();
		await t.detours.tick();
		expect(t.episodes).toEqual([]);
	});

	test("ce qui est déjà à l'écran au démarrage ne fait pas d'épisode", async () => {
		const t = setup();
		t.capture({ window: "Contacts | All contacts", url: list("jean.d@example.com"), elements: noMatch });
		await t.detours.tick();
		expect(t.episodes).toEqual([]);
	});

	test("allers-retours : contact → entreprise → transaction → contact en moins d'une minute", async () => {
		const t = setup();
		await t.detours.tick();
		for (const [type, id] of [["0-1", "1"], ["0-2", "2"], ["0-3", "3"], ["0-1", "1"]] as const) {
			t.capture({ window: "Jean Dupont", url: record(type, id) });
			await t.detours.tick();
		}
		expect(t.episodes.map((episode) => episode.text)).toEqual([
			"Allers-retours dans HubSpot en 9 s : contact → entreprise → transaction → contact. La même fiche est ouverte plusieurs fois.",
		]);
	});

	test("Windows : la capture OCR sans URL est rattachée par le titre de la fenêtre", async () => {
		const t = setup();
		await t.detours.tick();
		// La capture par accessibilité porte l'URL, sans le texte de la liste.
		t.capture({ window: "Contacts | All contacts - Google Chrome", url: list("jean.d@example.com"), app: "chrome.exe" });
		// La capture OCR, juste après : pas d'URL, mais le résultat est à l'écran.
		t.capture({ window: "Contacts | All contacts - Google Chrome", type: "ocr", app: "chrome.exe", elements: noMatch });
		await t.detours.tick();
		expect(t.episodes.map((episode) => episode.text)).toEqual([
			"Recherche HubSpot dans les contacts : « jean.d@example.com » (aucun résultat). La recherche ne trouve rien.",
		]);
	});
});
