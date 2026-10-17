/**
 * Un appel client, rendu au démon d'Andrea comme Crisp et HubSpot : des épisodes à qualifier, et le
 * contexte du dossier. Ce code ne décide pas d'aide.
 *
 * - La phrase du **client** (son de l'appel, « output ») est du contexte : à elle seule, pas une friction.
 * - La phrase de **Léa** (micro, « input ») donne un épisode : les dernières phrases de l'appel, pour que
 *   le démon juge ce qu'elle fait maintenant (« je ne sais pas ce qu'on peut vous offrir, je vérifie »).
 *
 * Le client se lit dans le titre de la réunion Screenpipe (« Appel Jean Dupont », posé par `bun run call`).
 * Rien n'est gardé après l'appel.
 */
import type { TranscriptItem } from "./call-listener.ts";
import type { DaemonEpisode } from "./hubspot-detours.ts";

export const CALL_WINDOW = "Appel téléphonique";

export interface CallEpisodesOptions {
	onEpisode: (episode: DaemonEpisode) => void;
	/** Un appel commence ; `customer` est lu dans le titre, s'il y en a un. */
	onCallStart?: (call: { meetingId: number; customer?: string }) => void;
	/** Une phrase du client : le contexte du dossier. */
	onCustomerSentence?: (text: string) => void;
	onCallEnd?: () => void;
	now?: () => number;
	/** Phrases plus anciennes : hors de l'épisode. */
	historyMs?: number;
	/** Une phrase de Léa plus courte (« oui », « d'accord ») ne fait pas d'épisode. */
	minWords?: number;
}

export function customerFromTitle(title: string | null | undefined): string | undefined {
	const name = title?.match(/^Appel\s+(.+)$/i)?.[1]?.trim();
	return name && !/^client inconnu$/i.test(name) ? name : undefined;
}

interface Line {
	speaker: "client" | "employee";
	text: string;
	at: number;
}

export class CallEpisodes {
	private readonly options: Required<Omit<CallEpisodesOptions, "onCallStart" | "onCustomerSentence" | "onCallEnd">> & CallEpisodesOptions;
	private meetingId: number | null = null;
	private lines: Line[] = [];
	private readonly seen = new Set<string>();

	constructor(options: CallEpisodesOptions) {
		this.options = { now: Date.now, historyMs: 90_000, minWords: 4, ...options };
	}

	/** Le statut de la transcription en direct (`/ws/meeting-overlay`), et le titre de la réunion. */
	status(active: boolean, meetingId: number | null, title?: string | null): void {
		if (active && meetingId !== null && meetingId !== this.meetingId) {
			this.meetingId = meetingId;
			this.lines = [];
			const customer = customerFromTitle(title);
			this.options.onCallStart?.({ meetingId, ...(customer && { customer }) });
		} else if (!active && this.meetingId !== null) {
			this.meetingId = null;
			this.lines = [];
			this.options.onCallEnd?.();
		}
	}

	get activeMeetingId(): number | null {
		return this.meetingId;
	}

	/** Une phrase finale de la transcription. */
	sentence(item: TranscriptItem): void {
		const text = item.text.trim();
		const key = `${item.deviceType}:${item.itemId}`;
		if (!text || this.seen.has(key)) return;
		this.seen.add(key);
		const at = Date.parse(item.capturedAt) || this.options.now();
		const speaker = item.deviceType === "input" ? "employee" : "client";
		this.lines = this.lines.filter((line) => at - line.at < this.options.historyMs);
		this.lines.push({ speaker, text, at });
		if (speaker === "client") {
			this.options.onCustomerSentence?.(text);
			return;
		}
		if (text.split(/\s+/).length < this.options.minWords) return;
		const transcript = this.lines.map((line) => `${line.speaker === "client" ? "Client" : "Employé"} : « ${line.text} »`).join("\n");
		this.options.onEpisode({
			id: `call${hash(`${this.meetingId}:${key}`)}`,
			app: "Appel",
			window: CALL_WINDOW,
			titles: [CALL_WINDOW],
			text: `Appel téléphonique avec un client, transcription des dernières phrases (la dernière est celle de l'employé) :\n${transcript}`,
			at,
		});
	}
}

function hash(text: string): string {
	let value = 2166136261;
	for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
	return (value >>> 0).toString(36);
}
