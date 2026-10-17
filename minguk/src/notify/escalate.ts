import type { Scheduler } from "./scheduler.ts";
import type { Store } from "./store.ts";
import type { Episode } from "./types.ts";

/** L'id de la 💬 de repli : déterministe, donc une seule escalade par épisode. */
export function escalationId(episodeId: string): string {
	return `${episodeId}--escalade`;
}

/**
 * Après un 👎 sur une 🧭 ou une 📘 : propose la 💬 de repli (le bon canal Slack et son modèle),
 * si l'épisode en a une. Retourne true si une escalade a été mise en file.
 */
export function escalate(episodeId: string, deps: { store: Store; scheduler: Scheduler; now: () => number }): boolean {
	const original = deps.store.getEpisodeData(episodeId);
	if (!original || original.help.kind === "slack" || !original.escalation) return false;
	const followUp: Episode = {
		id: escalationId(episodeId),
		stage: original.stage,
		createdAt: deps.now(),
		customerWaiting: original.customerWaiting,
		help: original.escalation,
	};
	return deps.scheduler.enqueue(followUp);
}
