import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Les canaux Slack créés par `bun run seed:slack`, sinon les variables DEMO_SLACK_*. */
export function slackUrls(): { bugs: string; support: string; newLeads: string } {
	const path = join(homedir(), ".local", "share", "friction", "slack-seed.json");
	const manifest = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { teamId: string; channels: Record<string, { id: string }> }) : undefined;
	const url = (name: string, fallback: string | undefined) => {
		const channel = manifest?.channels[name];
		return channel ? `https://app.slack.com/client/${manifest!.teamId}/${channel.id}` : fallback || "https://app.slack.com/client";
	};
	return { bugs: url("bugs", process.env.DEMO_SLACK_CHANNEL_URL), support: url("support", process.env.DEMO_SLACK_SUPPORT_URL), newLeads: url("new-leads", undefined) };
}
