import type { Store } from "./store.ts";
import type { EpisodeStatus } from "./types.ts";

/** Ce que l'extérieur reçoit : l'id, le statut, un détail technique. Jamais de texte saisi par l'utilisateur. */
export type StatusListener = (episodeId: string, status: EpisodeStatus, detail?: string) => void;

/**
 * Un statut ne fait qu'avancer : un clic compte plus qu'une ouverture dans la cloche,
 * et un 👍/👎 plus que tout. Seul un 👍 peut devenir 👎 (et l'inverse) : la personne a changé d'avis.
 */
const RANK: Record<EpisodeStatus, number> = {
	queued: 0,
	shown: 1,
	unconfirmed: 1.5,
	seen: 2,
	dismissed: 3,
	clicked: 4,
	helpful: 5,
	unhelpful: 5,
	rejected: 99,
	suppressed: 99,
};

const FINAL: ReadonlySet<EpisodeStatus> = new Set(["rejected", "suppressed"]);

/** Le carnet des statuts après l'envoi : redirection, suivi et escalade passent tous par lui. */
export class StatusBook {
	private readonly listeners: StatusListener[] = [];

	constructor(
		private readonly store: Store,
		private readonly now: () => number = Date.now,
	) {}

	onChange(listener: StatusListener): void {
		this.listeners.push(listener);
	}

	/**
	 * Fait avancer un épisode. `localNote` (un commentaire de 👎) est gardé dans le fichier local
	 * et n'est jamais transmis aux écouteurs. Retourne true si le statut a changé.
	 */
	advance(episodeId: string, status: EpisodeStatus, localNote?: string): boolean {
		const current = this.store.getEpisode(episodeId)?.status;
		if (!current || FINAL.has(current) || current === status) return false;
		if (status === "unconfirmed" && current !== "shown") return false;
		if (RANK[status] < RANK[current]) return false;
		if (RANK[status] === RANK[current] && !(RANK[status] === RANK.helpful)) return false;
		const now = this.now();
		this.store.setStatus(episodeId, status, now);
		this.store.addEvent(episodeId, "status", now, status);
		if (localNote) this.store.addEvent(episodeId, "comment", now, localNote);
		this.emit(episodeId, status);
		return true;
	}

	/** Relaie un statut déjà enregistré par le planificateur (file, envoi, rejet). */
	relay(episodeId: string, status: EpisodeStatus, detail?: string): void {
		this.emit(episodeId, status, detail);
	}

	private emit(episodeId: string, status: EpisodeStatus, detail?: string): void {
		for (const listener of this.listeners) listener(episodeId, status, detail);
	}
}
