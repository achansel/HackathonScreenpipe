/**
 * Crée les canaux et l'historique Slack de PipingTable (slack-story.ts), et peut tout effacer.
 * Le manifeste local garde les identifiants créés ; les canaux existants de l'équipe ne sont jamais touchés.
 */
import { defined } from "../notify/defined.ts";
import { CHANNELS, PERSONAS, type StoryChannel } from "./slack-story.ts";

export class SlackError extends Error {
	constructor(
		readonly method: string,
		readonly code: string,
	) {
		super(`Slack ${method} : ${code}`);
	}
}

export interface SlackOptions {
	fetch?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
	/** chat.postMessage : environ un message par seconde et par canal. */
	minGapMs?: number;
}

export class Slack {
	private readonly options: Required<SlackOptions>;
	private lastCallAt = 0;

	constructor(
		private readonly token: string,
		options: SlackOptions = {},
	) {
		this.options = { fetch: globalThis.fetch, sleep: (ms) => Bun.sleep(ms), minGapMs: 1_100, ...defined(options) };
	}

	async call<T extends Record<string, unknown>>(method: string, body: Record<string, unknown> = {}): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			const wait = this.lastCallAt + this.options.minGapMs - Date.now();
			if (wait > 0) await this.options.sleep(wait);
			this.lastCallAt = Date.now();
			const response = await this.options.fetch(`https://slack.com/api/${method}`, {
				method: "POST",
				headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json; charset=utf-8" },
				body: JSON.stringify(body),
			});
			if (response.status === 429 && attempt < 4) {
				await this.options.sleep((Number(response.headers.get("retry-after")) || 2) * 1000);
				continue;
			}
			const data = (await response.json()) as T & { ok: boolean; error?: string };
			if (!data.ok) throw new SlackError(method, data.error ?? `HTTP ${response.status}`);
			return data;
		}
	}
}

export interface SlackManifest {
	teamId: string;
	channels: Record<string, { id: string; created: boolean; messages: string[]; complete: boolean }>;
}

export type Log = (line: string) => void;

/** Trouve le canal s'il existe déjà (créé par un passage précédent), sinon le crée. */
async function ensureChannel(slack: Slack, channel: StoryChannel): Promise<{ id: string; created: boolean }> {
	try {
		const created = await slack.call<{ channel: { id: string } }>("conversations.create", { name: channel.name });
		await slack.call("conversations.setPurpose", { channel: created.channel.id, purpose: channel.purpose });
		return { id: created.channel.id, created: true };
	} catch (error) {
		if (!(error instanceof SlackError && error.code === "name_taken")) throw error;
		const list = await slack.call<{ channels: { id: string; name: string }[] }>("conversations.list", { types: "public_channel", limit: 1000 });
		const existing = list.channels.find((candidate) => candidate.name === channel.name);
		if (!existing) throw error;
		await slack.call("conversations.join", { channel: existing.id });
		return { id: existing.id, created: false };
	}
}

export async function seedSlack(slack: Slack, manifest: SlackManifest, log: Log, save: () => void, channels = CHANNELS): Promise<void> {
	for (const channel of channels) {
		let record = manifest.channels[channel.name];
		if (record?.complete) continue;
		if (!record) {
			const { id, created } = await ensureChannel(slack, channel);
			record = { id, created, messages: [], complete: false };
			manifest.channels[channel.name] = record;
			save();
			if (!created) log(`  #${channel.name} existait déjà : on y ajoute l'historique`);
		}
		// Reprise : on saute les messages déjà postés (un message + ses réponses comptent chacun pour un).
		let index = 0;
		for (const message of channel.messages) {
			const persona = PERSONAS[message.from];
			let parentTs: string | undefined;
			if (index++ < record.messages.length) {
				parentTs = record.messages[index - 1];
			} else {
				const posted = await slack.call<{ ts: string }>("chat.postMessage", { channel: record.id, text: message.text, username: persona.name, icon_url: persona.avatar });
				parentTs = posted.ts;
				record.messages.push(posted.ts);
				save();
				if (message.pin) await slack.call("pins.add", { channel: record.id, timestamp: posted.ts });
			}
			for (const reply of message.replies ?? []) {
				if (index++ < record.messages.length) continue;
				const replyPersona = PERSONAS[reply.from];
				const posted = await slack.call<{ ts: string }>("chat.postMessage", {
					channel: record.id,
					thread_ts: parentTs,
					text: reply.text,
					username: replyPersona.name,
					icon_url: replyPersona.avatar,
				});
				record.messages.push(posted.ts);
				save();
			}
		}
		record.complete = true;
		save();
		log(`  ✓ #${channel.name}`);
	}
}

/** Supprime les messages postés mais garde les canaux : pour reposter l'historique (nouveaux portraits, textes corrigés). */
export async function clearMessages(slack: Slack, manifest: SlackManifest, log: Log, save: () => void): Promise<void> {
	for (const [name, record] of Object.entries(manifest.channels)) {
		for (const ts of [...record.messages].reverse()) {
			try {
				await slack.call("chat.delete", { channel: record.id, ts });
			} catch (error) {
				if (!(error instanceof SlackError && error.code === "message_not_found")) throw error;
			}
		}
		record.messages = [];
		record.complete = false;
		save();
		log(`  vidé : #${name}`);
	}
}

/** Supprime les messages postés ; archive les canaux que le script a créés (jamais ceux de l'équipe). */
export async function wipeSlack(slack: Slack, manifest: SlackManifest, log: Log, save: () => void): Promise<void> {
	for (const [name, record] of Object.entries(manifest.channels)) {
		for (const ts of [...record.messages].reverse()) {
			try {
				await slack.call("chat.delete", { channel: record.id, ts });
			} catch (error) {
				if (!(error instanceof SlackError && error.code === "message_not_found")) throw error;
			}
		}
		if (record.created) {
			try {
				// Un canal archivé garde son nom : on le renomme d'abord, pour pouvoir le recréer.
				await slack.call("conversations.rename", { channel: record.id, name: `${name}-archive-${Date.now().toString(36)}` });
				await slack.call("conversations.archive", { channel: record.id });
			} catch (error) {
				if (!(error instanceof SlackError && error.code === "already_archived")) throw error;
			}
		}
		delete manifest.channels[name];
		save();
		log(`  effacé : #${name}${record.created ? " (archivé)" : ""}`);
	}
}

export function channelUrl(teamId: string, channelId: string): string {
	return `https://app.slack.com/client/${teamId}/${channelId}`;
}
