// Configuration du daemon friction-assist, lue dans l'environnement
// (source ~/.config/screenpipe/env). Le jeton n'est jamais journalisé.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

export const API = process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
export const NOTIFY = process.env.SCREENPIPE_NOTIFY_URL ?? "http://127.0.0.1:11435";
export const KEY = process.env.SCREENPIPE_API_KEY ?? "";
export const PORT = Number(process.env.FRICTION_PORT ?? 8787);

// Plusieurs daemons sur une machine (simulation d'une équipe) : chacun son état, son port, son relais.
// "" = le daemon du poste. Mode simulation : aucun écran lu, épisodes injectés via /sim/episode.
export const INSTANCE = process.env.FRICTION_INSTANCE ?? "";
export const SIM = process.env.FRICTION_SIM === "1";
// Solutions de démo au démarrage : par défaut sur le poste, pas sur une instance simulée.
// FRICTION_SEED=0/1 force ; FRICTION_SEED_IDS=id1,id2 n'en charge qu'une partie (scénario de démo).
export const SEED = process.env.FRICTION_SEED !== undefined ? process.env.FRICTION_SEED === "1" : !INSTANCE;
export const SEED_IDS = (process.env.FRICTION_SEED_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
export const LABEL = INSTANCE ? `[${INSTANCE}] ` : ""; // préfixe des notifications en simulation

// Stockage d'équipe (temporaire) : URL de la base et clé d'équipe, hors du dépôt.
export const DATABASE_URL = process.env.FRICTION_DATABASE_URL ?? "";
export const TEAM_DIR = `${homedir()}/.config/friction-assist/`;
export const TEAM_KEY_FILE = `${TEAM_DIR}team.key`;
export const TEAM_POLL_MS = 5000;
export const REQUEST_COOLDOWN_MS = 30 * 60_000; // une même étape ne redemande pas d'aide avant 30 min
// Anonymat : délai aléatoire avant de publier une demande, pour que l'heure ne désigne pas qui bloque
// (petite équipe). En secondes, « min-max » ; 0 en simulation pour garder la démo rapide.
const [jMin, jMax] = (process.env.FRICTION_REQUEST_JITTER ?? (process.env.FRICTION_SIM === "1" ? "0-0" : "30-180")).split("-").map(Number);
export const REQUEST_JITTER_MS = { min: (jMin || 0) * 1000, max: (jMax || jMin || 0) * 1000 };
export const MAX_SHARE_PROMPTS_PER_DAY = Number(process.env.FRICTION_MAX_SHARE_PROMPTS ?? 5); // contre la fatigue de celui qui sait
export const MODEL = process.env.FRICTION_MODEL ?? "claude-haiku-4-5";

export const PIPE_NAME = "friction-assist"; // donne les 👍/👎 natifs de Screenpipe
// Instance dédiée de la connexion n8n : relaie les clics des boutons `api` vers ce daemon
// sans toucher à une connexion n8n que l'utilisateur aurait déjà.
export const RELAY = { connection: "n8n", instance: INSTANCE ? `friction-assist-${INSTANCE}` : "friction-assist" };

export const POLL_MS = 1000; // boucle de lecture
export const DEBOUNCE_MS = 2000; // texte d'une fenêtre stable depuis 2 s → épisode prêt
export const LOOKBACK_MS = 3 * 60_000; // l'IA ne lit que les 3 dernières minutes
export const SOLUTION_COOLDOWN_MS = 10 * 60_000; // pas deux fois la même aide en 10 min
export const MIN_CONFIDENCE = 0.6;
// Filtre en direct : un épisode est écarté sans appel au modèle si le détecteur approuvé dit
// « pas de friction » avec au moins cette confiance. Même seuil pour la validation hors ligne.
export const SKIP_CONFIDENCE = 0.5;
export const MIN_FRICTIONS_KEPT = 0.9; // porte de validation : ≥ 90 % des frictions doivent passer le filtre

// Fenêtres jamais lues, en plus des exclusions configurées dans Screenpipe :
// aperçus alt-tab (titres d'autres fenêtres) et l'interface de Screenpipe elle-même.
export const IGNORE = new RegExp(process.env.FRICTION_IGNORE ?? "task switching|screenpipe", "i");

// Périmètre : seules les fenêtres des outils de travail de l'équipe sont lues (appli, titre ou URL).
// Réglage de vie privée, pas de classement : à aligner sur l'outillage réel de l'équipe.
export const SCOPE = new RegExp(process.env.FRICTION_SCOPE ?? "slack|crisp|hubspot|notion", "i");
// Le titre de fenêtre peut être celui d'une AUTRE appli (attribution erronée mesurée : frames de
// claude.exe ou explorer.exe titrées « … - Slack »). Le périmètre se juge donc sur l'appli ;
// le titre et l'URL ne comptent que pour les navigateurs, où l'outil vit dans un onglet.
export const BROWSERS = /chrome|firefox|msedge|edge|safari|arc|brave|opera/i;
export const MAX_LABELS_PER_RUN = 150;
// Repli du traitement de nuit si les pipes Screenpipe n'ont pas tourné (agent Pi en panne, mesuré) : à cette heure locale.
export const NIGHTLY_HOUR = 3; // étiquetage hors ligne borné (quota du modèle)

export const STATE_DIR = new URL(`./.state/${INSTANCE ? `${INSTANCE}/` : ""}`, import.meta.url).pathname;
mkdirSync(STATE_DIR, { recursive: true });
