/**
 * Affiche en direct ce que Screenpipe révèle de Crisp : nouveau message, compteur de non-lus,
 * conversation ouverte. Sert à mesurer le délai réel entre l'envoi d'un message client et sa détection.
 *
 * `bun run watch:crisp`              écoute jusqu'à Ctrl+C
 * Entrée au moment où le client envoie son message : le délai jusqu'à la détection s'affiche.
 *
 * Prérequis : Chrome sur app.crisp.chat ; Screenpipe en mode « performance » (voir la fiche de démo).
 */
import { loadConfig } from "../config.ts";
import { type CrispEvent, CrispWatcher } from "../detect/crisp-watcher.ts";

const config = loadConfig();
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR");
let sentAt: number | undefined;

function describe(event: CrispEvent): string {
	if (event.kind === "message") return `💬 message de ${event.name} : « ${event.preview} »`;
	if (event.kind === "unread") return `🔴 ${event.count} non lu(s) ${event.where === "crisp" ? "dans l'onglet Crisp" : "(vu depuis un autre onglet)"}`;
	return `👀 conversation ouverte : ${event.name}`;
}

const watcher = new CrispWatcher({
	screenpipeUrl: config.screenpipeUrl,
	// loadConfig exige le jeton par défaut : il est forcément là.
	apiKey: config.apiKey!,
	onEvent: (event) => {
		const capture = ((event.detectedAt - event.frameAt) / 1000).toFixed(1);
		const total = sentAt !== undefined && event.kind !== "opened" ? ` · ${((event.detectedAt - sentAt) / 1000).toFixed(1)} s depuis l'envoi` : "";
		console.log(`${time(event.detectedAt)}  ${describe(event)}  (capture → détection ${capture} s${total})`);
		if (total) sentAt = undefined;
	},
});

console.log("Écoute de Crisp via Screenpipe. Entrée = « le client vient d'envoyer », Ctrl+C pour arrêter.");
// Screenpipe refuse parfois une recherche (« search is busy ») : on ne le signale que si ça dure.
let failures = 0;
setInterval(() => {
	watcher
		.tick()
		.then(() => {
			failures = 0;
		})
		.catch((error: Error) => {
			if (++failures === 5) console.error(`${time(Date.now())}  Screenpipe ne répond plus depuis 5 s : ${error.message} (nouvel essai chaque seconde)`);
		});
}, 1_000);

for await (const _ of console) {
	sentAt = Date.now();
	console.log(`${time(sentAt)}  ⏱ envoi noté`);
}
