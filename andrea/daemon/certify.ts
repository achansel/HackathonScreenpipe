// Certification et documentation, côté responsable d'équipe, dans les notifications Screenpipe.
// Les Live Views sont en lecture seule : une action passe par une notification. La boucle de nuit de Haytham
// (teamstore/nuit.ts) dépose des blocs « candidate » :
//   - « proposition » : une règle trouvée après une friction → [Certifier] (signée, publiée pour l'équipe) ou [Rédiger] ;
//   - « attente »     : personne n'a trouvé comment faire → [Rédiger].
// [Rédiger] ouvre la page « Mon poste » de Haytham (écrire ou corriger une règle demande un champ de saisie).
// La certification reprend son code tel quel (teamstore/demo/app.ts, validateNight).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { LABEL, PIPE_NAME, STATE_DIR } from "./config";
import { notify, relayUrl } from "./screenpipe";
import type { RpcTeamStore } from "./teamstore";

const SEEN = `${STATE_DIR}proposals-seen.json`;
export const PAGE_URL = process.env.FRICTION_PAGE_URL ?? "http://127.0.0.1:4322/moi";
const MAX_PER_POLL = 3; // pas de rafale de notifications si beaucoup de propositions attendent

type Hooks = {
  register: (nonce: string, episode: string, handler: (action: string) => Promise<void>) => void;
  record: (e: Record<string, unknown>) => void;
  log: (...a: unknown[]) => void;
};

export async function pollProposals(store: RpcTeamStore, hooks: Hooks) {
  const seen: Record<string, true> = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, "utf8")) : {};
  let sent = 0;
  for (const t of store.teams.filter((x) => x.isAdmin)) {
    for (const r of await t.pull(0, "candidate")) {
      const key = `${t.id}:${r.seq}`;
      if (seen[key] || !r.data || sent >= MAX_PER_POLL) continue;
      seen[key] = true;
      writeFileSync(SEEN, JSON.stringify(seen));
      sent++;
      const d = r.data;
      const edit = { id: "edit", label: "Rédiger", type: "link", url: PAGE_URL };
      if (d.type === "proposition") {
        const episode = `cert-${r.seq}`;
        const nonce = randomBytes(12).toString("hex");
        hooks.register(nonce, episode, async (action) => {
          if (action !== "certify") return;
          const rule = { id: d.id, step: d.step, title: d.title, body: d.body, owner: "nuit", reviewed: new Date().toISOString().slice(0, 10), uses: 0, ...(d.requestId ? { requestId: d.requestId } : {}) };
          await t.publish("solution", await t.certify(rule));
          await t.purge(r.seq).catch(() => false);
          hooks.record({ kind: "certified", solution: d.id });
          hooks.log(`règle certifiée : « ${d.title} » (aide de toute l'équipe)`);
        });
        const message = await notify({
          id: `fa-${episode}`,
          title: `${LABEL}Règle trouvée cette nuit : ${d.title}`,
          body: `${d.body ?? ""}\nÉtape : ${d.step}. Certifiée, elle devient l'aide de toute l'équipe.`,
          pipe_name: PIPE_NAME,
          priority: "normal",
          timeout: 0,
          actions: [{ id: "certify", label: "Certifier", type: "api", url: relayUrl, method: "POST", primary: true, body: { action: "certify", episode, nonce } }, edit],
        });
        hooks.log(`proposition de la nuit à certifier : « ${d.title} » (${message})`);
      } else if (d.type === "attente") {
        const message = await notify({
          id: `fa-doc-${r.seq}`,
          title: `${LABEL}Étape à documenter : ${d.step}`,
          body: "Personne n'a trouvé comment faire. Écris la règle : elle aidera toute l'équipe.",
          pipe_name: PIPE_NAME,
          priority: "normal",
          timeout: 0,
          actions: [{ ...edit, primary: true }],
        });
        hooks.log(`étape à documenter : « ${d.step} » (${message})`);
      }
    }
  }
}
