import { defined } from "./defined.ts";
import type { StatusListener } from "./outcomes.ts";
import type { Store } from "./store.ts";
import { buildPayload, lintPayload } from "./templates.ts";
import type { DeliveryOutcome, Episode, EpisodeStatus, NotifyPayload } from "./types.ts";

export type { StatusListener };

export interface SchedulerOptions {
	store: Store;
	send: (payload: NotifyPayload) => Promise<DeliveryOutcome>;
	build?: (episode: Episode) => NotifyPayload;
	/** Nombre maximal d'aides affichées par jour (minuit local). */
	dailyCap: number;
	now?: () => number;
	/** Durée maximale pendant laquelle une aide affichée bloque la suivante. */
	slotMs?: number;
	/** Attente après « notifications en pause » ou « pipe rendu muet ». */
	pauseBackoffMs?: number;
	/** Attente quand Screenpipe ne répond pas. */
	unreachableBackoffMs?: number;
	/** Au-delà, une aide restée en file est périmée : la friction est passée. */
	maxWaitMs?: number;
	/** Programmation du prochain réveil ; remplaçable dans les tests. */
	schedule?: (wake: () => void, delayMs: number) => () => void;
	onStatus?: StatusListener;
}

interface QueueItem {
	episode: Episode;
	enqueuedAt: number;
}

function startOfLocalDay(now: number): number {
	const day = new Date(now);
	day.setHours(0, 0, 0, 0);
	return day.getTime();
}

/**
 * « · 11:02:37 », ajouté au corps pour passer le filtre de répétition de Screenpipe (90 s).
 * À la seconde : à la minute, deux essais rapprochés (une répétition de démo) retombaient sur le même texte.
 */
function timeSuffix(now: number): string {
	const date = new Date(now);
	const pad = (n: number) => String(n).padStart(2, "0");
	return ` · ${date.getHours()}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function withSuffix(payload: NotifyPayload, now: number): NotifyPayload {
	return { ...payload, body: `${payload.body}${timeSuffix(now)}` };
}

const defaultSchedule = (wake: () => void, delayMs: number): (() => void) => {
	const timer = setTimeout(wake, delayMs);
	return () => clearTimeout(timer);
};

/**
 * Le rythme des aides : une à la fois, un épisode = une notification,
 * un plafond quotidien, et de la retenue quand Screenpipe est en pause.
 */
export class Scheduler {
	private readonly opts: Required<Omit<SchedulerOptions, "onStatus">> & Pick<SchedulerOptions, "onStatus">;
	private readonly queue: QueueItem[] = [];
	private activeId: string | null = null;
	private busyUntil = 0;
	private pausedUntil = 0;
	private cancelWake: (() => void) | null = null;
	private pumping: Promise<void> | null = null;
	private pumpAgain = false;
	private stopped = false;

	constructor(options: SchedulerOptions) {
		this.opts = {
			build: (episode) => buildPayload(episode),
			now: Date.now,
			slotMs: 60_000,
			pauseBackoffMs: 10 * 60_000,
			unreachableBackoffMs: 30_000,
			maxWaitMs: 2 * 60_000,
			schedule: defaultSchedule,
			...defined(options),
		};
	}

	/** L'aide actuellement à l'écran, s'il y en a une. */
	get active(): string | null {
		return this.activeId;
	}

	get pending(): number {
		return this.queue.length;
	}

	/** Met une aide en file. Retourne false si l'épisode a déjà été servi. */
	enqueue(episode: Episode): boolean {
		const now = this.opts.now();
		if (!this.opts.store.insertEpisode(episode, "queued", now)) return false;
		this.queue.push({ episode, enqueuedAt: now });
		// Un client qui attend passe devant ; sinon, premier arrivé, premier servi.
		this.queue.sort(
			(a, b) => Number(b.episode.customerWaiting) - Number(a.episode.customerWaiting) || a.enqueuedAt - b.enqueuedAt,
		);
		this.emit(episode.id, "queued");
		return true;
	}

	/** L'aide affichée a été utilisée ou fermée : la suivante peut partir. */
	release(episodeId: string): void {
		if (this.activeId !== episodeId) return;
		this.activeId = null;
		this.busyUntil = 0;
		void this.pump();
	}

	/** Envoie ce qui peut l'être. Un appel pendant un envoi en cours attend la fin de celui-ci. */
	pump(): Promise<void> {
		if (this.stopped) return Promise.resolve();
		if (this.pumping) {
			this.pumpAgain = true;
			return this.pumping;
		}
		this.pumping = (async () => {
			try {
				do {
					this.pumpAgain = false;
					await this.drain();
				} while (this.pumpAgain && !this.stopped);
			} finally {
				this.pumping = null;
			}
		})();
		return this.pumping;
	}

	stop(): void {
		this.stopped = true;
		this.cancelWake?.();
		this.cancelWake = null;
	}

	private async drain(): Promise<void> {
		while (this.queue.length > 0 && !this.stopped) {
			const now = this.opts.now();
			const waitUntil = Math.max(this.busyUntil, this.pausedUntil);
			if (now < waitUntil) {
				this.wakeAt(waitUntil, now);
				return;
			}
			if (this.activeId && now >= this.busyUntil) this.activeId = null;

			const item = this.queue.shift();
			if (!item) return;
			const { episode } = item;

			if (now - item.enqueuedAt > this.opts.maxWaitMs) {
				this.finish(episode.id, "suppressed", now, "expired");
				continue;
			}
			if (this.opts.store.countEventsSince("shown", startOfLocalDay(now)) >= this.opts.dailyCap) {
				this.finish(episode.id, "suppressed", now, "daily_cap");
				continue;
			}

			const payload = this.opts.build(episode);
			const problems = lintPayload(payload);
			if (problems.length > 0) {
				this.finish(episode.id, "rejected", now, problems.join("; "));
				continue;
			}

			let outcome = await this.attempt(episode.id, payload);
			if (outcome === "duplicate") {
				outcome = await this.attempt(episode.id, withSuffix(payload, this.opts.now()));
			}
			this.settle(episode.id, outcome);
		}
	}

	private async attempt(episodeId: string, payload: NotifyPayload): Promise<DeliveryOutcome> {
		const outcome = await this.opts.send(payload);
		this.opts.store.addEvent(episodeId, "outcome", this.opts.now(), outcome);
		return outcome;
	}

	private settle(episodeId: string, outcome: DeliveryOutcome): void {
		const now = this.opts.now();
		switch (outcome) {
			case "shown":
				this.opts.store.addEvent(episodeId, "shown", now);
				this.activeId = episodeId;
				this.busyUntil = now + this.opts.slotMs;
				this.finish(episodeId, "shown", now);
				return;
			case "paused":
			case "pipe_disabled":
			case "muted":
				this.pausedUntil = now + this.opts.pauseBackoffMs;
				this.finish(episodeId, "suppressed", now, outcome);
				return;
			case "unreachable":
			case "unknown":
				this.pausedUntil = now + this.opts.unreachableBackoffMs;
				this.finish(episodeId, "suppressed", now, outcome);
				return;
			case "duplicate":
			case "already_sent":
				this.finish(episodeId, "suppressed", now, outcome);
				return;
		}
	}

	private finish(episodeId: string, status: EpisodeStatus, now: number, detail?: string): void {
		this.opts.store.setStatus(episodeId, status, now);
		this.opts.store.addEvent(episodeId, "status", now, detail ? `${status}:${detail}` : status);
		this.emit(episodeId, status, detail);
	}

	private emit(episodeId: string, status: EpisodeStatus, detail?: string): void {
		this.opts.onStatus?.(episodeId, status, detail);
	}

	private wakeAt(at: number, now: number): void {
		this.cancelWake?.();
		this.cancelWake = this.opts.schedule(() => {
			this.cancelWake = null;
			void this.pump();
		}, Math.max(0, at - now));
	}
}
