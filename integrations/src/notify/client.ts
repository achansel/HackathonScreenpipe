import type { DeliveryOutcome, NotifyPayload } from "./types.ts";

/**
 * `/notify` répond toujours `success: true` : seul `message` dit ce qui s'est passé.
 * Textes exacts relevés dans screenpipe-app-tauri/src-tauri/src/notifications/routes.rs (v2.7.114).
 */
export const OUTCOME_BY_MESSAGE: Readonly<Record<string, DeliveryOutcome>> = {
	"Notification sent successfully": "shown",
	"notifications paused": "paused",
	"duplicate notification suppressed": "duplicate",
	"pipe notifications disabled": "pipe_disabled",
	"pipe muted": "muted",
	"Notification already sent": "already_sent",
};

export function parseNotifyResponse(httpStatus: number, body: unknown): DeliveryOutcome {
	if (httpStatus < 200 || httpStatus >= 300) return "unknown";
	if (typeof body !== "object" || body === null) return "unknown";
	const message = (body as { message?: unknown }).message;
	if (typeof message !== "string") return "unknown";
	return OUTCOME_BY_MESSAGE[message] ?? "unknown";
}

export interface SendOptions {
	notifyUrl: string;
	timeoutMs?: number;
	fetch?: typeof fetch;
}

/** Envoie la notification et rapporte ce que Screenpipe en a fait. Ne lève jamais d'exception. */
export async function sendNotification(payload: NotifyPayload, options: SendOptions): Promise<DeliveryOutcome> {
	const doFetch = options.fetch ?? fetch;
	let response: Response;
	try {
		response = await doFetch(`${options.notifyUrl}/notify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
		});
	} catch {
		return "unreachable";
	}
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		// corps illisible : le statut seul ne suffit pas à conclure
	}
	return parseNotifyResponse(response.status, body);
}
