/**
 * Crée les canaux et l'historique Slack de PipingTable (src/seed/slack-story.ts).
 *
 * `bun run seed:slack --dry-run`   ce qui serait posté, sans réseau
 * `bun run seed:slack`             crée ; reprend là où un passage précédent s'est arrêté
 * `bun run seed:slack --wipe`      supprime les messages postés et archive les canaux créés
 *
 * Jeton : SLACK_SEED_TOKEN (~/.config/friction/env), jamais affiché.
 * Manifeste : FRICTION_SLACK_MANIFEST, par défaut ~/.local/share/friction/slack-seed.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { channelUrl, Slack, type SlackManifest, seedSlack, wipeSlack } from "../seed/slack.ts";
import { CHANNELS, PERSONAS } from "../seed/slack-story.ts";

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: { "dry-run": { type: "boolean", default: false }, wipe: { type: "boolean", default: false } },
});
const manifestPath = process.env.FRICTION_SLACK_MANIFEST || join(homedir(), ".local", "share", "friction", "slack-seed.json");
const log = (line: string) => console.log(line);

function dryRun(): void {
	for (const channel of CHANNELS) {
		log(`\n#${channel.name} · ${channel.purpose}`);
		for (const message of channel.messages) {
			log(`  ${message.pin ? "📌 " : ""}${PERSONAS[message.from].name} : ${message.text.replaceAll("\n", " ⏎ ")}`);
			for (const reply of message.replies ?? []) log(`      ↳ ${PERSONAS[reply.from].name} : ${reply.text}`);
		}
	}
	const count = CHANNELS.flatMap((channel) => channel.messages.flatMap((message) => [message, ...(message.replies ?? [])])).length;
	log(`\n${CHANNELS.length} canaux, ${count} messages.`);
}

async function main(): Promise<void> {
	if (values["dry-run"]) return dryRun();
	const token = process.env.SLACK_SEED_TOKEN;
	if (!token) throw new Error("SLACK_SEED_TOKEN absent : source ~/.config/friction/env");
	const slack = new Slack(token);
	const auth = await slack.call<{ team_id: string; team: string }>("auth.test");
	const manifest: SlackManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { teamId: auth.team_id, channels: {} };
	if (manifest.teamId !== auth.team_id) throw new Error(`Le manifeste concerne l'espace ${manifest.teamId}, le jeton ouvre ${auth.team_id} : rien n'est fait.`);
	const save = () => {
		mkdirSync(dirname(manifestPath), { recursive: true });
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`, { mode: 0o600 });
	};

	if (values.wipe) {
		log(`Effacement dans ${auth.team}…`);
		await wipeSlack(slack, manifest, log, save);
		log("Terminé.");
		return;
	}

	log(`Espace Slack : ${auth.team}`);
	await seedSlack(slack, manifest, log, save);
	const support = manifest.channels.support;
	const bugs = manifest.channels.bugs;
	if (support && bugs) {
		log("\nURL pour la démo (à mettre dans l'environnement) :");
		log(`export DEMO_SLACK_CHANNEL_URL="${channelUrl(manifest.teamId, bugs.id)}"`);
		log(`export DEMO_SLACK_SUPPORT_URL="${channelUrl(manifest.teamId, support.id)}"`);
	}
}

main().catch((error: Error) => {
	console.error(`✗ ${error.message}`);
	process.exit(1);
});
