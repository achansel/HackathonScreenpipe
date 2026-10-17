import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
	screenpipeUrl: string;
	notifyUrl: string;
	/** Jeton de l'API Screenpipe. Ne jamais l'afficher ni le journaliser. */
	apiKey: string | undefined;
	/** Port de notre serveur local (redirection de [Y aller]). */
	port: number;
	dbPath: string;
	dailyCap: number;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

function positiveInt(env: Env, name: string, fallback: number): number {
	const raw = env[name];
	if (raw === undefined || raw.trim() === "") return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new ConfigError(`${name} doit être un entier positif`);
	}
	return value;
}

function trimSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/**
 * Lit la configuration depuis l'environnement (voir scripts/screenpipe-env.sh).
 * Avec `requireApiKey`, refuse de démarrer sans jeton, sans jamais en afficher la valeur.
 */
export function loadConfig(env: Env = process.env, { requireApiKey = true } = {}): Config {
	const apiKey = env.SCREENPIPE_API_KEY?.trim() || undefined;
	if (requireApiKey && !apiKey) {
		throw new ConfigError(
			"SCREENPIPE_API_KEY absent : lancer scripts/screenpipe-env.sh puis source ~/.config/screenpipe/env",
		);
	}
	return {
		screenpipeUrl: trimSlash(env.SCREENPIPE_URL || "http://127.0.0.1:3030"),
		notifyUrl: trimSlash(env.SCREENPIPE_NOTIFY_URL || "http://127.0.0.1:11435"),
		apiKey,
		port: positiveInt(env, "FRICTION_PORT", 4517),
		dbPath: env.FRICTION_DB || join(homedir(), ".local", "share", "friction", "notify.sqlite"),
		dailyCap: positiveInt(env, "FRICTION_DAILY_CAP", 8),
	};
}
