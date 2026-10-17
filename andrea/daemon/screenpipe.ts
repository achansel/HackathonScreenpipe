// Client minimal de l'API locale de Screenpipe.
import { API, KEY, LOOKBACK_MS, MODEL, NOTIFY, RELAY } from "./config";

const auth = { Authorization: `Bearer ${KEY}` };
export type Item = Record<string, any>;

/** Screenpipe fermé (409 "search_only", mesuré) ou injoignable (processus absent). */
export class ScreenpipeClosed extends Error {}

/** fetch qui transforme « connexion refusée » en ScreenpipeClosed : le daemon se met en veille. */
async function sp(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ScreenpipeClosed("Screenpipe injoignable : est-il lancé ?");
  }
}
async function fail(route: string, r: Response): Promise<never> {
  const body = await r.text().catch(() => "");
  if (r.status === 409 && body.includes("search_only")) throw new ScreenpipeClosed("Screenpipe est fermé : rouvrir l'app");
  throw new Error(`${route} HTTP ${r.status}`);
}

export async function search(params: Record<string, string>, max = 1000): Promise<Item[]> {
  const out: Item[] = [];
  for (let offset = 0; offset < max; offset += 200) {
    const q = new URLSearchParams({ limit: "200", offset: String(offset), order: "ascending", ...params });
    const r = await sp(`${API}/search?${q}`, { headers: auth });
    if (!r.ok) await fail("/search", r);
    const page = ((await r.json()).data ?? []) as { content: Item }[];
    if (!page.length) break; // une page courte n'est pas la fin : /search déduplique (mesuré)
    out.push(...page.map((p) => p.content));
  }
  return out;
}

// Nos notifications s'affichent par-dessus la fenêtre lue : l'OCR les capture (mesuré : texte de
// « Geste commercial » relu dans une frame de Crisp, puis qualifié en friction). On garde leurs mots
// pendant LOOKBACK_MS pour les retirer des épisodes.
const norm = (w: string) => w.normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();
const shown: { at: number; words: Set<string> }[] = [];

/** Retire d'un texte les mots d'une de nos notifications récentes qui y apparaît (≥ 40 % de ses mots).
 *  `echo` : le texte était surtout notre notification (≥ 50 % des mots retirés) → épisode à ignorer. */
export function withoutOwnNotifications(text: string, now = Date.now()): { text: string; echo: boolean } {
  while (shown.length && now - shown[0].at > LOOKBACK_MS) shown.shift();
  let words = text.split(/\s+/).filter(Boolean);
  const total = words.length;
  for (const n of shown) {
    const present = new Set(words.map(norm).filter((w) => n.words.has(w)));
    if (present.size >= 0.4 * n.words.size) words = words.filter((w) => !n.words.has(norm(w)));
  }
  return { text: words.join(" "), echo: total > 0 && total - words.length >= 0.5 * total };
}

/** Renvoie le `message` de /notify : « sent successfully », « paused », « duplicate … ». */
export async function notify(payload: Item): Promise<string> {
  const visible = [payload.title, payload.body, ...((payload.actions ?? []) as Item[]).map((a) => a.label)].join(" ");
  shown.push({ at: Date.now(), words: new Set(visible.split(/\s+/).map(norm).filter((w) => w.length >= 3)) });
  const r = await sp(`${NOTIFY}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return String(j.message ?? `HTTP ${r.status}`);
}

export async function feedbackSince(since: string): Promise<Item[]> {
  const q = new URLSearchParams({ kind: "notification", since, order: "asc", limit: "100" });
  const r = await sp(`${API}/feedback?${q}`, { headers: auth });
  if (!r.ok) await fail("/feedback", r);
  return ((await r.json()).data ?? []) as Item[];
}

/** Modèle choisi via Screenpipe. Une réponse vide (tokens épuisés à raisonner) est réessayée. */
export async function chat(system: string, user: string, maxTokens = 400): Promise<string> {
  let max = maxTokens;
  for (let attempt = 0; attempt < 3; attempt++, max *= 2) {
    const r = await sp(`${API}/v1/chat/completions`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0, max_tokens: max, reasoning_effort: "low", stream: false,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!r.ok) await fail("/v1/chat/completions", r);
    const out = (await r.json()).choices?.[0]?.message?.content ?? "";
    if (out.trim()) return out;
  }
  throw new Error("réponse vide du modèle après 3 essais");
}

export const relayUrl = `${API}/connections/${RELAY.connection}/proxy?instance=${encodeURIComponent(RELAY.instance)}`;

export async function setupRelay(port: number): Promise<void> {
  const r = await fetch(`${API}/connections/${RELAY.connection}/instances/${RELAY.instance}`, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ credentials: { webhook_url: `http://127.0.0.1:${port}/hook` } }),
  });
  if (!r.ok) throw new Error(`création de l'instance de relais : HTTP ${r.status} ${await r.text()}`);
}

export async function removeRelay(): Promise<void> {
  await fetch(`${API}/connections/${RELAY.connection}/instances/${RELAY.instance}`, { method: "DELETE", headers: auth });
}
