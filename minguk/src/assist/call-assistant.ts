/**
 * L'assistant pendant un appel : chaque phrase transcrite en direct par Screenpipe passe par la même
 * reconnaissance de besoin que Crisp. Une aide de chaque sorte par appel : le client peut répéter
 * « dédommagement » trois fois, Léa n'a besoin de la règle qu'une fois.
 */
import type { Episode } from "../notify/types.ts";
import { type AssistContext, classify, helpsFor } from "./crisp-assist.ts";
import type { CustomerCard } from "./hubspot-lookup.ts";

export interface CallAssistantOptions {
	/** Le client au bout du fil, s'il est connu (titre de l'appel → fiche HubSpot). */
	customer: { name: string; card?: CustomerCard };
	requestHelp: (episode: Episode) => Promise<void>;
	context: () => AssistContext;
	log: (line: string) => void;
}

export class CallAssistant {
	private readonly served = new Set<string>();

	constructor(private readonly options: CallAssistantOptions) {}

	/** Une phrase finale de la transcription (micro de Léa ou son de l'appel). */
	async onSentence(text: string): Promise<void> {
		const needs = classify(text).filter((need) => !this.served.has(need));
		const firstHelp = !this.served.has("fiche");
		if (needs.length === 0 && !firstHelp) return;

		const { name, card } = this.options.customer;
		const helps = helpsFor({ name, text }, card, this.options.context()).filter((episode) => {
			// La fiche du client une seule fois par appel ; puis seulement les besoins pas encore servis.
			if (episode.stage === "qui-est-le-client") return firstHelp;
			return needs.some((need) => STAGE_OF[need] === episode.stage);
		});
		if (helps.length === 0) return;
		for (const need of needs) this.served.add(need);
		if (helps.some((episode) => episode.stage === "qui-est-le-client")) this.served.add("fiche");
		this.options.log(`🔔 appel ${name} : « ${text.slice(0, 60)} » → ${helps.map((episode) => episode.stage).join(", ")}`);
		for (const episode of helps) await this.options.requestHelp(episode);
	}
}

const STAGE_OF: Record<string, string> = {
	bug: "signaler-un-bug",
	geste: "geste-commercial",
	promesse: "promesse-commerciale",
	prospect: "nouveau-prospect",
};
