/**
 * Surveille Crisp à travers Screenpipe et signale l'arrivée d'un message client.
 *
 * Deux sources, interrogées à chaque tour :
 * - les captures de l'onglet Crisp (`browser_url` app.crisp.chat) : la liste des conversations
 *   donne le nom du client et l'aperçu de son message ; le titre donne la conversation ouverte ;
 * - toutes les captures de Chrome : la barre d'onglets contient le titre de l'onglet Crisp,
 *   avec son compteur « 💬N ». C'est ce qui révèle un message quand l'agent est sur HubSpot.
 */
import { defined } from "../notify/defined.ts";
import { type FrameElement, inboxRows, openConversation, unreadCount } from "./crisp-inbox.ts";

export type CrispEvent =
	| { kind: "message"; name: string; preview: string; frameAt: number; detectedAt: number }
	| { kind: "unread"; count: number; where: "crisp" | "other-tab"; frameAt: number; detectedAt: number }
	| { kind: "opened"; name: string; frameAt: number; detectedAt: number };

/** Un événement avant horodatage de sa détection. */
type Detected = CrispEvent extends infer E ? (E extends CrispEvent ? Omit<E, "detectedAt"> : never) : never;

export interface CrispWatcherOptions {
	screenpipeUrl: string;
	apiKey: string;
	onEvent: (event: CrispEvent) => void;
	fetch?: typeof fetch;
	now?: () => number;
	/** Un aperçu n'est un nouveau message que s'il est récent (« now », « 1m », « 2m »). */
	freshMinutes?: number;
	/** Au démarrage, ce qui est déjà à l'écran depuis ce délai sert d'état initial, sans signal. */
	lookbackMs?: number;
}

interface SearchItem {
	content: { frame_id?: number; timestamp: string; window_name?: string | null; browser_url?: string | null; text?: string | null };
}

/** Une ligne de la barre d'onglets pour l'appli Crisp : « 💬1 - Inbox | Crisp - Memory usage - 192 MB ». */
const TAB_TITLE = /^(?:💬\s*(\d+)\s*-\s*)?.+\|\s*Crisp(?:\s+-\s+Memory usage.*)?$/mu;

export class CrispWatcher {
	private readonly options: Required<CrispWatcherOptions>;
	private cursor: number;
	private baseline = true;
	private readonly seenFrames = new Set<number>();
	private readonly previews = new Map<string, string>();
	private unread = 0;
	private opened: string | undefined;
	private ticking: Promise<void> | undefined;

	constructor(options: CrispWatcherOptions) {
		this.options = { fetch: globalThis.fetch, now: Date.now, freshMinutes: 2, lookbackMs: 60_000, ...defined(options) };
		this.cursor = this.options.now() - this.options.lookbackMs;
	}

	/** Un tour de surveillance ; deux appels simultanés partagent le même tour. */
	tick(): Promise<void> {
		this.ticking ??= this.run().finally(() => {
			this.ticking = undefined;
		});
		return this.ticking;
	}

	private async run(): Promise<void> {
		const since = this.cursor;
		const [crispFrames, chromeFrames] = await Promise.all([
			this.search({ browser_url: "app.crisp.chat" }, since),
			this.search({ app_name: "Google Chrome" }, since),
		]);
		for (const item of crispFrames) await this.readCrispFrame(item);
		for (const item of chromeFrames) this.readTabStrip(item);
		const latest = [...crispFrames, ...chromeFrames].map((item) => Date.parse(item.content.timestamp));
		if (latest.length > 0) this.cursor = Math.max(this.cursor, ...latest);
		this.baseline = false;
	}

	private async search(filter: Record<string, string>, since: number): Promise<SearchItem[]> {
		const query = new URLSearchParams({
			content_type: "accessibility",
			order: "ascending",
			limit: "50",
			start_time: new Date(since).toISOString(),
			...filter,
		});
		const response = await this.options.fetch(`${this.options.screenpipeUrl}/search?${query}`, { headers: this.headers() });
		if (!response.ok) throw new Error(`/search : HTTP ${response.status}`);
		return ((await response.json()) as { data?: SearchItem[] }).data ?? [];
	}

	private headers(): Record<string, string> {
		return { Authorization: `Bearer ${this.options.apiKey}` };
	}

	private async readCrispFrame(item: SearchItem): Promise<void> {
		const { frame_id: frameId, timestamp, window_name: windowName } = item.content;
		if (frameId === undefined || this.seenFrames.has(frameId)) return;
		this.seenFrames.add(frameId);
		const frameAt = Date.parse(timestamp);

		this.noteUnread(unreadCount(windowName), "crisp", frameAt);
		const opened = openConversation(windowName);
		if (opened && opened !== this.opened) {
			this.opened = opened;
			if (!this.baseline) this.emit({ kind: "opened", name: opened, frameAt });
		}

		const response = await this.options.fetch(`${this.options.screenpipeUrl}/frames/${frameId}/elements`, { headers: this.headers() });
		if (!response.ok) return;
		const elements = ((await response.json()) as { data?: FrameElement[] }).data ?? [];
		for (const row of inboxRows(elements)) {
			if (!row.preview) continue;
			const known = this.previews.get(row.name);
			this.previews.set(row.name, row.preview);
			if (known === row.preview || this.baseline) continue;
			// Même message, aperçu tronqué différemment par l'OCR : pas un nouveau message.
			if (known && (known.startsWith(row.preview.replace(/…$/, "")) || row.preview.startsWith(known.replace(/…$/, "")))) continue;
			if (row.ageMinutes === undefined || row.ageMinutes > this.options.freshMinutes) continue;
			this.emit({ kind: "message", name: row.name, preview: row.preview, frameAt });
		}
	}

	private readTabStrip(item: SearchItem): void {
		if (item.content.browser_url?.includes("app.crisp.chat")) return;
		const match = (item.content.text ?? "").match(TAB_TITLE);
		// Pas d'onglet Crisp dans cette capture : on ne sait rien du compteur.
		if (match) this.noteUnread(Number(match[1] ?? 0), "other-tab", Date.parse(item.content.timestamp));
	}

	/** Le compteur ne signale que sa hausse ; il redescend quand l'agent lit. */
	private noteUnread(count: number, where: "crisp" | "other-tab", frameAt: number): void {
		if (count > this.unread && !this.baseline) this.emit({ kind: "unread", count, where, frameAt });
		this.unread = count;
	}

	private emit(event: Detected): void {
		this.options.onEvent({ ...event, detectedAt: this.options.now() } as CrispEvent);
	}
}
