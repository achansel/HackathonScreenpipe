import { describe, expect, test } from "bun:test";
import { ageMinutes, conversationText, type FrameElement, inboxRows, openConversation, unreadCount } from "../src/detect/crisp-inbox.ts";
import { type CrispEvent, CrispWatcher } from "../src/detect/crisp-watcher.ts";

// Deux vraies captures de la boîte Crisp (16 octobre), e-mails et nom de l'agent masqués.
const frame1089: FrameElement[] = await Bun.file(new URL("./data/crisp-frame-1089.json", import.meta.url)).json();
const frame1090: FrameElement[] = await Bun.file(new URL("./data/crisp-frame-1090.json", import.meta.url)).json();
// Le premier vrai message de Jean Dupont (17 octobre) : l'OCR a raté l'aperçu de la liste.
const frame8486: FrameElement[] = await Bun.file(new URL("./data/crisp-frame-8486.json", import.meta.url)).json();

describe("Lecture de la boîte Crisp", () => {
	test("la liste des conversations : nom, horodatage, aperçu", () => {
		expect(inboxRows(frame1090)).toEqual([
			{ name: "Camille Martin", ago: "2m", ageMinutes: 2, preview: "Bonjour, je suis Camille Marti…" },
			{ name: "Crisp Team", ago: "27m", ageMinutes: 27, preview: "Enfin, nous avons créé quelques…" },
		]);
	});

	test("les pictogrammes lus par l'OCR après l'aperçu sont retirés", () => {
		expect(inboxRows(frame1089).find((row) => row.name === "Crisp Team")?.preview).toBe("Enfin, nous avons créé quelque…");
	});

	test("aperçu manqué par l'OCR : le texte se lit dans la conversation ouverte", () => {
		expect(inboxRows(frame8486)[0]).toMatchObject({ name: "Jean Dupont", ago: "now", preview: "" });
		expect(conversationText(frame8486)).toBe("Bonjour, ma page de réservation est en panne !! Les clients ne peuvent plus réserver pour ce soir.");
	});

	test("ancienneté", () => {
		expect([ageMinutes("now"), ageMinutes("45s"), ageMinutes("3m"), ageMinutes("2h"), ageMinutes("1d"), ageMinutes("hier")]).toEqual([0, 0, 3, 120, 1440, undefined]);
	});

	test("titre de l'onglet : conversation ouverte et non-lus", () => {
		expect(openConversation("Camille Martin | Crisp - Google Chrome – Agent")).toBe("Camille Martin");
		expect(openConversation("💬1 - Jean Dupont | Crisp")).toBe("Jean Dupont");
		expect(openConversation("💬1 - Inbox | Crisp")).toBeUndefined();
		expect(openConversation("HubSpot")).toBeUndefined();
		expect([unreadCount("💬3 - Inbox | Crisp"), unreadCount("Inbox | Crisp")]).toEqual([3, 0]);
	});
});

/** Une capture renvoyée par le faux Screenpipe. */
interface FakeFrame {
	id: number;
	at: number;
	window: string;
	url?: string;
	text?: string;
	elements?: FrameElement[];
}

/** Une ligne de la liste des conversations, sous forme d'éléments OCR positionnés. */
function row(top: number, name: string, ago: string, preview: string): FrameElement[] {
	const bounds = (left: number, rowTop: number, width: number) => ({ left, top: rowTop, width, height: 0.012 });
	return [
		{ source: "ocr", text: name, bounds: bounds(0.19, top, 0.08) },
		{ source: "ocr", text: ago, bounds: bounds(0.36, top, 0.01) },
		{ source: "ocr", text: preview, bounds: bounds(0.19, top + 0.025, 0.15) },
	];
}

function setup(options: { busy?: (filter: string) => boolean } = {}) {
	let now = Date.parse("2026-10-17T10:00:00Z");
	const frames: FakeFrame[] = [];
	const events: CrispEvent[] = [];
	const fetch = async (input: string | URL | Request) => {
		const url = new URL(String(input));
		const elements = url.pathname.match(/^\/frames\/(\d+)\/elements$/);
		if (elements) return Response.json({ data: frames.find((frame) => frame.id === Number(elements[1]))?.elements ?? [] });
		const since = Date.parse(url.searchParams.get("start_time")!);
		const crisp = url.searchParams.get("browser_url") === "app.crisp.chat";
		if (options.busy?.(crisp ? "crisp" : "chrome")) return Response.json({ error: "search is busy — retry shortly" }, { status: 503 });
		const data = frames
			.filter((frame) => frame.at >= since && (crisp ? frame.url?.includes("app.crisp.chat") : true))
			.map((frame) => ({ content: { frame_id: frame.id, timestamp: new Date(frame.at).toISOString(), window_name: frame.window, browser_url: frame.url ?? null, text: frame.text ?? "" } }));
		return Response.json({ data });
	};
	const watcher = new CrispWatcher({ screenpipeUrl: "http://sp", apiKey: "k", fetch: fetch as typeof globalThis.fetch, now: () => now, onEvent: (event) => events.push(event) });
	let nextId = 1;
	return {
		watcher,
		events,
		capture: (frame: Omit<FakeFrame, "id" | "at">) => {
			now += 1_000;
			frames.push({ ...frame, id: nextId++, at: now });
			now += 500;
		},
	};
}

const INBOX = "https://app.crisp.chat/website/x/inbox/";

describe("Surveillance de Crisp", () => {
	test("ce qui est déjà là au démarrage ne déclenche rien ; un nouveau message, si", async () => {
		const t = setup();
		t.capture({ window: "Inbox | Crisp", url: INBOX, elements: row(0.25, "Camille Martin", "27m", "Bonjour, je suis Camille...") });
		await t.watcher.tick();
		expect(t.events).toEqual([]);

		t.capture({
			window: "💬1 - Inbox | Crisp",
			url: INBOX,
			elements: [...row(0.25, "Jean Dupont", "now", "Ma page de réservation est en p..."), ...row(0.33, "Camille Martin", "28m", "Bonjour, je suis Camille...")],
		});
		await t.watcher.tick();
		expect(t.events.map((event) => event.kind)).toEqual(["unread", "message"]);
		expect(t.events[1]).toMatchObject({ name: "Jean Dupont", preview: "Ma page de réservation est en p…" });
		expect(t.events[1]!.detectedAt - t.events[1]!.frameAt).toBe(500);
	});

	test("la même capture relue, ou le même aperçu tronqué autrement, ne redéclenche pas", async () => {
		const t = setup();
		await t.watcher.tick();
		t.capture({ window: "Inbox | Crisp", url: INBOX, elements: row(0.25, "Jean Dupont", "now", "Ma page de réservation est en p...") });
		await t.watcher.tick();
		await t.watcher.tick();
		t.capture({ window: "Inbox | Crisp", url: INBOX, elements: row(0.25, "Jean Dupont", "1m", "Ma page de réservation est...") });
		await t.watcher.tick();
		expect(t.events.filter((event) => event.kind === "message")).toHaveLength(1);
	});

	test("un vieux message qui remonte dans la liste n'est pas un nouveau message", async () => {
		const t = setup();
		await t.watcher.tick();
		t.capture({ window: "Inbox | Crisp", url: INBOX, elements: row(0.25, "Crisp Team", "3h", "Enfin, nous avons créé...") });
		await t.watcher.tick();
		expect(t.events).toEqual([]);
	});

	test("l'agent est sur HubSpot : le compteur de l'onglet Crisp suffit à signaler le message", async () => {
		const t = setup();
		t.capture({ window: "Contacts | HubSpot", text: "Inbox | Crisp - Memory usage - 192 MB\nContacts | HubSpot" });
		await t.watcher.tick();
		t.capture({ window: "Contacts | HubSpot", text: "💬1 - Inbox | Crisp - Memory usage - 192 MB\nContacts | HubSpot" });
		await t.watcher.tick();
		expect(t.events).toMatchObject([{ kind: "unread", count: 1, where: "other-tab" }]);
	});

	test("la vraie capture de Jean Dupont : message détecté avec son texte, sans aperçu dans la liste", async () => {
		const t = setup();
		await t.watcher.tick();
		t.capture({ window: "Jean Dupont | Crisp", url: `${INBOX}session_1`, elements: frame8486 });
		await t.watcher.tick();
		expect(t.events.find((event) => event.kind === "message")).toMatchObject({
			name: "Jean Dupont",
			preview: "Bonjour, ma page de réservation est en panne !! Les clients ne peuvent plus réserver pour ce soir.",
		});
	});

	test("Screenpipe occupé sur une recherche : l'autre continue, rien n'est perdu", async () => {
		let busy = true;
		const t = setup({ busy: (filter) => busy && filter === "chrome" });
		await t.watcher.tick();
		t.capture({ window: "Inbox | Crisp", url: INBOX, elements: row(0.25, "Jean Dupont", "now", "Ma page de réservation est en p...") });
		await t.watcher.tick();
		expect(t.events.map((event) => event.kind)).toEqual(["message"]);
		busy = false;
		await t.watcher.tick();
		expect(t.events.map((event) => event.kind)).toEqual(["message"]);
	});

	test("l'agent ouvre la conversation", async () => {
		const t = setup();
		await t.watcher.tick();
		t.capture({ window: "Jean Dupont | Crisp", url: `${INBOX}session_1` });
		await t.watcher.tick();
		expect(t.events).toMatchObject([{ kind: "opened", name: "Jean Dupont" }]);
	});
});
