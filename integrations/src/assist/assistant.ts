/**
 * L'assistant Crisp : reçoit ce que la surveillance de Crisp a vu, et demande les aides au notifieur.
 *
 * La liste Crisp n'affiche parfois que le prénom (« Jean > Andrea ») : le message attend alors que
 * l'agent ouvre la conversation, dont le titre donne le nom complet (« Jean Dupont | Crisp »).
 */
import type { CrispEvent } from "../detect/crisp-watcher.ts";
import type { Episode } from "../notify/types.ts";
import { type AssistContext, helpsFor } from "./crisp-assist.ts";
import type { CustomerCard } from "./hubspot-lookup.ts";

export interface AssistantOptions {
	/** Absent : pas de jeton HubSpot, les aides partent sans la fiche du client. */
	findCustomer?: (fullName: string) => Promise<CustomerCard[]>;
	requestHelp: (episode: Episode) => Promise<void>;
	context: () => AssistContext;
	log: (line: string) => void;
	/** Le même message n'est servi qu'une fois dans cette fenêtre. */
	dedupeMs?: number;
	now?: () => number;
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export class CrispAssistant {
	private readonly waiting = new Map<string, string>();
	private readonly served = new Map<string, number>();
	private readonly dedupeMs: number;
	private readonly now: () => number;

	constructor(private readonly options: AssistantOptions) {
		this.dedupeMs = options.dedupeMs ?? 10 * 60_000;
		this.now = options.now ?? Date.now;
	}

	async onEvent(event: CrispEvent): Promise<void> {
		if (event.kind === "message") {
			if (!event.preview.trim()) return;
			if (!event.name.includes(" ")) {
				this.waiting.set(fold(event.name), event.preview);
				this.options.log(`⏳ ${event.name} : nom incomplet, j'attends que la conversation soit ouverte`);
				return;
			}
			return this.serve(event.name, event.preview);
		}
		if (event.kind === "opened") {
			const first = fold(event.name.split(/\s+/)[0] ?? "");
			const text = this.waiting.get(first);
			if (text) {
				this.waiting.delete(first);
				return this.serve(event.name, text);
			}
		}
	}

	private async serve(name: string, text: string): Promise<void> {
		const key = `${fold(name)}|${fold(text).slice(0, 60)}`;
		const last = this.served.get(key);
		if (last !== undefined && this.now() - last < this.dedupeMs) return;
		this.served.set(key, this.now());

		let card: CustomerCard | undefined;
		if (this.options.findCustomer) {
			try {
				const cards = await this.options.findCustomer(name);
				if (cards.length === 1) card = cards[0];
				else if (cards.length > 1) this.options.log(`⚠ ${cards.length} contacts « ${name} » dans HubSpot : fiche non choisie`);
				else this.options.log(`🔎 « ${name} » n'est pas dans HubSpot`);
			} catch (error) {
				this.options.log(`⚠ HubSpot : ${(error as Error).message}`);
			}
		}
		const helps = helpsFor({ name, text }, card, this.options.context());
		if (helps.length === 0) {
			this.options.log(`· ${name} : aucune aide pour ce message`);
			return;
		}
		this.options.log(`🔔 ${name}${card?.company ? ` (${card.company.name})` : ""} → ${helps.map((help) => help.stage).join(", ")}`);
		for (const help of helps) await this.options.requestHelp(help);
	}
}
