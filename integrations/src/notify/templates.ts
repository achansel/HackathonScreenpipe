import type {
	Episode,
	NotifyAction,
	NotifyPayload,
	PathHelp,
	RuleHelp,
	SlackHelp,
} from "./types.ts";

/** Le producteur déclaré à Screenpipe : c'est lui qui fait apparaître les 👍/👎. */
export const PIPE_NAME = "friction-assist";

/** Limites du panneau natif Mac (360 px de large, markdown minimal). */
export const LIMITS = {
	titleChars: 45,
	bodyLines: 3,
	actions: 3,
	previewChars: 50,
} as const;

export interface BuildOptions {
	/**
	 * Transforme l'URL cible d'un bouton [Y aller] / [Ouvrir …].
	 * Par défaut l'URL directe ; l'étape 3 la fera passer par notre redirection (/go/:id).
	 */
	link?: (episode: Episode, target: string) => string;
	now?: () => number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** « aujourd'hui », « hier », « il y a 5 jours », « il y a 3 semaines ». */
export function relativeDay(then: number, now: number): string {
	const days = Math.max(0, Math.floor((now - then) / DAY_MS));
	if (days === 0) return "aujourd'hui";
	if (days === 1) return "hier";
	if (days < 14) return `il y a ${days} jours`;
	return `il y a ${Math.floor(days / 7)} semaines`;
}

function chars(text: string): number {
	return [...text].length;
}

/** Une ligne d'aperçu sûre pour un `code` inline : sans backtick, tronquée. */
export function preview(text: string, max: number = LIMITS.previewChars): string {
	const firstLine = text.split("\n").find((line) => line.trim() !== "") ?? "";
	const clean = firstLine.replaceAll("`", "'").trim();
	return chars(clean) <= max ? clean : `${[...clean].slice(0, max - 1).join("")}…`;
}

function pathPayload(episode: Episode, help: PathHelp, link: Required<BuildOptions>["link"]): NotifyPayload {
	const levels = help.breadcrumb.length;
	const go: NotifyAction = help.url
		? { id: "go", label: "Y aller", type: "link", url: link(episode, help.url), primary: true }
		: { id: "go", label: "Ouvrir la fiche", type: "link", url: link(episode, help.fallbackUrl), primary: true };
	return {
		id: episode.id,
		// Règle de design Screenpipe : ni emoji ni « ! » dans les textes de l'outil.
		title: help.destination,
		body: [
			`**1 clic au lieu de ${levels}.** ${help.why ?? `Chemin pris par l'équipe ${help.teamCount} fois.`}`,
			`\`${help.breadcrumb.join(" › ")}\``,
		].join("\n"),
		pipe_name: PIPE_NAME,
		// Une aide de navigation ne vaut plus rien deux minutes après : toast seul.
		priority: "low",
		timeout: 30_000,
		actions: [go],
	};
}

function slackPayload(episode: Episode, help: SlackHelp, link: Required<BuildOptions>["link"]): NotifyPayload {
	return {
		id: episode.id,
		title: `${help.reason} → ${help.channel}`,
		body: [
			"Modèle de l'équipe, prêt à coller :",
			`\`${preview(help.message)}\``,
			"Copier, ouvrir le canal, coller.",
		].join("\n"),
		pipe_name: PIPE_NAME,
		priority: episode.customerWaiting ? "high" : "normal",
		timeout: 60_000,
		actions: [
			// `copy` ne ferme pas le panneau : on copie d'abord, puis on ouvre.
			{ id: "copy", label: "1. Copier le message", type: "copy", value: help.message },
			{ id: "go", label: `2. Ouvrir ${help.channel}`, type: "link", url: link(episode, help.channelUrl), primary: true },
		],
	};
}

function rulePayload(
	episode: Episode,
	help: RuleHelp,
	link: Required<BuildOptions>["link"],
	now: number,
): NotifyPayload {
	const condition = help.exception
		? `**${help.condition}** ${help.exception}`
		: `**${help.condition}**`;
	return {
		id: episode.id,
		title: help.title,
		body: [
			condition,
			help.action,
			`Règle de l'équipe · confirmée ${relativeDay(help.confirmedAt, now)}`,
		].join("\n"),
		pipe_name: PIPE_NAME,
		priority: episode.customerWaiting ? "high" : "normal",
		// Le client attend : l'aide reste jusqu'à ce que Léa la ferme.
		timeout: 0,
		actions: [
			{ id: "go", label: "Y aller", type: "link", url: link(episode, help.recordUrl), primary: true },
			{ id: "note", label: "Copier la note", type: "copy", value: help.note },
			{ id: "reply", label: "Réponse client", type: "copy", value: help.reply },
		],
	};
}

/** Là où mène le bouton principal ([Y aller], [Ouvrir …]) : la cible de la redirection /go/:id. */
export function targetUrl(episode: Episode): string {
	const help = episode.help;
	switch (help.kind) {
		case "path":
			return help.url ?? help.fallbackUrl;
		case "slack":
			return help.channelUrl;
		case "rule":
			return help.recordUrl;
	}
}

export function buildPayload(episode: Episode, options: BuildOptions = {}): NotifyPayload {
	const link = options.link ?? ((_episode: Episode, target: string) => target);
	const now = (options.now ?? Date.now)();
	const help = episode.help;
	switch (help.kind) {
		case "path":
			return pathPayload(episode, help, link);
		case "slack":
			return slackPayload(episode, help, link);
		case "rule":
			return rulePayload(episode, help, link, now);
	}
}

/** Débuts de ligne que le panneau Mac afficherait en texte brut (titres, listes, citations). */
const UNSUPPORTED_LINE_START = /^\s*([#>*+-]|\d+[.)])\s/;

/**
 * Vérifie qu'une notification respecte ce que Screenpipe sait afficher partout.
 * Retourne la liste des problèmes ; vide = la notification peut partir.
 */
export function lintPayload(payload: NotifyPayload): string[] {
	const problems: string[] = [];
	if (!payload.id.trim()) problems.push("id vide");
	if (!payload.title.trim()) problems.push("titre vide");
	if (chars(payload.title) > LIMITS.titleChars) {
		problems.push(`titre trop long (${chars(payload.title)} > ${LIMITS.titleChars} caractères)`);
	}
	const lines = payload.body.split("\n");
	if (lines.length > LIMITS.bodyLines) {
		problems.push(`corps trop long (${lines.length} > ${LIMITS.bodyLines} lignes)`);
	}
	lines.forEach((line, index) => {
		if (UNSUPPORTED_LINE_START.test(line)) {
			problems.push(`ligne ${index + 1} : titre, liste ou citation markdown non affichés sur Mac`);
		}
	});
	if (payload.pipe_name !== PIPE_NAME) problems.push(`pipe_name doit valoir "${PIPE_NAME}" (sinon pas de 👍/👎)`);
	if (payload.timeout < 0) problems.push("timeout négatif");
	if (payload.actions.length > LIMITS.actions) {
		problems.push(`trop de boutons (${payload.actions.length} > ${LIMITS.actions})`);
	}
	for (const action of payload.actions) {
		const type: string = action.type;
		if (type === "api") problems.push(`bouton "${action.id}" : le type api est refusé vers notre serveur`);
		if (!action.label.trim()) problems.push(`bouton "${action.id}" : libellé vide`);
		if ((action.type === "link" || action.type === "deeplink") && !action.url.trim()) {
			problems.push(`bouton "${action.id}" : url vide`);
		}
		if (action.type === "copy" && !action.value.trim()) {
			problems.push(`bouton "${action.id}" : rien à copier`);
		}
	}
	return problems;
}
