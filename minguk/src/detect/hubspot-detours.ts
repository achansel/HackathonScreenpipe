/**
 * Les détours de Léa dans HubSpot, lus dans les captures Screenpipe, rendus comme des épisodes au format
 * du démon d'Andrea (andrea/daemon/episodes.ts). Le démon les qualifie : ce code ne décide pas d'aide.
 *
 * Trois signaux, mesurés le 17/10 sur HubSpot (app-eu1) :
 * - la recherche est dans l'URL : `/objects/0-1/views/all/list?query=jean.d%40example.com` ;
 * - le résultat est à l'écran : « No Contacts match », « 0 contacts » (lu « O contacts »), « 10 contacts » ;
 * - le parcours est dans l'URL : `/record/0-1/<id>` contact, `0-2` entreprise, `0-3` transaction.
 *
 * Windows (mesuré par Andrea) : `browser_url` n'est rempli que sur les captures par accessibilité ; les
 * captures OCR, où se lit le nombre de résultats, sont rattachées à l'URL par le titre de la fenêtre.
 */
import { defined } from "../notify/defined.ts";
import { type FrameElement, lines } from "./crisp-inbox.ts";

/** Le format d'épisode du démon d'Andrea. */
export interface DaemonEpisode {
	id: string;
	app: string;
	window: string;
	titles: string[];
	text: string;
	at: number;
}

export type HubSpotObject = "contact" | "entreprise" | "transaction" | "autre";

export interface HubSpotPage {
	object: HubSpotObject;
	kind: "liste" | "fiche" | "autre";
	query?: string;
	recordId?: string;
}

const OBJECTS: Record<string, HubSpotObject> = { "0-1": "contact", "0-2": "entreprise", "0-3": "transaction" };
const PLURAL: Record<HubSpotObject, string> = { contact: "contacts", entreprise: "entreprises", transaction: "transactions", autre: "fiches" };

export function parseHubSpotUrl(url: string): HubSpotPage | undefined {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return undefined;
	}
	if (!/hubspot\.com$/.test(parsed.hostname)) return undefined;
	const record = parsed.pathname.match(/\/record\/(0-\d+)\/(\d+)/);
	if (record) return { object: OBJECTS[record[1]!] ?? "autre", kind: "fiche", recordId: record[2] };
	const list = parsed.pathname.match(/\/objects\/(0-\d+)/);
	if (list) {
		const query = parsed.searchParams.get("query")?.trim();
		return { object: OBJECTS[list[1]!] ?? "autre", kind: "liste", ...(query && { query }) };
	}
	return { object: "autre", kind: "autre" };
}

const NOUNS: Record<HubSpotObject, string> = { contact: "contacts?", entreprise: "compan(?:y|ies)", transaction: "deals?", autre: "records?" };

/**
 * Le nombre de résultats affiché sous la liste, ou undefined tant que la page charge.
 * Seulement pour l'objet de la page (mesuré : « 51 Deals » s'affiche dans un menu de la page des contacts),
 * et le plus bas à l'écran : le compteur est sous le tableau.
 */
export function resultCount(elements: FrameElement[], object: HubSpotObject): number | undefined {
	const noun = NOUNS[object];
	const none = new RegExp(`\\bNo ${noun}\\b.*\\bmatch`, "i");
	// L'OCR lit parfois « 0 » comme « O ».
	const count = new RegExp(`^([0-9][0-9\\s,.]*|O)\\s+${noun}$`, "i");
	let found: number | undefined;
	for (const line of lines(elements)) {
		if (none.test(line.text)) return 0;
		const match = line.text.trim().match(count);
		if (match) found = match[1] === "O" ? 0 : Number(match[1]!.replace(/[\s,.]/g, ""));
	}
	return found;
}

interface SearchItem {
	content: { frame_id?: number; timestamp: string; app_name?: string | null; window_name?: string | null; browser_url?: string | null };
}

export interface HubSpotDetoursOptions {
	screenpipeUrl: string;
	apiKey: string;
	onEpisode: (episode: DaemonEpisode) => void;
	fetch?: typeof fetch;
	now?: () => number;
	/** Recherches et visites plus anciennes : oubliées. */
	windowMs?: number;
	/** Au démarrage, ce qui est déjà à l'écran sert d'état initial, sans épisode. */
	lookbackMs?: number;
	/** Rejeu de l'historique (depuis `lookbackMs`) : pas d'état initial, chaque détour donne un épisode. */
	replay?: boolean;
}

/** Un titre de fenêtre HubSpot sous Windows, sans URL : « Contacts | All contacts - Google Chrome ». */
const HUBSPOT_WINDOW = /^(Contacts|Companies|Deals|Tickets) \| |\| HubSpot\b/;

export class HubSpotDetours {
	private readonly options: Required<HubSpotDetoursOptions>;
	private cursor: number;
	private windowsCursor: number;
	private baseline: boolean;
	private readonly seenFrames = new Set<number>();
	private readonly urlByWindow = new Map<string, { url: string; at: number }>();
	private searches: { object: HubSpotObject; query: string; count: number; at: number }[] = [];
	private visits: { object: HubSpotObject; id: string; at: number }[] = [];
	private readonly emitted = new Set<string>();
	private ticking: Promise<void> | undefined;

	constructor(options: HubSpotDetoursOptions) {
		this.options = { fetch: globalThis.fetch, now: Date.now, windowMs: 120_000, lookbackMs: 60_000, replay: false, ...defined(options) };
		this.cursor = this.options.now() - this.options.lookbackMs;
		this.baseline = !this.options.replay;
		this.windowsCursor = this.cursor;
	}

	/** Un tour : les recherches Screenpipe partent l'une après l'autre (sinon 503 « search is busy »). */
	tick(): Promise<void> {
		this.ticking ??= this.run().finally(() => {
			this.ticking = undefined;
		});
		return this.ticking;
	}

	private async run(): Promise<void> {
		const frames = await this.search({ content_type: "accessibility", browser_url: "hubspot.com" }, this.cursor);
		for (const item of frames) await this.read(item);
		this.cursor = latest(frames, this.cursor);
		// Windows : les captures OCR de chrome.exe, rattachées par le titre de la fenêtre. Vide sur Mac.
		const windows = await this.search({ content_type: "ocr", app_name: "chrome.exe" }, this.windowsCursor);
		for (const item of windows) if (HUBSPOT_WINDOW.test(item.content.window_name ?? "") || this.urlByWindow.has(item.content.window_name ?? "")) await this.read(item);
		this.windowsCursor = latest(windows, this.windowsCursor);
		this.baseline = false;
	}

	private async search(filter: Record<string, string>, since: number): Promise<SearchItem[]> {
		const query = new URLSearchParams({ order: "ascending", limit: "50", start_time: new Date(since).toISOString(), ...filter });
		const response = await this.options.fetch(`${this.options.screenpipeUrl}/search?${query}`, { headers: this.headers() });
		if (!response.ok) throw new Error(`/search : HTTP ${response.status}`);
		return ((await response.json()) as { data?: SearchItem[] }).data ?? [];
	}

	private headers(): Record<string, string> {
		return { Authorization: `Bearer ${this.options.apiKey}` };
	}

	private async read(item: SearchItem): Promise<void> {
		const { frame_id: frameId, timestamp, window_name: windowName, browser_url: browserUrl, app_name: appName } = item.content;
		if (frameId === undefined || this.seenFrames.has(frameId)) return;
		this.seenFrames.add(frameId);
		const at = Date.parse(timestamp);
		const window = windowName ?? "";
		let url = browserUrl && /hubspot\.com/.test(browserUrl) ? browserUrl : undefined;
		if (url) this.urlByWindow.set(window, { url, at });
		else {
			const known = this.urlByWindow.get(window);
			if (known && at - known.at < 10_000) url = known.url;
		}
		const page = url ? parseHubSpotUrl(url) : undefined;
		if (!page) return;
		this.forget(at);
		const frame = { app: appName ?? "Google Chrome", window, at };

		if (page.kind === "liste" && page.query) {
			const response = await this.options.fetch(`${this.options.screenpipeUrl}/frames/${frameId}/elements`, { headers: this.headers() });
			if (!response.ok) return;
			const count = resultCount(((await response.json()) as { data?: FrameElement[] }).data ?? [], page.object);
			if (count === undefined) return;
			this.noteSearch(page.object, page.query, count, frame);
		}
		if (page.kind === "fiche" && page.recordId) this.noteVisit(page.object, page.recordId, frame);
	}

	private forget(now: number): void {
		this.searches = this.searches.filter((search) => now - search.at < this.options.windowMs);
		this.visits = this.visits.filter((visit) => now - visit.at < this.options.windowMs);
	}

	private noteSearch(object: HubSpotObject, query: string, count: number, frame: { app: string; window: string; at: number }): void {
		const last = this.searches.at(-1);
		if (last?.object === object && last.query === query && last.count === count) return;
		this.searches.push({ object, query, count, at: frame.at });
		const same = this.searches.filter((search) => search.object === object);
		const history = same.map((search) => `« ${search.query} » (${search.count === 0 ? "aucun résultat" : `${search.count} résultat${search.count > 1 ? "s" : ""}`})`).join(", puis ");
		if (count === 0) {
			this.emit(`zero:${object}:${query}`, frame, `Recherche HubSpot dans les ${PLURAL[object]} : ${history}. La recherche ne trouve rien.`);
		} else if (same.length >= 2 && same.some((search) => search.count === 0) && count > 1) {
			// Après un échec, une recherche plus large qui donne plusieurs résultats : Léa tâtonne.
			this.emit(`retry:${object}:${same[0]!.query}:${same.length}`, frame, `Recherches HubSpot successives dans les ${PLURAL[object]} : ${history}. Aucune ne désigne un seul résultat.`);
		}
	}

	private noteVisit(object: HubSpotObject, id: string, frame: { app: string; window: string; at: number }): void {
		const last = this.visits.at(-1);
		if (last?.object === object && last.id === id) return;
		this.visits.push({ object, id, at: frame.at });
		// Allers-retours : au moins 4 fiches en moins d'une minute, dont une revisitée.
		const recent = this.visits.filter((visit) => frame.at - visit.at < 60_000);
		const keys = recent.map((visit) => `${visit.object}:${visit.id}`);
		if (recent.length >= 4 && new Set(keys).size < keys.length) {
			const path = recent.map((visit) => visit.object).join(" → ");
			const seconds = Math.max(1, Math.round((frame.at - recent[0]!.at) / 1000));
			this.emit(`path:${recent[0]!.at}`, frame, `Allers-retours dans HubSpot en ${seconds} s : ${path}. La même fiche est ouverte plusieurs fois.`);
		}
	}

	private emit(key: string, frame: { app: string; window: string; at: number }, text: string): void {
		if (this.baseline || this.emitted.has(key)) return;
		this.emitted.add(key);
		const titles = [...new Set([...this.urlByWindow.keys()].slice(-4))].map((title) => `${frame.app} | ${title}`);
		this.options.onEpisode({ id: `hs${hash(key)}`, app: frame.app, window: frame.window, titles, text, at: frame.at });
	}
}

function latest(items: SearchItem[], cursor: number): number {
	return Math.max(cursor, ...items.map((item) => Date.parse(item.content.timestamp)));
}

function hash(text: string): string {
	let value = 2166136261;
	for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
	return (value >>> 0).toString(36);
}
