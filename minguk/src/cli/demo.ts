/**
 * Déclenche les trois aides du parcours de Jean Dupont (client fictif, voir docs/crisp.md),
 * puis reste à l'écoute : clics sur [Y aller], ouverture ou fermeture dans la cloche, 👍/👎.
 * Un 👎 sur la 🧭 ou la 📘 fait apparaître la 💬 de repli.
 *
 * `bun run demo`                  les trois, une à la fois
 * `bun run demo --step rule`      une seule : path | slack | rule
 * `bun run demo --gap 15`         secondes maximum entre deux aides (défaut 10)
 * `bun run demo --watch 5`        minutes d'écoute avant de quitter (défaut 10) ; Ctrl+C pour arrêter
 * `bun run demo --manual`         mode présentation : Entrée envoie l'aide suivante, q quitte
 *
 * Avant de présenter : `bun run demo:check` (révèle une pause des notifications).
 *
 * Les règles et les messages sont fictifs, écrits pour la démo.
 * URL réelles facultatives : DEMO_HUBSPOT_RECORD_URL, DEMO_HUBSPOT_DEAL_URL, DEMO_SLACK_CHANNEL_URL,
 * DEMO_SLACK_SUPPORT_URL.
 */
import { parseArgs } from "node:util";
import { loadConfig } from "../config.ts";
import { createNotifier } from "../notify/index.ts";
import type { Episode, HelpKind, SlackHelp } from "../notify/types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function demoEpisodes(runId: string, now: number): Record<HelpKind, Episode> {
	const recordUrl = process.env.DEMO_HUBSPOT_RECORD_URL || "https://app.hubspot.com/";
	const dealUrl = process.env.DEMO_HUBSPOT_DEAL_URL || recordUrl;
	const slackUrl = process.env.DEMO_SLACK_CHANNEL_URL || "https://app.slack.com/client";
	const supportUrl = process.env.DEMO_SLACK_SUPPORT_URL || slackUrl;
	const askSupport = (topic: string): SlackHelp => ({
		kind: "slack",
		reason: "Demander à l'équipe",
		channel: "#support",
		channelUrl: supportUrl,
		message: `[Question] ${topic} · client Jean Dupont (Le Bistro)\nCe que j'ai essayé : la règle proposée ne s'applique pas à ce cas.`,
	});
	return {
		slack: {
			id: `demo-${runId}-slack`,
			stage: "signaler-un-bug",
			createdAt: now,
			customerWaiting: false,
			help: {
				kind: "slack",
				reason: "Bug client",
				channel: "#bugs",
				channelUrl: slackUrl,
				message: [
					"[Bug] Le Bistro · page de réservation en panne",
					"Client : Jean Dupont (premium)",
					"Symptôme : la page de réservation ne charge plus",
					"Depuis : ce matin, 9 h",
				].join("\n"),
			},
		},
		path: {
			id: `demo-${runId}-path`,
			stage: "offre-client",
			createdAt: now,
			customerWaiting: false,
			help: {
				kind: "path",
				destination: "Produits du contrat signé",
				breadcrumb: ["Contact", "Transactions", "Contrat signé", "Produits"],
				url: dealUrl,
				fallbackUrl: recordUrl,
				teamCount: 5,
			},
			escalation: askSupport("Où voir l'offre d'un client ?"),
		},
		rule: {
			id: `demo-${runId}-rule`,
			stage: "geste-commercial",
			createdAt: now,
			customerWaiting: true,
			help: {
				kind: "rule",
				title: "Geste commercial : 1 mois offert max",
				condition: "Premium seulement.",
				exception: "Sinon : un bon de 10 %.",
				action: "Note `geste commercial` dans HubSpot.",
				confirmedAt: now - 5 * DAY_MS,
				recordUrl,
				note: "Geste commercial : 1 mois offert (client premium), suite à la panne de la page de réservation.",
				reply:
					"Bonjour Jean, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un mois d'abonnement.",
			},
			escalation: askSupport("Geste commercial pour une panne"),
		},
	};
}

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		step: { type: "string" },
		gap: { type: "string", default: "10" },
		watch: { type: "string", default: "10" },
		manual: { type: "boolean", default: false },
	},
});

const order: HelpKind[] = ["slack", "path", "rule"];
const steps = values.step ? [values.step] : order;
const unknown = steps.filter((step) => !order.includes(step as HelpKind));
if (unknown.length > 0) {
	console.error(`--step inconnu : ${unknown.join(", ")} (attendu : ${order.join(" | ")})`);
	process.exit(1);
}
const gapSeconds = Number(values.gap);
const watchMinutes = Number(values.watch);
if (!Number.isFinite(gapSeconds) || gapSeconds < 0 || !Number.isFinite(watchMinutes) || watchMinutes <= 0) {
	console.error("--gap (secondes) et --watch (minutes) doivent être des nombres positifs");
	process.exit(1);
}

// /notify est ouvert ; le jeton ne sert qu'à lire les 👍/👎.
const config = loadConfig(process.env, { requireApiKey: false });
if (!config.apiKey) console.warn("SCREENPIPE_API_KEY absent : les 👍/👎 ne seront pas lus.");

// En mode présentation, Entrée veut dire « maintenant » : l'aide précédente ne retient pas la suivante.
const slotMs = values.manual ? 1_000 : gapSeconds * 1000;
const notifier = createNotifier(config, { dbPath: ":memory:", slotMs, trackIntervalMs: 2_000 });
const time = () => new Date().toLocaleTimeString("fr-FR");

const HINTS: Record<string, string> = {
	paused: "les notifications Screenpipe sont en pause ou en heures silencieuses : les réactiver, puis relancer",
	pipe_disabled: "les notifications de pipes sont coupées dans les réglages de Screenpipe",
	muted: "le pipe friction-assist est rendu muet dans les réglages de Screenpipe",
	unreachable: "Screenpipe ne répond pas sur SCREENPIPE_NOTIFY_URL : l'appli est-elle lancée ?",
};
notifier.onOutcome((episodeId, status, detail) => {
	console.log(`${time()}  ${episodeId} → ${status}${detail ? ` (${detail})` : ""}`);
	const hint = detail ? HINTS[detail] : undefined;
	if (status === "suppressed" && hint) console.error(`  ⚠ ${hint}`);
});

function shutdown(): never {
	notifier.stop();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setTimeout(shutdown, watchMinutes * 60_000);

console.log(`Redirection sur http://127.0.0.1:${notifier.port} · écoute ${watchMinutes} min · Ctrl+C pour arrêter`);
const episodes = demoEpisodes(String(Date.now()), Date.now());
const LABELS: Record<HelpKind, string> = { slack: "💬 Slack + message", path: "🧭 chemin rapide", rule: "📘 règle maison" };

if (values.manual) {
	const queue = [...steps] as HelpKind[];
	console.log(`Mode présentation. Entrée → ${LABELS[queue[0]!]} · q → quitter`);
	// Une seule boucle de lecture : après la dernière aide, on continue d'écouter jusqu'à « q ».
	for await (const line of console) {
		if (line.trim().toLowerCase() === "q") break;
		const step = queue.shift();
		if (!step) continue;
		await notifier.requestHelp(episodes[step]);
		console.log(queue[0] ? `Entrée → ${LABELS[queue[0]]}` : "Plus d'aide à envoyer. Écoute des clics et des 👍/👎… (q pour quitter)");
	}
	shutdown();
} else {
	for (const step of steps) await notifier.requestHelp(episodes[step as HelpKind]);
}
