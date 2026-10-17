// Client minimal de l'API locale de Screenpipe.
import { API, KEY, MODEL, NOTIFY, RELAY } from "./config";

const auth = { Authorization: `Bearer ${KEY}` };
export type Item = Record<string, any>;

export async function search(params: Record<string, string>, max = 1000): Promise<Item[]> {
  const out: Item[] = [];
  for (let offset = 0; offset < max; offset += 200) {
    const q = new URLSearchParams({ limit: "200", offset: String(offset), order: "ascending", ...params });
    const r = await fetch(`${API}/search?${q}`, { headers: auth });
    if (!r.ok) throw new Error(`/search HTTP ${r.status}`);
    const page = ((await r.json()).data ?? []) as { content: Item }[];
    if (!page.length) break; // une page courte n'est pas la fin : /search déduplique (mesuré)
    out.push(...page.map((p) => p.content));
  }
  return out;
}

/** Renvoie le `message` de /notify : « sent successfully », « paused », « duplicate … ». */
export async function notify(payload: Item): Promise<string> {
  const r = await fetch(`${NOTIFY}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return String(j.message ?? `HTTP ${r.status}`);
}

export async function feedbackSince(since: string): Promise<Item[]> {
  const q = new URLSearchParams({ kind: "notification", since, order: "asc", limit: "100" });
  const r = await fetch(`${API}/feedback?${q}`, { headers: auth });
  if (!r.ok) throw new Error(`/feedback HTTP ${r.status}`);
  return ((await r.json()).data ?? []) as Item[];
}

/** Modèle choisi via Screenpipe. Une réponse vide (tokens épuisés à raisonner) est réessayée. */
export async function chat(system: string, user: string, maxTokens = 400): Promise<string> {
  let max = maxTokens;
  for (let attempt = 0; attempt < 3; attempt++, max *= 2) {
    const r = await fetch(`${API}/v1/chat/completions`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0, max_tokens: max, reasoning_effort: "low", stream: false,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!r.ok) throw new Error(`/v1/chat/completions HTTP ${r.status}`);
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
