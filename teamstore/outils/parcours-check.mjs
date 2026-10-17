// Vérifie le parcours guidé en le faisant jouer par Chrome : clique chaque bouton principal, affiche les chapitres,
// le jugement de la nuit et la carte finale, et les erreurs JavaScript. friction-assist doit tourner (start.sh).
// Installation (hors du dépôt) : voir teamstore/PARCOURS-REPRODUIRE.md §7. Usage : bun parcours-check.mjs
import { chromium } from "playwright-core";
const url = process.env.PARCOURS_URL ?? "http://127.0.0.1:4322/parcours";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 1300 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && !m.text().includes("401") && errors.push(m.text()));
await p.goto(url);
let last = "";
for (let i = 0; i < 60; i++) {
  await p.waitForSelector(".story .acts button, .story .next", { timeout: 60000 });
  if (await p.$(".story .next")) break;
  const t = (await p.textContent(".story h2")).trim();
  if (t !== last) { console.log("—", t); last = t; }
  const label = (await p.textContent(".story .acts button.primary")).trim();
  if (/certifie la proposition/.test(label)) console.log("   la nuit :", (await p.$$eval("#agent .stage", (x) => x.map((e) => e.innerText.replace(/\s+/g, " ")))).join(" | ").slice(0, 400));
  await p.click(".story .acts button.primary");
  await p.waitForTimeout(/boucle de nuit/.test(label) ? 15000 : 3200);
}
console.log("FIN :", (await p.textContent(".story h2")).trim());
console.log("carte :", (await p.textContent("#agent")).match(/Étape[^]*?(?=Dans Screenpipe)/)?.[0]?.replace(/\s+/g, " "));
console.log("ERREURS:", errors);
await b.close();
process.exit(errors.length ? 1 : 0);
