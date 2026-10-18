/**
 * La transcription en direct d'une réunion Screenpipe (`/ws/meeting-overlay`) : des morceaux (« delta »)
 * pendant qu'on parle, puis la phrase finale (« final ») après un silence.
 * Seules les réunions démarrées à la main ont la transcription en direct.
 */

export interface TranscriptItem {
	meetingId: number;
	itemId: string;
	/** « input » : le micro (Léa) ; « output » : le son de l'appel (le client). */
	deviceType: string;
	text: string;
	capturedAt: string;
}

export interface CallListenerOptions {
	screenpipeUrl: string;
	apiKey: string;
	onSentence: (item: TranscriptItem) => void;
	/** Le premier morceau de chaque phrase : utile pour mesurer la réactivité. */
	onPartial?: (item: TranscriptItem) => void;
	onStatus?: (status: { active: boolean; activeMeetingId: number | null }) => void;
	onClose?: (code: number) => void;
}

export function listenToMeeting(options: CallListenerOptions): { close: () => void; opened: Promise<void> } {
	const url = `${options.screenpipeUrl.replace(/^http/, "ws")}/ws/meeting-overlay?token=${encodeURIComponent(options.apiKey)}`;
	// Bun accepte des en-têtes à l'ouverture d'un WebSocket.
	const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${options.apiKey}` } } as unknown as string[]);
	const seenPartials = new Set<string>();
	const opened = new Promise<void>((resolve, reject) => {
		socket.addEventListener("open", () => resolve());
		socket.addEventListener("error", () => reject(new Error(`connexion impossible à ${options.screenpipeUrl}/ws/meeting-overlay`)));
	});
	socket.addEventListener("close", (event) => options.onClose?.(event.code));
	socket.addEventListener("message", (event) => {
		const message = JSON.parse(String(event.data)) as { type: string; data: unknown };
		if (message.type === "status") {
			options.onStatus?.(message.data as { active: boolean; activeMeetingId: number | null });
			return;
		}
		if (message.type !== "delta" && message.type !== "final") return;
		const item = message.data as TranscriptItem;
		const key = `${item.deviceType}:${item.itemId}`;
		if (message.type === "delta") {
			if (!seenPartials.has(key)) options.onPartial?.(item);
			seenPartials.add(key);
			return;
		}
		options.onSentence(item);
	});
	return { close: () => socket.close(), opened };
}

/** Démarre une réunion manuelle : c'est elle qui active la transcription en direct. */
export async function startMeeting(screenpipeUrl: string, apiKey: string, title: string): Promise<number> {
	const response = await fetch(`${screenpipeUrl}/meetings/start`, {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify({ title, app: "manual" }),
	});
	if (!response.ok) throw new Error(`/meetings/start : HTTP ${response.status}`);
	return ((await response.json()) as { id: number }).id;
}

export async function stopMeeting(screenpipeUrl: string, apiKey: string): Promise<void> {
	await fetch(`${screenpipeUrl}/meetings/stop`, {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: "{}",
	});
}
