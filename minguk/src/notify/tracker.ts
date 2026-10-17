import { defined } from "./defined.ts";
import type { StatusBook } from "./outcomes.ts";
import type { Store } from "./store.ts";

export interface TrackerOptions {
	store: Store;
	book: StatusBook;
	notifyUrl: string;
	screenpipeUrl: string;
	/** Sans jeton, les 👍/👎 ne sont pas lus : seuls la cloche et les clics comptent. */
	apiKey: string | undefined;
	now?: () => number;
	intervalMs?: number;
	/** Sans aucun signal passé ce délai, l'aide est « non confirmée » (jamais « ignorée »). */
	quietAfterMs?: number;
	fetch?: typeof fetch;
}

interface BellEntry {
	id: string;
	read: boolean;
}

interface FeedbackRecord {
	target: { kind: string; id: string };
	rating: "up" | "down";
	comment?: string;
	updated_at: string;
}

/**
 * Lit ce que Screenpipe sait de nos aides, toutes les quelques secondes, tant qu'il y en a d'ouvertes :
 * - la cloche (`GET /notifications`) : dépliée → vue ; retirée → fermée ;
 * - les retours (`GET /feedback`) : 👍 → utile ; 👎 → pas utile (le commentaire reste local).
 * Une 🧭 (priorité low) n'entre jamais dans la cloche : seuls son clic et ses 👍/👎 la suivent.
 */
export class Tracker {
	private readonly opts: Required<Omit<TrackerOptions, "apiKey">> & Pick<TrackerOptions, "apiKey">;
	private timer: ReturnType<typeof setInterval> | null = null;
	private running: Promise<void> | null = null;

	constructor(options: TrackerOptions) {
		this.opts = {
			now: Date.now,
			intervalMs: 5_000,
			quietAfterMs: 30 * 60_000,
			fetch: fetch,
			...defined(options),
		};
	}

	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => void this.tick(), this.opts.intervalMs);
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/** Un passage de lecture. Un appel pendant un passage en cours attend celui-ci. */
	tick(): Promise<void> {
		this.running ??= this.read().finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async read(): Promise<void> {
		const open = this.opts.store.openEpisodes();
		if (open.length === 0) return;
		const ids = new Set(open.map((episode) => episode.id));

		const bell = await this.getJson<BellEntry[]>(`${this.opts.notifyUrl}/notifications`);
		if (Array.isArray(bell)) {
			const inBell = new Map(bell.map((entry) => [entry.id, entry]));
			for (const { id } of open) {
				const entry = inBell.get(id);
				if (entry) {
					if (!this.opts.store.hasEvent(id, "in_bell")) this.opts.store.addEvent(id, "in_bell", this.opts.now());
					if (entry.read) this.opts.book.advance(id, "seen");
				} else if (this.opts.store.hasEvent(id, "in_bell")) {
					this.opts.book.advance(id, "dismissed");
				}
			}
		}

		if (this.opts.apiKey) {
			const feedback = await this.getJson<{ data?: FeedbackRecord[] }>(
				`${this.opts.screenpipeUrl}/feedback?kind=notification&limit=100`,
				{ Authorization: `Bearer ${this.opts.apiKey}` },
			);
			const latest = new Map<string, FeedbackRecord>();
			for (const record of feedback?.data ?? []) {
				if (!ids.has(record.target?.id)) continue;
				const previous = latest.get(record.target.id);
				if (!previous || record.updated_at > previous.updated_at) latest.set(record.target.id, record);
			}
			for (const [id, record] of latest) {
				this.opts.book.advance(id, record.rating === "up" ? "helpful" : "unhelpful", record.comment);
			}
		}

		const quietSince = this.opts.now() - this.opts.quietAfterMs;
		for (const episode of this.opts.store.openEpisodes()) {
			if (episode.status === "shown" && episode.shownAt > 0 && episode.shownAt < quietSince) {
				this.opts.book.advance(episode.id, "unconfirmed");
			}
		}
	}

	/** Lecture tolérante : Screenpipe absent ou réponse illisible → null, on réessaiera au prochain passage. */
	private async getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
		try {
			const response = await this.opts.fetch(url, { headers, signal: AbortSignal.timeout(4_000) });
			if (!response.ok) return null;
			return (await response.json()) as T;
		} catch {
			return null;
		}
	}
}
