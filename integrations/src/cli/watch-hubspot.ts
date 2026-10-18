/**
 * Affiche en direct les détours de Léa dans HubSpot, au format d'épisode du démon d'Andrea :
 * recherche sans résultat, recherches successives, allers-retours entre fiches.
 *
 * `bun run watch:hubspot`               écoute jusqu'à Ctrl+C
 * `bun run watch:hubspot --rejouer 15`  rejoue les 15 dernières minutes, puis écoute
 */
import { parseArgs } from "node:util";
import { loadConfig } from "../config.ts";
import { HubSpotDetours } from "../detect/hubspot-detours.ts";

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { rejouer: { type: "string" } } });
const config = loadConfig();
const minutes = Number(values.rejouer ?? 0);
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR");

const detours = new HubSpotDetours({
	screenpipeUrl: config.screenpipeUrl,
	apiKey: config.apiKey!,
	...(minutes > 0 && { lookbackMs: minutes * 60_000, replay: true }),
	onEpisode: (episode) => console.log(`${time(Date.now())}  épisode (capture ${time(episode.at)}) ${episode.window} : ${episode.text}`),
});
console.log(`Écoute des détours HubSpot${minutes > 0 ? `, rejeu des ${minutes} dernières minutes` : ""}. Ctrl+C pour arrêter.`);
let failures = 0;
setInterval(() => {
	detours
		.tick()
		.then(() => {
			failures = 0;
		})
		.catch((error: Error) => {
			if (++failures === 5) console.error(`${time(Date.now())}  Screenpipe ne répond plus depuis 5 s : ${error.message}`);
		});
}, 1_000);
