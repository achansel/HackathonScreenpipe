/**
 * Vérifie que la machine est prête : Screenpipe, le jeton, /notify, notre port.
 * `bun run check-env`           vérifications sans rien afficher à l'écran
 * `bun run check-env --notify`  envoie aussi une notification de test (révèle une pause)
 */
import { ConfigError, loadConfig, type Config } from "../config.ts";
import { sendNotification } from "../notify/client.ts";
import { PIPE_NAME } from "../notify/templates.ts";

type Check = { name: string; run: () => Promise<string> };

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
	return fetch(url, { headers, signal: AbortSignal.timeout(5_000) });
}

function checks(config: Config, withNotify: boolean): Check[] {
	const list: Check[] = [
		{
			name: "Screenpipe répond (/health)",
			run: async () => {
				const response = await get(`${config.screenpipeUrl}/health`);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return config.screenpipeUrl;
			},
		},
		{
			name: "Le jeton est accepté (/search)",
			run: async () => {
				const response = await get(`${config.screenpipeUrl}/search?limit=1`, {
					Authorization: `Bearer ${config.apiKey}`,
				});
				if (response.status === 401 || response.status === 403) {
					throw new Error(`HTTP ${response.status} : jeton refusé, relancer scripts/screenpipe-env.sh`);
				}
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return "HTTP 200";
			},
		},
		{
			name: "Le serveur de notifications répond (/notifications)",
			run: async () => {
				const response = await get(`${config.notifyUrl}/notifications`);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const history = (await response.json()) as unknown[];
				return `${config.notifyUrl}, ${history.length} dans la cloche`;
			},
		},
		{
			name: `Le port ${config.port} est libre`,
			run: async () => {
				try {
					const server = Bun.serve({ hostname: "127.0.0.1", port: config.port, fetch: () => new Response("ok") });
					server.stop(true);
				} catch {
					throw new Error("déjà utilisé : changer FRICTION_PORT");
				}
				return "127.0.0.1";
			},
		},
	];
	if (withNotify) {
		list.push({
			name: "Une notification de test s'affiche",
			run: async () => {
				const outcome = await sendNotification(
					{
						id: `check-env-${Date.now()}`,
						title: "Friction assist : test",
						body: `Vérification de l'environnement · ${new Date().toLocaleTimeString("fr-FR")}`,
						pipe_name: PIPE_NAME,
						priority: "low",
						timeout: 8_000,
						actions: [],
					},
					{ notifyUrl: config.notifyUrl },
				);
				if (outcome !== "shown") {
					const hints: Record<string, string> = {
						paused: "notifications en pause, en heures silencieuses ou coupées dans Screenpipe",
						pipe_disabled: "notifications de pipes coupées dans les réglages de Screenpipe",
						muted: `le pipe ${PIPE_NAME} est rendu muet dans les réglages`,
					};
					throw new Error(`${outcome}${hints[outcome] ? ` : ${hints[outcome]}` : ""}`);
				}
				return "affichée";
			},
		});
	}
	return list;
}

async function main(): Promise<number> {
	let config: Config;
	try {
		config = loadConfig();
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(`✗ Configuration : ${error.message}`);
			return 1;
		}
		throw error;
	}
	console.log("✓ Configuration : SCREENPIPE_API_KEY présent");

	let failures = 0;
	for (const check of checks(config, process.argv.includes("--notify"))) {
		try {
			console.log(`✓ ${check.name} : ${await check.run()}`);
		} catch (error) {
			failures += 1;
			console.error(`✗ ${check.name} : ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	console.log(failures === 0 ? "\nPrêt." : `\n${failures} problème(s).`);
	return failures === 0 ? 0 : 1;
}

process.exit(await main());
