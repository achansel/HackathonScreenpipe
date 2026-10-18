// Traitement hors ligne de l'agent.
//
//   bun agent/offline/main.ts collecter [--depuis 2026-10-17T08:00]
//   bun agent/offline/main.ts apprendre        étiquette, génère, valide → candidat + rapport
//   bun agent/offline/main.ts rapport
//   bun agent/offline/main.ts approuver        humain : le candidat devient le détecteur du daemon
//   bun agent/offline/main.ts etiqueter [--n 40] référence humaine, une touche par épisode (~20 min)
//   bun agent/offline/main.ts installer-pipes  pipes Screenpipe de nuit (collecte → apprentissage)
//   bun agent/offline/main.ts desinstaller-pipes
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { API, KEY, PORT } from "../config";
import { APPROVED, CANDIDATE } from "./detector";
import { HUMAN_LABELS, learn, REPORT } from "./learn";
import { STATE_DIR } from "../config";
import { collect, loadEpisodes } from "./collect";
import { offlineToken } from "./token";

const cmd = process.argv[2] ?? "rapport";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const PIPES = ["friction-collect", "friction-learn"];

/** Chemin vu par Screenpipe : sous WSL, Screenpipe tourne sous Windows. */
function pipeSourceDir(): string {
  const wsl = existsSync("/proc/version") && /microsoft/i.test(readFileSync("/proc/version", "utf8"));
  if (!wsl) return new URL("./.pipes/", import.meta.url).pathname;
  const user = execFileSync("cmd.exe", ["/c", "echo %USERNAME%"], { encoding: "utf8", cwd: "/mnt/c" }).trim();
  return `/mnt/c/Users/${user}/AppData/Local/Temp/friction-assist/`;
}
const forScreenpipe = (p: string) => (p.startsWith("/mnt/") ? execFileSync("wslpath", ["-w", p], { encoding: "utf8" }).trim() : p);

async function installPipes() {
  const dir = pipeSourceDir();
  mkdirSync(dir, { recursive: true });
  for (const name of PIPES) {
    const tpl = readFileSync(new URL(`../pipes/${name}.md`, import.meta.url), "utf8");
    const file = `${dir}${name}.md`;
    writeFileSync(file, tpl.replaceAll("{{PORT}}", String(PORT)).replaceAll("{{TOKEN}}", offlineToken()));
    const r = await fetch(`${API}/pipes/install`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source: forScreenpipe(file) }),
    });
    console.log(name, "→", r.status, (await r.text()).slice(0, 200));
  }
}

switch (cmd) {
  case "collecter":
    console.log(await collect(arg("depuis") && new Date(arg("depuis")!).toISOString()));
    break;
  case "apprendre":
    console.log(JSON.stringify(await learn(), null, 2));
    break;
  case "rapport":
    console.log(existsSync(REPORT) ? readFileSync(REPORT, "utf8") : "pas encore de rapport : lancer `apprendre`");
    break;
  case "approuver": {
    if (!existsSync(CANDIDATE) || !existsSync(REPORT)) throw new Error("aucun candidat : lancer `apprendre`");
    const report = JSON.parse(readFileSync(REPORT, "utf8"));
    if (!report.better && !process.argv.includes("--forcer")) {
      console.error("Le candidat n'a pas passé la porte de validation (voir `rapport`). --forcer pour l'approuver quand même.");
      process.exit(1);
    }
    copyFileSync(CANDIDATE, APPROVED);
    console.log(`Approuvé : le daemon l'utilise dès sa prochaine boucle. Frictions conservées ${(report.candidate.frictionsKept * 100).toFixed(0)} %, travail normal écarté ${(report.candidate.normalSkipped * 100).toFixed(0)} %.`);
    break;
  }
  case "etiqueter": {
    // Référence humaine : sert à JUGER le détecteur (juger contre le modèle est circulaire).
    // L'étiquette du modèle n'est pas affichée, pour ne pas influencer.
    const KEYS: Record<string, string> = { "1": "blocage", "2": "demande_aide", "3": "recherche", "4": "tatonnement", "5": "parcours", "6": "ressaisie", "7": "contournement", "8": "attente_relance", "0": "aucun" };
    const human: Record<string, string> = existsSync(HUMAN_LABELS) ? JSON.parse(readFileSync(HUMAN_LABELS, "utf8")) : {};
    const model: Record<string, string> = existsSync(`${STATE_DIR}labels.model.json`) ? JSON.parse(readFileSync(`${STATE_DIR}labels.model.json`, "utf8")) : {};
    // --depuis HH:MM (aujourd'hui) : seulement les épisodes d'une session de scénarios
    const since = arg("depuis") ? new Date(new Date().toDateString() + " " + arg("depuis")).getTime() : 0;
    const todo = loadEpisodes().filter((e) => !human[e.id] && e.at >= since);
    const h = (id: string) => [...id].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
    const n = Number(arg("n") ?? 40);
    const frictions = todo.filter((e) => model[e.id] && model[e.id] !== "aucun").sort((a, b) => h(a.id) - h(b.id));
    const normal = todo.filter((e) => !(model[e.id] && model[e.id] !== "aucun")).sort((a, b) => h(a.id) - h(b.id));
    const pick = [...frictions.slice(0, n / 2), ...normal.slice(0, n - Math.min(frictions.length, n / 2))].sort((a, b) => h(a.id) - h(b.id));
    console.log(`${pick.length} épisodes. Touches : ${Object.entries(KEYS).map(([k, v]) => `${k}=${v}`).join("  ")}  s=passer  q=quitter\n`);
    // Session de scénarios : ordre chronologique, et le scénario en cours à côté de chaque épisode
    // (docs/scenarios-data.md + .state/scenarios.jsonl écrit par le script des clients Crisp).
    if (since) pick.sort((a, b) => a.at - b.at);
    const sheet = new Map<number, string>();
    if (existsSync("docs/scenarios-data.md"))
      for (const m of readFileSync("docs/scenarios-data.md", "utf8").matchAll(/^\| (\d+) \| (.+?) \| (.+?) \|$/gm)) sheet.set(Number(m[1]), `${m[2]} (visé : ${m[3]})`);
    const runs: { n: number; start: number; end: number }[] = existsSync(`${STATE_DIR}scenarios.jsonl`)
      ? readFileSync(`${STATE_DIR}scenarios.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    let done = 0;
    for (const e of pick) {
      console.log(`\n── ${++done}/${pick.length} · ${e.app} · ${new Date(e.at).toLocaleString("fr-FR")}`);
      const sc = runs.find((r) => e.at >= r.start - 5000 && e.at <= r.end + 5000);
      if (sc) console.log(`scénario : ${sc.n} · ${sheet.get(sc.n) ?? ""}`);
      console.log(`fenêtre  : ${e.window}`);
      console.log(`avant    : ${e.titles.slice(-3).join(" → ")}`);
      console.log(`texte    : ${e.text}`); // jusqu'à 1 500 caractères : couper empêche de juger
      const k = (prompt("étiquette >") ?? "").trim();
      if (k === "q") break;
      if (KEYS[k]) { human[e.id] = KEYS[k]; writeFileSync(HUMAN_LABELS, JSON.stringify(human, null, 2)); }
    }
    console.log(`\n${Object.keys(human).length} étiquettes humaines au total (${HUMAN_LABELS}). Il en faut au moins 20 pour juger sur la vérité humaine. Puis : apprendre.`);
    break;
  }
  case "installer-pipes":
    await installPipes();
    break;
  case "desinstaller-pipes":
    for (const name of PIPES) {
      const r = await fetch(`${API}/pipes/${name}`, { method: "DELETE", headers: { Authorization: `Bearer ${KEY}` } });
      console.log(name, "→", r.status);
    }
    break;
  default:
    console.error(`commande inconnue : ${cmd}`);
    process.exit(1);
}
