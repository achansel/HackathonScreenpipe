import type { Config } from "../config.ts";
import { sendNotification } from "./client.ts";
import { escalate } from "./escalate.ts";
import { StatusBook, type StatusListener } from "./outcomes.ts";
import { startRedirectServer, type RedirectServer } from "./redirect.ts";
import { Scheduler } from "./scheduler.ts";
import { Store } from "./store.ts";
import { buildPayload } from "./templates.ts";
import { Tracker } from "./tracker.ts";
import type { Episode, EpisodeStatus } from "./types.ts";

export interface NotifierOptions {
	/** Par défaut, le fichier `config.dbPath` ; ":memory:" pour une démo sans trace. */
	dbPath?: string;
	slotMs?: number;
	trackIntervalMs?: number;
	quietAfterMs?: number;
}

export interface Notifier {
	/** Demande une aide pour un épisode de friction. Un épisode déjà servi est ignoré. */
	requestHelp(episode: Episode): Promise<void>;
	/** Prévient à chaque changement de statut : l'id, le statut, un détail technique. Jamais de commentaire saisi. */
	onOutcome(listener: StatusListener): void;
	/** Force un passage du suivi (cloche + 👍/👎), sans attendre l'intervalle. */
	trackNow(): Promise<void>;
	/** Le port réel du serveur de redirection. */
	readonly port: number;
	stop(): void;
}

/** Ces statuts libèrent l'écran : l'aide a été utilisée, fermée ou jugée. */
const RELEASING: ReadonlySet<EpisodeStatus> = new Set(["clicked", "dismissed", "helpful", "unhelpful"]);

export function createNotifier(config: Config, options: NotifierOptions = {}): Notifier {
	const now = Date.now;
	const store = new Store(options.dbPath ?? config.dbPath);
	const book = new StatusBook(store, now);

	let redirect: RedirectServer;
	try {
		redirect = startRedirectServer({ port: config.port, store, book });
	} catch (error) {
		store.close();
		throw error;
	}

	const scheduler = new Scheduler({
		store,
		send: (payload) => sendNotification(payload, { notifyUrl: config.notifyUrl }),
		build: (episode) => buildPayload(episode, { link: (ep) => redirect.link(ep.id) }),
		dailyCap: config.dailyCap,
		slotMs: options.slotMs,
		onStatus: (episodeId, status, detail) => book.relay(episodeId, status, detail),
	});

	const tracker = new Tracker({
		store,
		book,
		notifyUrl: config.notifyUrl,
		screenpipeUrl: config.screenpipeUrl,
		apiKey: config.apiKey,
		intervalMs: options.trackIntervalMs,
		quietAfterMs: options.quietAfterMs,
	});

	book.onChange((episodeId, status) => {
		if (RELEASING.has(status)) scheduler.release(episodeId);
		// Après les autres écouteurs : le 👎 est annoncé avant l'escalade qu'il provoque.
		if (status === "unhelpful") {
			queueMicrotask(() => {
				if (escalate(episodeId, { store, scheduler, now })) void scheduler.pump();
			});
		}
	});
	tracker.start();

	return {
		async requestHelp(episode) {
			if (scheduler.enqueue(episode)) await scheduler.pump();
		},
		onOutcome: (listener) => book.onChange(listener),
		trackNow: () => tracker.tick(),
		port: redirect.port,
		stop() {
			tracker.stop();
			scheduler.stop();
			redirect.stop();
			store.close();
		},
	};
}

export type { Episode, EpisodeStatus, DeliveryOutcome, Help, HelpKind } from "./types.ts";
