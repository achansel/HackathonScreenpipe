// Traitement hors ligne de friction-assist.
//
//   bun andrea/offline/main.ts collecter [--depuis 2026-10-17T08:00]
//   bun andrea/offline/main.ts apprendre        étiquette, génère, valide → candidat + rapport
//   bun andrea/offline/main.ts rapport
//   bun andrea/offline/main.ts approuver        humain : le candidat devient le détecteur du daemon
//   bun andrea/offline/main.ts installer-pipes  pipes Screenpipe de nuit (collecte → apprentissage)
//   bun andrea/offline/main.ts desinstaller-pipes
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { API, KEY, PORT } from "../daemon/config";
import { collect } from "./collect";
import { APPROVED, CANDIDATE } from "./detector";
import { learn, REPORT } from "./learn";
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
