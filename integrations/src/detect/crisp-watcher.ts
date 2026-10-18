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
import { accessibilityRows, conversationText, customerName, type FrameElement, fullMessage, inboxRows, openConversation, unreadCount } from "./crisp-inbox.ts";

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
/** Un titre de fenêtre Chrome sur l'onglet Crisp : « 💬1 - Jean Dupont | Crisp - Google Chrome ». */
const CRISP_WINDOW = /\|\s*Crisp\b/u;

export class CrispWatcher {
	private readonly options: Required<CrispWatcherOptions>;
	/** Un curseur par source : si l'une échoue (Screenpipe occupé), l'autre avance quand même. */
	private crispCursor: number;
	private chromeCursor: number;
	private windowsCursor: number;
	private baseline = true;
	private readonly seenFrames = new Set<number>();
	/** Les captures dont la barre d'onglets est déjà lue : deux recherches peuvent rendre la même. */
	private readonly seenTabStrips = new Set<number>();
	/** Par client : le dernier texte connu, et si sa ligne était récente (« now », « 1m »). */
	private readonly rows = new Map<string, { text: string; fresh: boolean }>();
	/** Messages déjà signalés (client + texte), pour ne pas les redonner quand une autre lecture les retrouve. */
	private readonly emitted = new Map<string, number>();
	private unread = 0;
	private opened: string | undefined;
	private ticking: Promise<void> | undefined;

	constructor(options: CrispWatcherOptions) {
		this.options = { fetch: globalThis.fetch, now: Date.now, freshMinutes: 2, lookbackMs: 60_000, ...defined(options) };
		this.crispCursor = this.options.now() - this.options.lookbackMs;
		this.chromeCursor = this.crispCursor;
		this.windowsCursor = this.crispCursor;
	}

	/** Un tour de surveillance ; deux appels simultanés partagent le même tour. */
	tick(): Promise<void> {
		this.ticking ??= this.run().finally(() => {
			this.ticking = undefined;
		});
		return this.ticking;
	}

	/**
	 * Les deux recherches partent l'une après l'autre : en parallèle, Screenpipe répond souvent
	 * 503 « search is busy ». Une recherche refusée est simplement retentée au tour suivant.
	 */
	private async run(): Promise<void> {
		const errors: Error[] = [];
		try {
			const crispFrames = await this.search({ browser_url: "app.crisp.chat" }, this.crispCursor);
			for (const item of crispFrames) await this.readCrispFrame(item);
			this.crispCursor = latest(crispFrames, this.crispCursor);
		} catch (error) {
			errors.push(error as Error);
		}
		try {
			const chromeFrames = await this.search({ app_name: "Google Chrome" }, this.chromeCursor);
			for (const item of chromeFrames) this.readTabStrip(item);
			this.chromeCursor = latest(chromeFrames, this.chromeCursor);
		} catch (error) {
			errors.push(error as Error);
		}
		// Windows (mesuré le 17/10 sur le poste d'Andrea) : Chrome s'appelle « chrome.exe », et `browser_url`
		// n'est rempli que sur les captures par accessibilité, où la liste Crisp ne se lit pas. La liste se
		// lit sur les captures OCR : on les reconnaît au titre de la fenêtre. Sur Mac, cette recherche est vide.
		try {
			const windowsFrames = await this.search({ content_type: "ocr", app_name: "chrome.exe" }, this.windowsCursor);
			for (const item of windowsFrames) {
				if (CRISP_WINDOW.test(item.content.window_name ?? "")) await this.readCrispFrame(item);
				// Alt+Tab (« Task Switching ») : la seule capture lisible de la liste Crisp en répétition (mesuré
				// le 17/10, 23:31:32 ; les captures de l'onglet n'avaient que la barre d'outils). Liste seulement.
				else if (item.content.text?.includes("app.crisp.chat")) await this.readCrispFrame(item, false);
				else this.readTabStrip(item);
			}
			this.windowsCursor = latest(windowsFrames, this.windowsCursor);
		} catch (error) {
			errors.push(error as Error);
		}
		if (errors.length === 3) throw errors[0];
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
		const response = await this.options.fetch(`${this.options.screenpipeUrl}/search?${query}`, { headers: this.headers(), signal: AbortSignal.timeout(15_000) });
		if (!response.ok) throw new Error(`/search : HTTP ${response.status}`);
		return ((await response.json()) as { data?: SearchItem[] }).data ?? [];
	}

	private headers(): Record<string, string> {
		return { Authorization: `Bearer ${this.options.apiKey}` };
	}

	private async readCrispFrame(item: SearchItem, crispWindow = true): Promise<void> {
		const { frame_id: frameId, timestamp, window_name: windowName } = item.content;
		if (frameId === undefined || this.seenFrames.has(frameId)) return;
		const frameAt = Date.parse(timestamp);

		// Hors de la fenêtre Crisp, le titre ne dit rien du compteur ni de la conversation ouverte.
		if (crispWindow) this.noteUnread(unreadCount(windowName), "crisp", frameAt);
		const opened = crispWindow ? openConversation(windowName) : this.opened;
		if (crispWindow && opened && opened !== this.opened) {
			this.opened = opened;
			if (!this.baseline) this.emit({ kind: "opened", name: opened, frameAt });
		}

		const response = await this.options.fetch(`${this.options.screenpipeUrl}/frames/${frameId}/elements`, { headers: this.headers(), signal: AbortSignal.timeout(15_000) });
		if (!response.ok) return; // relue au tour suivant : une capture Alt+Tab est parfois la seule lisible
		this.seenFrames.add(frameId);
		if (this.seenFrames.size > 5000) for (const id of [...this.seenFrames].slice(0, 2500)) this.seenFrames.delete(id);
		const elements = ((await response.json()) as { data?: FrameElement[] }).data ?? [];
		// Un même client peut avoir deux lignes (une ancienne conversation « Élodie › Andrea ») : on garde la plus récente.
		const byName = new Map<string, { row: ReturnType<typeof inboxRows>[number]; fresh: boolean; name: string }>();
		// OCR (positions des mots) ou accessibilité (une ligne = un lien) : Screenpipe donne l'un ou l'autre.
		for (const row of [...inboxRows(elements), ...accessibilityRows(elements)]) {
			// « Jean > Andrea » : la conversation de Jean, assignée à Andrea. La liste n'affiche que le
			// prénom ; le titre de l'onglet donne le nom complet quand la conversation est ouverte.
			const first = customerName(row.name);
			const name = opened && fold(opened).startsWith(fold(first)) ? opened : first;
			const fresh = row.ageMinutes !== undefined && row.ageMinutes <= this.options.freshMinutes;
			// Clé sans accents : l'OCR lit « Elodie », l'accessibilité « Élodie » (mesuré).
			const kept = byName.get(fold(name));
			if (!kept || (fresh && !kept.fresh)) byName.set(fold(name), { row, fresh, name });
		}
		for (const [key, { row, fresh, name }] of byName) {
			const isOpen = crispWindow && opened === name;
			// Le texte complet se lit dans la conversation ouverte ; sinon, l'aperçu de la liste.
			const text = (isOpen && (row.preview ? fullMessage(elements, row.preview) : conversationText(elements))) || row.preview;
			const known = this.rows.get(key);
			this.rows.set(key, { text: text || known?.text || "", fresh });
			if (this.baseline || !fresh) continue;
			// Nouveau message : la ligne vient de devenir récente, ou son aperçu a vraiment changé
			// (pas seulement tronqué autrement par l'OCR).
			const changed = Boolean(row.preview && known?.text && !sameText(known.text, row.preview));
			if (known?.fresh && !changed) continue;
			// Un client avec plusieurs conversations : une ancienne ligne peut remplacer la récente le temps
			// d'une capture ; le même message ne se signale qu'une fois en 30 min.
			const said = [...this.emitted].find(([k, at]) => k.startsWith(`${key}|`) && sameText(k.slice(key.length + 1), text) && frameAt - at < 30 * 60_000);
			if (said) continue;
			this.emitted.set(`${key}|${text}`, frameAt);
			this.emit({ kind: "message", name, preview: text, frameAt });
		}
	}

	private readTabStrip(item: SearchItem): void {
		if (item.content.browser_url?.includes("app.crisp.chat")) return;
		const frameId = item.content.frame_id;
		if (frameId !== undefined) {
			if (this.seenTabStrips.has(frameId)) return;
			this.seenTabStrips.add(frameId);
		}
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

function latest(items: SearchItem[], cursor: number): number {
	return Math.max(cursor, ...items.map((item) => Date.parse(item.content.timestamp)));
}

/**
 * Deux lectures du même message : l'une commence comme l'autre, aux points de suspension près et aux
 * erreurs d'OCR près (mesuré : OCR « Ies clients ne recoivent » contre accessibilité « les clients ne reçoivent »).
 */
function sameText(a: string, b: string): boolean {
	const norm = (text: string) =>
		fold(text.replace(/[….„]+$/u, ""))
			.replace(/[il1|]/g, "l")
			.replace(/[^a-z0-9]/g, "");
	const [x, y] = [norm(a), norm(b)];
	if (!x || !y) return x === y;
	return x.startsWith(y) || y.startsWith(x);
}

/** Sans accents ni majuscules : l'OCR lit tantôt « Élodie », tantôt « Elodie ». */
function fold(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
