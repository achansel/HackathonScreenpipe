// Circuit d'équipe (étape 2) :
//   Léa bloque, sans solution locale  → demande ANONYME (étape + type ; ni texte d'écran, ni identité)
//   le daemon de Karim la reçoit      → s'il a une solution qui y répond, Karim reçoit « Partager ? »
//   Karim clique « Partager »         → la solution (chiffrée) arrive chez Léa et dans le cache de toute l'équipe
// Karim ne sait pas qui a demandé ; Léa ne sait pas qui a répondu, sauf le rôle `owner` de la solution.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { LABEL, MAX_SHARE_PROMPTS_PER_DAY, PIPE_NAME, REQUEST_COOLDOWN_MS, REQUEST_JITTER_MS, REQUEST_TTL_MS, STATE_DIR } from "./config";
import { matchStep, type Verdict } from "./qualify";
import { notify, relayUrl } from "./screenpipe";
import { saveSolutions, type Solution } from "./solutions";
import type { TeamStore } from "./teamstore";

type Hooks = {
  register: (nonce: string, episode: string, handler: (action: string) => Promise<void>) => void;
  helpNotification: (episode: string, s: Solution) => object;
  record: (e: Record<string, unknown>) => void;
  log: (...a: unknown[]) => void;
};

// Curseurs et ids de MES demandes en cours (aléatoires, sans contenu d'écran).
const STATE = `${STATE_DIR}team-state.json`;
type State = { request: number; solution: number; mine: Record<string, { step: string; at: number }>; prompts?: { day: string; n: number } };

export class TeamSync {
  private st: State;
  private askedAt = new Map<string, number>();

  constructor(private store: TeamStore, private solutions: Solution[], private hooks: Hooks) {
    this.st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { request: 0, solution: 0, mine: {} };
  }

  private save() {
    writeFileSync(STATE, JSON.stringify(this.st));
  }

  /** Friction sans solution locale → demande anonyme. Une même étape ne redemande pas avant 30 min. */
  async ask(v: Verdict): Promise<string | null> {
    const key = v.step.toLowerCase();
    if (Date.now() - (this.askedAt.get(key) ?? 0) < REQUEST_COOLDOWN_MS) return null;
    this.askedAt.set(key, Date.now());
    const requestId = randomBytes(8).toString("hex");
    this.st.mine[requestId] = { step: v.step, at: Date.now() };
    this.save();
    // Délai aléatoire avant publication : l'heure de la demande ne désigne pas la personne.
    const delay = REQUEST_JITTER_MS.min + Math.random() * (REQUEST_JITTER_MS.max - REQUEST_JITTER_MS.min);
    setTimeout(() => {
      this.store.put("request", { requestId, step: v.step, type: v.type, control: v.control, detour: v.detour })
        .catch((e) => this.hooks.log("demande non publiée :", (e as Error).message));
    }, delay);
    return requestId;
  }

  /** Signature anonyme pour la carte d'équipe (étape 4) : étape + type, au jour près. */
  async sign(v: Verdict) {
    await this.store.put("signature", { step: v.step, type: v.type, control: v.control, detour: v.detour, day: new Date().toISOString().slice(0, 10) });
  }

  async poll() {
    // 1. Demandes des collègues : est-ce qu'une de MES solutions y répond ?
    for (const r of await this.store.list("request", this.st.request)) {
      this.st.request = r.id;
      const req = r.payload;
      if (!req?.requestId || this.st.mine[req.requestId]) continue; // illisible, ou ma propre demande
      if (Date.now() - Date.parse(r.at) > REQUEST_TTL_MS) continue; // périmée : le collègue est passé à autre chose
      const mine = this.solutions.filter((s) => !s.shared);
      const today = new Date().toISOString().slice(0, 10);
      if (this.st.prompts?.day !== today) this.st.prompts = { day: today, n: 0 };
      if (this.st.prompts.n >= MAX_SHARE_PROMPTS_PER_DAY) continue; // plafond quotidien : pas de sollicitation de plus
      const solutionId = await matchStep(req.step, mine);
      if (!solutionId) continue;
      this.st.prompts.n++;
      const s = mine.find((x) => x.id === solutionId)!;
      const episode = `share-${req.requestId}`;
      const handler = async (action: string) => {
        if (action !== "share") return this.hooks.record({ kind: "share-declined", solution: s.id });
        const { score, shared, ...publishable } = s;
        await this.store.put("solution", { ...publishable, requestId: req.requestId, sharedAt: new Date().toISOString() });
        this.hooks.record({ kind: "shared", solution: s.id });
        this.hooks.log(`solution « ${s.title} » partagée`);
      };
      const share = randomBytes(12).toString("hex");
      const skip = randomBytes(12).toString("hex");
      this.hooks.register(share, episode, handler);
      this.hooks.register(skip, episode, handler);
      const message = await notify({
        id: `fa-${episode}`,
        title: `${LABEL}Un collègue bloque : ${req.step}`,
        body: `Ta solution « ${s.title} » peut l'aider. Personne ne saura qui a demandé.`,
        pipe_name: PIPE_NAME,
        priority: "normal",
        timeout: 0,
        actions: [
          { id: "share", label: "Partager", type: "api", url: relayUrl, method: "POST", primary: true, body: { action: "share", episode, nonce: share } },
          { id: "skip", label: "Pas maintenant", type: "api", url: relayUrl, method: "POST", body: { action: "skip", episode, nonce: skip } },
        ],
      });
      this.hooks.record({ kind: "share-asked", solution: s.id, message });
      this.hooks.log(`un collègue bloque sur « ${req.step} » : ma solution ${s.id} proposée au partage (${message})`);
    }

    // 2. Solutions partagées : dans le cache ; si elle répond à MA demande, aide immédiate.
    for (const r of await this.store.list("solution", this.st.solution)) {
      this.st.solution = r.id;
      const sol = r.payload as (Solution & { requestId?: string; sharedAt?: string }) | null;
      if (!sol?.id || (sol as any).synthetic) continue; // données de démo : pour la carte seulement, jamais proposées comme aide
      const { requestId, sharedAt, ...solution } = sol;
      const existing = this.solutions.find((x) => x.id === solution.id);
      if (existing) existing.uses = Math.max(existing.uses, solution.uses);
      else this.solutions.push({ ...solution, shared: true });
      saveSolutions(this.solutions);
      if (requestId && this.st.mine[requestId]) {
        delete this.st.mine[requestId];
        const s = this.solutions.find((x) => x.id === solution.id)!;
        const episode = `team-${requestId}`;
        const message = await notify(this.hooks.helpNotification(episode, s));
        this.hooks.record({ kind: "solved", requestId }); // un collègue a confirmé la friction en partageant
        this.hooks.record({ kind: "shown", episode, solution: s.id, from: "team", message });
        this.hooks.log(`un collègue a partagé une solution à ma demande : « ${s.title} » (${message})`);
      }
    }
    this.save();
  }
}
