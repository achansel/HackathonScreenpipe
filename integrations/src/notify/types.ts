export type HelpKind = "path" | "slack" | "rule";

/**
 * Une friction déjà qualifiée, prête à recevoir une aide.
 * Les champs marqués « local » peuvent contenir des données client :
 * ils restent sur la machine et ne sortent jamais vers le serveur d'équipe.
 */
export interface Episode {
	/** Unique ; sert aussi d'id de notification Screenpipe. */
	id: string;
	/** Étape générique du process, ex. "offre-client". */
	stage: string;
	createdAt: number;
	/** Un client attend dans Crisp : la priorité passe à « high ». */
	customerWaiting: boolean;
	/** Le type d'aide se lit dans `help.kind`. */
	help: Help;
	/** Après un 👎 sur une 🧭 ou une 📘 : la 💬 de repli (le bon canal pour demander). */
	escalation?: SlackHelp;
}

export type Help = PathHelp | SlackHelp | RuleHelp;

export interface PathHelp {
	kind: "path";
	/** "Produits du contrat signé" */
	destination: string;
	/** ["Contact", "Transactions", "Contrat signé", "Produits"] : un niveau = un clic évité. */
	breadcrumb: string[];
	/** URL de destination résolue en local (local) ; null → [Ouvrir la fiche]. */
	url: string | null;
	/** La fiche de départ, toujours connue (local). */
	fallbackUrl: string;
	/** « Chemin pris par l'équipe N fois ». */
	teamCount: number;
	/** Remplace « Chemin pris par l'équipe N fois » quand on sait mieux pourquoi cette fiche (« Offre Premium · trouvé par son nom »). */
	why?: string;
}

export interface SlackHelp {
	kind: "slack";
	/** "#bugs" */
	channel: string;
	/** slack://channel?team=…&id=… ou https://app.slack.com/client/… */
	channelUrl: string;
	/** Le message prêt à coller, rempli en local (local). */
	message: string;
	/** "Bug client" */
	reason: string;
}

export interface RuleHelp {
	kind: "rule";
	/** "Geste commercial : 1 mois offert max" */
	title: string;
	/** "Premium seulement." */
	condition: string;
	/** "Sinon : un bon de 10 %." */
	exception?: string;
	/** "Note `geste commercial` dans HubSpot." */
	action: string;
	/** Date du dernier 👍 sur cette règle. */
	confirmedAt: number;
	/** La fiche à vérifier (local). */
	recordUrl: string;
	/** Texte de [Copier la note] (local). */
	note: string;
	/** Texte de [Réponse client] (local). */
	reply: string;
}

export type NotifyPriority = "high" | "normal" | "low";

export type NotifyAction =
	| { id: string; label: string; type: "link"; url: string; primary?: boolean }
	| { id: string; label: string; type: "copy"; value: string; primary?: boolean }
	| { id: string; label: string; type: "deeplink"; url: string; primary?: boolean }
	| { id: string; label: string; type: "chat"; prompt: string; auto_send?: boolean; primary?: boolean };

/** Le corps de POST /notify tel que Screenpipe l'accepte (sans bouton `api`, refusé vers notre serveur). */
export interface NotifyPayload {
	id: string;
	title: string;
	body: string;
	pipe_name: string;
	priority: NotifyPriority;
	/** En millisecondes ; 0 = reste affichée. */
	timeout: number;
	actions: NotifyAction[];
}

/** Ce que Screenpipe a réellement fait de la notification (lu dans `message`). */
export type DeliveryOutcome =
	| "shown"
	| "paused"
	| "duplicate"
	| "pipe_disabled"
	| "muted"
	| "already_sent"
	| "unreachable"
	| "unknown";

export type EpisodeStatus =
	| "queued"
	| "rejected"
	| "suppressed"
	| "shown"
	| "seen"
	| "dismissed"
	| "clicked"
	| "helpful"
	| "unhelpful"
	| "unconfirmed";
