// Suit en direct les événements d'entrée de Screenpipe (changements d'appli/fenêtre) avec un
// curseur de temps, et signale l'apparition ou la hausse d'un compteur de notification dans le
// titre d'une fenêtre : "(3) …", "[2] …", "💬1 - …", "Boîte de réception (2 526)".
// Agnostique : aucune règle propre à une appli. C'est un déclencheur, pas un verdict : c'est la
// qualification (modèle d'IA) qui dira si l'épisode est une friction.
//
// Usage : source ~/.config/screenpipe/env && bun andrea/scripts/poll-input.ts [--secondes 300] [--tout] [--continu]
const KEY = process.env.SCREENPIPE_API_KEY;
const URL_ = process.env.SCREENPIPE_URL ?? "http://127.0.0.1:3030";
if (!KEY) {
  console.error("SCREENPIPE_API_KEY manquant : source ~/.config/screenpipe/env");
  process.exit(1);
}

const args = process.argv.slice(2);
const dureeMs = Number(args[args.indexOf("--secondes") + 1] || 300) * 1000;
const tout = args.includes("--tout"); // inclut aussi les clics et défilements
const continu = args.includes("--continu"); // ne s'arrête pas au premier signe
const headers = { Authorization: `Bearer ${KEY}` };

type Item = { type: string; content: Record<string, any> };

async function search(contentType: string, since: number): Promise<Item[]> {
  const q = new URLSearchParams({
    content_type: contentType,
    order: "ascending",
    limit: "100",
    start_time: new Date(since).toISOString(),
  });
  const r = await fetch(`${URL_}/search?${q}`, { headers });
  if (!r.ok) throw new Error(`/search ${contentType}: HTTP ${r.status}`);
  return ((await r.json()).data ?? []) as Item[];
}

const hms = (t: number | string) => {
  const d = new Date(t);
  return `${d.toLocaleTimeString("fr-FR")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};

// Compteur de notification dans un titre : un entier entre parenthèses ou crochets, ou collé à
// un pictogramme. Les années (1990-2100) sont ignorées. `base` = titre sans le compteur.
const PATTERNS = [/[(\[]\s*(\d[\d\s., ]{0,8})\s*[)\]]/u, /\p{Extended_Pictographic}️?\s*(\d{1,4})\b/u];
function badge(title: string): { n: number; base: string } | null {
  for (const re of PATTERNS) {
    const m = re.exec(title);
    if (!m) continue;
    const n = Number(m[1].replace(/[\s., ]/g, ""));
    if (!Number.isFinite(n) || n < 1 || (n >= 1990 && n <= 2100)) continue;
    const base = title.replace(m[0], "").replace(/^[\s\-–—|:•·]+/, "").replace(/\s+/g, " ").trim();
    return { n, base };
  }
  return null;
}
const cle = (app: string, base: string) => `${app}|${base}`;

const debut = Date.now();
let curseurInput = debut - 1000;
let curseurFrames = debut - 1000;
const vus = new Set<string>();
const compteurs = new Map<string, number>(); // dernier compteur connu par (appli, titre sans compteur)

// État initial : les compteurs déjà présents ne comptent pas comme un déclenchement.
for (const it of await search("accessibility", debut - 60_000)) {
  const b = badge(it.content.window_name ?? "");
  if (b) compteurs.set(cle(it.content.app_name ?? "", b.base), Math.max(b.n, compteurs.get(cle(it.content.app_name ?? "", b.base)) ?? 0));
}
console.log(`poll-input démarré à ${hms(debut)} (${compteurs.size} compteur(s) déjà présent(s), ignorés)`);

while (Date.now() - debut < dureeMs) {
  try {
    for (const it of await search("input", curseurInput)) {
      const c = it.content;
      const id = `i${c.id}`;
      if (vus.has(id)) continue;
      vus.add(id);
      curseurInput = Math.max(curseurInput, new Date(c.timestamp).getTime());
      if (!tout && !["app_switch", "window_focus"].includes(c.event_type)) continue;
      const retard = ((Date.now() - new Date(c.timestamp).getTime()) / 1000).toFixed(1);
      console.log(`${hms(c.timestamp)} input ${String(c.event_type).padEnd(12)} ${c.app_name ?? "-"} | ${(c.window_title ?? "").slice(0, 40)} | retard ${retard}s`);
    }

    for (const it of await search("accessibility", curseurFrames)) {
      const c = it.content;
      const id = `f${c.id ?? c.frame_id ?? c.timestamp}${c.event_source}`;
      if (vus.has(id)) continue;
      vus.add(id);
      curseurFrames = Math.max(curseurFrames, new Date(c.timestamp).getTime());
      const titre = c.window_name ?? "";
      const b = badge(titre);
      if (!b) continue;
      const k = cle(c.app_name ?? "", b.base);
      const avant = compteurs.get(k) ?? 0;
      if (b.n > avant) {
        compteurs.set(k, b.n);
        const retard = ((Date.now() - new Date(c.timestamp).getTime()) / 1000).toFixed(1);
        console.log(`\n>>> SIGNE : compteur ${avant} → ${b.n} | frame ${hms(c.timestamp)} | lu à ${hms(Date.now())} | retard ${retard}s | ${c.app_name} | ${titre.slice(0, 50)}\n`);
        if (!continu) process.exit(0);
      } else if (b.n < avant) {
        compteurs.set(k, b.n); // le compteur a baissé (lu) : on repart de cette valeur
      }
    }
  } catch (e) {
    console.error("erreur :", (e as Error).message);
  }
  await Bun.sleep(1000);
}
console.log(`fin sans signe à ${hms(Date.now())}`);
