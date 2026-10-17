// Configuration du daemon friction-assist, lue dans l'environnement
// (source ~/.config/screenpipe/env). Le jeton n'est jamais journalisé.
import { mkdirSync } from "node:fs";

export const API = process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
export const NOTIFY = process.env.SCREENPIPE_NOTIFY_URL ?? "http://127.0.0.1:11435";
export const KEY = process.env.SCREENPIPE_API_KEY ?? "";
export const PORT = Number(process.env.FRICTION_PORT ?? 8787);
export const MODEL = process.env.FRICTION_MODEL ?? "claude-haiku-4-5";

export const PIPE_NAME = "friction-assist"; // donne les 👍/👎 natifs de Screenpipe
// Instance dédiée de la connexion n8n : relaie les clics des boutons `api` vers ce daemon
// sans toucher à une connexion n8n que l'utilisateur aurait déjà.
export const RELAY = { connection: "n8n", instance: "friction-assist" };

export const POLL_MS = 1000; // boucle de lecture
export const DEBOUNCE_MS = 2000; // texte d'une fenêtre stable depuis 2 s → épisode prêt
export const LOOKBACK_MS = 3 * 60_000; // l'IA ne lit que les 3 dernières minutes
export const SOLUTION_COOLDOWN_MS = 10 * 60_000; // pas deux fois la même aide en 10 min
export const MIN_CONFIDENCE = 0.6;

// Fenêtres jamais lues, en plus des exclusions configurées dans Screenpipe :
// aperçus alt-tab (titres d'autres fenêtres) et l'interface de Screenpipe elle-même.
export const IGNORE = new RegExp(process.env.FRICTION_IGNORE ?? "task switching|screenpipe", "i");

export const STATE_DIR = new URL("./.state/", import.meta.url).pathname;
mkdirSync(STATE_DIR, { recursive: true });
