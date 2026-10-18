/**
 * D'un message Crisp aux aides : qui écrit (fiche HubSpot), et de quoi il a besoin (mots du message).
 *
 * Pour la démo, la reconnaissance du besoin est volontairement simple et lisible : des familles de mots.
 * Les règles et canaux sont ceux de PipingTable (src/seed/pipingtable.ts, src/seed/slack-story.ts).
 */
import type { Episode, PathHelp, RuleHelp, SlackHelp } from "../notify/types.ts";
import type { CustomerCard } from "./hubspot-lookup.ts";

export type Need = "bug" | "geste" | "promesse" | "prospect";

const NEEDS: [Need, RegExp][] = [
	["bug", /\b(en panne|panne|bug|ne (charge|marche|fonctionne) plus|n'envoie pas|erreur|bloqué)/i],
	["geste", /\b(dédommag|dedommag|geste|rembours|compens|indemn)/i],
	["promesse", /\b(promis|promesse|m'avait dit|on m'a dit)/i],
	["prospect", /\b(combien|tarif|prix|devis|abonnement pour)/i],
];

/** Les besoins lus dans le message, dans l'ordre où ils comptent pour Léa. */
export function classify(text: string): Need[] {
	return NEEDS.filter(([, pattern]) => pattern.test(text)).map(([need]) => need);
}

export interface AssistContext {
	now: number;
	slack: { bugs: string; support: string; newLeads: string };
	/** Quand la règle a été confirmée pour la dernière fois (le fil de Claire dans #support). */
	ruleConfirmedAt: number;
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
/** Le titre d'une notification tient sur une ligne du panneau Mac (45 caractères, emoji compris). */
const fit = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
const isPremium = (card?: CustomerCard) => /premium|groupe/i.test(card?.company?.plan ?? "");

function episode(id: string, stage: string, now: number, help: Episode["help"], escalation?: SlackHelp): Episode {
	return { id, stage, createdAt: now, customerWaiting: true, help, ...(escalation && { escalation }) };
}

/**
 * Les aides pour un message, la fiche du client d'abord : savoir qui écrit, puis quoi lui répondre.
 * `card` absent : le client n'est pas dans HubSpot (un prospect, ou un nom mal lu).
 */
export function helpsFor(message: { name: string; text: string }, card: CustomerCard | undefined, context: AssistContext): Episode[] {
	const { now, slack } = context;
	const key = `crisp-${message.name.toLowerCase().replace(/[^a-z]+/g, "-")}-${now}`;
	const needs = classify(message.text);
	const restaurant = card?.company?.name ?? "client inconnu";
	const plan = card?.company?.plan;
	const helps: Episode[] = [];
	const askSupport = (topic: string): SlackHelp => ({
		kind: "slack",
		reason: "Demander à l'équipe",
		channel: "#support",
		channelUrl: slack.support,
		message: `[Question] ${topic} · ${restaurant}${plan ? ` (${plan})` : ""}\nLe client écrit : « ${message.text.slice(0, 160)} »`,
	});

	if (card) {
		const path: PathHelp = {
			kind: "path",
			destination: fit(`${card.name} · ${restaurant}`, 42),
			breadcrumb: ["Contact", "Entreprise", "Transactions", "Produits"],
			url: card.dealUrl ?? null,
			fallbackUrl: card.contactUrl,
			teamCount: 0,
			why: plan ? `Offre ${plan} · retrouvé par son nom.` : "Retrouvé par son nom.",
		};
		helps.push(episode(`${key}-fiche`, "qui-est-le-client", now, path));
	}

	for (const need of needs) {
		if (need === "bug") {
			helps.push(
				episode(`${key}-bug`, "signaler-un-bug", now, {
					kind: "slack",
					reason: "Bug client",
					channel: "#bugs",
					channelUrl: slack.bugs,
					message: [
						`[Bug] ${restaurant} · ${message.text.slice(0, 60)}`,
						`Client : ${message.name}${plan ? ` (${plan})` : ""}`,
						`Symptôme : ${message.text.slice(0, 200)}`,
						"Depuis : aujourd'hui",
						`Fiche HubSpot : ${card?.companyUrl ?? card?.contactUrl ?? "introuvable"}`,
					].join("\n"),
				}),
			);
		}
		if (need === "geste") {
			const premium = isPremium(card);
			const rule: RuleHelp = {
				kind: "rule",
				title: "Geste commercial : 1 mois offert max",
				condition: premium ? `${plan} : 1 mois offert possible.` : "Premium ou Groupe seulement.",
				exception: premium ? undefined : "Ici : un bon de 10 %.",
				action: "Note `geste commercial` dans HubSpot.",
				confirmedAt: context.ruleConfirmedAt,
				recordUrl: card?.companyUrl ?? card?.contactUrl ?? slack.support,
				note: `Geste commercial : ${premium ? "1 mois offert" : "bon de 10 %"} (${plan ?? "offre inconnue"}), suite à : ${message.text.slice(0, 120)}`,
				reply: premium
					? `Bonjour ${firstName(message.name)}, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un mois d'abonnement.`
					: `Bonjour ${firstName(message.name)}, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un bon de 10 % sur votre prochain mois.`,
			};
			helps.push(episode(`${key}-geste`, "geste-commercial", now, rule, askSupport("Geste commercial")));
		}
		if (need === "promesse") {
			const seller = card?.deal?.seller ?? "le commercial";
			const noted = card?.deal?.conditions?.trim();
			const rule: RuleHelp = {
				kind: "rule",
				title: "Promesse : vérifier avant de confirmer",
				condition: noted ? `Noté sur la vente : ${noted}` : "Rien dans « Conditions particulières ».",
				action: noted ? "Confirmer au client." : `Demander à ${seller} avant de répondre.`,
				confirmedAt: context.ruleConfirmedAt,
				recordUrl: card?.dealUrl ?? card?.contactUrl ?? slack.support,
				note: `Promesse évoquée par le client : « ${message.text.slice(0, 120)} »`,
				reply: noted
					? `Bonjour ${firstName(message.name)}, c'est bien prévu : ${noted}`
					: `Bonjour ${firstName(message.name)}, je vérifie avec ${seller} et je reviens vers vous aujourd'hui.`,
			};
			helps.push(episode(`${key}-promesse`, "promesse-commerciale", now, rule, askSupport("Promesse d'un commercial")));
		}
		if (need === "prospect" && !card) {
			const belgian = /bruxelles|belgique|liège|liege|gand|anvers|namur/i.test(message.text);
			helps.push(
				episode(`${key}-prospect`, "nouveau-prospect", now, {
					kind: "slack",
					reason: belgian ? "Prospect belge → Sarah" : "Nouveau prospect",
					channel: "#new-leads",
					channelUrl: slack.newLeads,
					message: `Lead : ${message.name} · « ${message.text.slice(0, 160)} »\nÀ créer dans HubSpot en « Lead »${belgian ? ", pour Sarah" : ""}.`,
				}),
			);
		}
	}
	return helps;
}
