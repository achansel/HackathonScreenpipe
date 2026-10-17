// Deux modes : « démo » (/) = quatre machines simulées dans une page ; « mon poste » (/moi) = une seule
// personne, qui travaille avec ses vrais collègues (chacun sur sa machine, même stockage).
// Démo « équipes chiffrées » : quatre machines simulées dans une page. Chacune a ses propres clés
// (localStorage séparé) et ne communique avec les autres QUE par le stockage (blobs chiffrés), sauf
// les liens d'invitation, transmis « en privé » (ici : une boîte de réception qui simule un DM Slack).
import { AccessDenied, apiKeyHeaders, membershipFromInvite, routeTeams, SupabaseStore, Team, type Membership, type Received } from "../client";
import { b64u, deriveTeamKeys, open, randomId } from "../crypto";

type Sol = { id: string; step: string; title: string; body: string; owner?: string; uses?: number; copy?: string; requestId?: string; certified?: boolean; cert?: string; team?: string; shared?: boolean; type?: string; control?: string; detour?: string; reviewed?: string };
type Req = { requestId: string; step: string; type?: string; team: string; seq: number };
type Friction = { label: string; step: string; type: string; control: string; detour: string };
interface State {
  memberships: Membership[];
  cursors: Record<string, number>;
  solutions: Sol[];
  mine: Record<string, string>;            // mes demandes en cours : requestId → étape
  requests: Req[];                          // demandes des collègues reçues
  inbox: { from: string; team: string; link: string }[];
  invited: Record<string, string[]>;        // responsable : à qui j'ai envoyé le lien (teamId → ids)
  status: Record<string, string>;           // teamId → "ok" | "révoqué"
  lastInvite?: { team: string; link: string; why: string }; // mode « mon poste » : lien à copier
  profile?: string;                         // mode « mon poste » : profil PipingTable joué
  log: string[];
}

const cfg = await (await fetch("/api/config")).json();
const store = new SupabaseStore(cfg.url, cfg.anonKey, cfg.restPath);
const seed: Sol[] = await (await fetch("/api/seed")).json();
const H = { "Content-Type": "application/json", "X-FA-Demo": "1" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
const step = (id: string) => seed.find((s) => s.id === id)!.step;

// La journée de Léa chez PipingTable (UseCase.md, minguk/build/pipingtable.md). Le libellé donne le contexte
// sur le poste ; seule l'étape, sans nom de client, part dans la demande.
const fr = (label: string, id: string, type = "unclear", control = "direct", detour = "demande_aide"): Friction => ({ label, step: step(id), type, control, detour });
const FRICTIONS: Friction[] = [
  fr("9 h 05 · Jean Dupont (Le Bistro) introuvable dans HubSpot", "client-introuvable", "unclear", "direct", "recherche"),
  fr("9 h 20 · Quelle offre a Le Bistro ?", "offre-du-client", "unclear", "direct", "parcours"),
  fr("9 h 40 · Bug signalé par Jean Dupont", "signaler-bug", "handoff", "influence", "demande_aide"),
  fr("11 h · Jean Dupont veut un dédommagement", "geste-commercial", "unclear", "required", "demande_aide"),
  fr("14 h · « Thomas m'a promis l'installation » (Maison Pivoine)", "promesse-commercial", "unclear", "influence", "recherche"),
  fr("Osteria Nonna : remise de 20 % à valider", "remise-15", "waiting", "required", "blocage"),
  fr("15 h 30 · Prospect belge sur le chat (Pieter Janssens)", "prospect-chat", "handoff", "influence", "demande_aide"),
];
const F = Object.fromEntries(["introuvable", "offre", "bug", "geste", "promesse", "remise", "prospect"].map((k, i) => [k, FRICTIONS[i]]));
// Périmètres : utiles seulement pour qui est dans PLUSIEURS équipes (une demande part à la bonne équipe).
const SCOPES: Record<string, string> = { Support: "crisp|bug|ticket|offre|dédommag|client", Ventes: "remise|prospect|promesse|devis|deal|commercial" };

// Les profils Slack de PipingTable (minguk/src/seed/slack-story.ts) : chacun connaît les règles qu'il donne dans Slack.
type Profile = { label: string; role: string; avatar: string; knows: string[]; creates?: string; scopes?: Record<string, string> };
const PROFILES: Record<string, Profile> = {
  lea: { label: "Léa", role: "Support, 2 semaines de poste", avatar: "🙋‍♀️", knows: [] },
  claire: { label: "Claire Morin", role: "Responsable support", avatar: "👩‍💼", knows: ["geste-commercial"], creates: "Support" },
  karim: { label: "Karim Bensaïd", role: "Support, 3 ans de maison", avatar: "👨‍💻", knows: ["client-introuvable", "offre-du-client", "signaler-bug", "promesse-commercial", "pipeline-support"] },
  antoine: { label: "Antoine Rey", role: "COO : responsable Ventes, membre du Support", avatar: "📈", knows: ["remise-15"], creates: "Ventes", scopes: SCOPES },
  sarah: { label: "Sarah Lambert", role: "Ventes Belgique", avatar: "🇧🇪", knows: ["prospect-chat"] },
};
const rulesOf = (p?: Profile) => structuredClone(seed.filter((s) => p?.knows.includes(s.id)));

const SOLO = document.body.dataset.mode === "moi";
const SCOPE_CHOICES: [string, string][] = [["Tout (je ne suis que dans cette équipe)", ""], ["Support : Crisp, bugs, offres, dédommagements", SCOPES.Support], ["Ventes : remises, prospects, promesses", SCOPES.Ventes]];
const scopeSelect = (k: string, preset = "") => `<select data-k="${k}">${SCOPE_CHOICES.map(([l, v]) => `<option value="${esc(v)}"${v === preset ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const today = () => new Date().toISOString().slice(0, 10);
const notifyOn = () => (document.getElementById("notify") as HTMLInputElement).checked;
const machines: Machine[] = [];
const byId = (id: string) => machines.find((m) => m.id === id)!;

class Machine {
  teams: Team[] = [];
  st: State;
  toast = "";
  toastAt = 0;
  private html = "";
  constructor(public id: string, public label: string, public role: string, private initial: Sol[], public p?: Profile) {
    this.st = this.load();
    if (SOLO) this.applyProfile();
  }
  applyProfile() {
    const p = PROFILES[this.st.profile ?? ""];
    this.p = p;
    this.label = p?.label ?? "Mon poste";
    this.role = p?.role ?? "mes clés restent dans ce navigateur";
  }
  private fresh(): State {
    return { memberships: [], cursors: {}, solutions: structuredClone(this.initial), mine: {}, requests: [], inbox: [], invited: {}, status: {}, log: [] };
  }
  load(): State { try { return { ...this.fresh(), ...JSON.parse(localStorage.getItem(`fa-demo:${this.id}`) ?? "{}") }; } catch { return this.fresh(); } }
  save() { this.st.memberships = this.teams.map((t) => t.m); localStorage.setItem(`fa-demo:${this.id}`, JSON.stringify(this.st)); }
  reset() { localStorage.removeItem(`fa-demo:${this.id}`); this.st = this.fresh(); this.teams = []; this.toast = ""; this.html = ""; if (SOLO) this.applyProfile(); }
  async init() { this.teams = await Promise.all(this.st.memberships.map((m) => Team.open(store, m))); }
  log(s: string) { this.st.log.unshift(`${new Date().toLocaleTimeString("fr-FR")} ${s}`); this.st.log.length = Math.min(this.st.log.length, 6); }
  team(name: string) { return this.teams.find((t) => t.name === name); }

  // Notification : toujours dans le panneau, et dans Screenpipe si la case est cochée.
  async notify(title: string, body: string) {
    this.toast = `<b>${esc(title)}</b><br>${md(body)}`;
    this.toastAt = Date.now();
    if (!notifyOn()) return;
    const r = await fetch("/api/notify", { method: "POST", headers: H, body: JSON.stringify({
      id: `fa-demo-${this.id}-${randomId(4)}`, title: SOLO ? title : `[${this.label}] ${title}`, body, priority: "normal", timeout: 20000,
      actions: [{ id: "open", label: SOLO ? "Ouvrir" : "Voir dans la démo", type: "link", url: SOLO ? `${location.origin}/moi` : `${location.origin}/#${this.id}`, primary: true }],
    }) }).then((x) => x.json()).catch(() => ({ message: "Screenpipe injoignable" }));
    this.log(`notification Screenpipe : ${r.message}`);
  }

  // ---- responsable
  async createTeam(name: string, scope: string | undefined = this.p?.scopes?.[name]) {
    const t = await Team.create(store, name, scope || undefined);
    this.teams.push(t);
    this.st.status[t.id] = "ok";
    this.st.invited[t.id] = [this.id];
    this.log(`équipe « ${name} » créée (responsable)`);
    if (SOLO) this.st.lastInvite = { team: name, link: t.invite(), why: "à envoyer en privé à chaque membre (DM Slack)" };
  }
  invite(teamName: string, to: Machine) {
    const t = this.team(teamName)!;
    to.st.inbox.unshift({ from: this.label, team: teamName, link: t.invite() });
    to.log(`lien reçu de ${this.label} pour « ${teamName} » (DM privé)`);
    to.save();
    this.st.invited[t.id] = [...new Set([...(this.st.invited[t.id] ?? []), to.id])];
    this.log(`lien de « ${teamName} » envoyé en privé à ${to.label}`);
  }
  async removeMember(teamName: string, gone: Machine) {
    const t = this.team(teamName)!;
    const r = await t.rotate();
    this.st.invited[t.id] = (this.st.invited[t.id] ?? []).filter((x) => x !== gone.id);
    this.log(`${gone.label} retiré de « ${teamName} » : clé changée (époque ${t.epoch}), ${r.republished} solution(s) republiée(s)`);
    for (const id of this.st.invited[t.id]) if (id !== this.id) this.invite(teamName, byId(id));
  }
  async certify(sol: Sol, teamName = sol.team) {
    const t = this.teams.find((x) => x.name === teamName && x.isAdmin)!;
    const { shared, team, requestId, ...clean } = sol;
    await t.publish("solution", await t.certify(clean));
    this.log(`« ${sol.title} » certifiée et republiée`);
  }

  // ---- membre
  async join(i: number) {
    const inv = this.st.inbox[i];
    await this.joinLink(inv.link, this.p?.scopes?.[inv.team]);
    this.st.inbox.splice(i, 1);
  }
  async joinLink(link: string, scope?: string) {
    const m = membershipFromInvite(link, scope || undefined);
    const t = await Team.open(store, m);
    await t.pull(Number.MAX_SAFE_INTEGER); // vérifie le jeton
    this.teams = [...this.teams.filter((x) => x.id !== t.id), t];
    this.st.status[t.id] = "ok";
    this.st.cursors[t.id] = 0;
    this.log(`« ${t.name} » rejointe (époque ${t.epoch})`);
  }
  async friction(f: Friction) {
    const local = this.st.solutions.find((s) => s.step === f.step);
    if (local) {
      this.log(`friction « ${f.label} » : solution en cache, rien ne sort de la machine`);
      return this.notify(local.title, `${local.body}${local.certified ? "\nCertifiée par le responsable." : ""}`);
    }
    const targets = routeTeams(this.teams.filter((t) => this.st.status[t.id] === "ok"), f.step);
    if (!targets.length) { this.log(`friction « ${f.label} » : aucune équipe ne couvre cette étape, rien n'est publié`); return; }
    const requestId = randomId(8);
    // L'heure (arrondie à 10 min) voyage chiffrée : le démon d'Andrea ignore les demandes de plus de 30 min.
    const at = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString();
    for (const t of targets) await t.publish("request", { requestId, step: f.step, type: f.type, control: f.control, detour: f.detour, at });
    this.st.mine[requestId] = f.step;
    this.log(`demande anonyme publiée → ${targets.map((t) => t.name).join(", ")}`);
  }
  // Répondre à une demande sans avoir la solution en stock : on l'écrit (elle reste aussi chez soi).
  async answer(req: Req, title: string, body: string) {
    const sol: Sol = { id: `sol-${randomId(4)}`, step: req.step, type: req.type, title, body, owner: "équipe", reviewed: today(), uses: 1 };
    await this.team(req.team)!.publish("solution", { ...sol, requestId: req.requestId });
    this.st.solutions.push({ ...sol, shared: true, team: req.team });
    this.st.requests = this.st.requests.filter((r) => r !== req);
    this.log(`réponse « ${title} » envoyée dans « ${req.team} »`);
  }
  async share(req: Req) {
    const s = this.st.solutions.find((x) => x.step === req.step)!;
    const { shared, team, certified, ...pub } = s;
    await this.team(req.team)!.publish("solution", { ...pub, requestId: req.requestId });
    this.st.requests = this.st.requests.filter((r) => r !== req);
    this.log(`solution « ${s.title} » partagée dans « ${req.team} » seulement`);
  }

  private pollCount = 0;
  async poll() {
    this.pollCount++;
    for (const t of this.teams) {
      if (this.st.status[t.id] === "révoqué" && this.pollCount % 8) continue; // accès refusé : réessai toutes les ~15 s
      let rows: Received[];
      try { rows = await t.pull(this.st.cursors[t.id] ?? 0); }
      catch (e) {
        if (!(e instanceof AccessDenied)) throw e;
        if (this.st.status[t.id] !== "révoqué") this.log(`« ${t.name} » : accès refusé (retiré, ou clé changée)`);
        this.st.status[t.id] = "révoqué";
        continue;
      }
      this.st.status[t.id] = "ok";
      for (const r of rows) {
        this.st.cursors[t.id] = Math.max(this.st.cursors[t.id] ?? 0, r.seq);
        if (r.kind === "request") await this.onRequest(t, r);
        if (r.kind === "solution") await this.onSolution(t, r);
      }
    }
    this.save();
  }
  private async onRequest(t: Team, r: Received) {
    const d = r.data;
    if (!d?.requestId || this.st.mine[d.requestId]) return;
    this.st.requests = [{ requestId: d.requestId, step: d.step, type: d.type, team: t.name, seq: r.seq }, ...this.st.requests].slice(0, 5);
    const s = this.st.solutions.find((x) => x.step === d.step);
    if (s) await this.notify(`Un collègue bloque : ${d.step}`, `Ta solution « ${s.title} » peut l'aider. Personne ne saura qui a demandé.`);
  }
  private async onSolution(t: Team, r: Received) {
    const d = r.data as Sol;
    if (!d?.id) return;
    const { requestId, ...sol } = d;
    if (requestId) this.st.requests = this.st.requests.filter((r) => r.requestId !== requestId); // déjà résolue
    const existing = this.st.solutions.find((x) => x.id === sol.id);
    if (existing) Object.assign(existing, { uses: Math.max(existing.uses ?? 0, sol.uses ?? 0), ...(sol.certified ? { certified: true, cert: sol.cert, team: t.name, title: sol.title, body: sol.body } : {}) });
    else this.st.solutions.push({ ...sol, shared: true, team: t.name });
    if (requestId && this.st.mine[requestId]) {
      delete this.st.mine[requestId];
      await this.notify(sol.title, `${sol.body}\nRéglé ${sol.uses ?? 1} fois dans l'équipe.${sol.certified ? " Certifiée par le responsable." : ""}`);
    }
  }

  // ---- affichage
  render() {
    if (this.toast && Date.now() - this.toastAt > 30_000) this.toast = "";
    const el = document.getElementById(this.id)!;
    const teams = this.teams.map((t) => {
      const ok = this.st.status[t.id] !== "révoqué";
      const admin = t.isAdmin && SOLO ? `
        <div class="row">
          <button data-a="copy-invite" data-t="${esc(t.name)}">Lien d'invitation</button>
          <button data-a="rotate" data-t="${esc(t.name)}" class="danger">Quelqu'un part : changer la clé</button>
        </div>` : t.isAdmin ? `
        <div class="row">
          <select data-k="who-${t.id}">${machines.filter((m) => m !== this).map((m) => `<option value="${m.id}">${m.label}</option>`).join("")}</select>
          <button data-a="invite" data-t="${esc(t.name)}">Inviter</button>
          <button data-a="remove" data-t="${esc(t.name)}" class="danger">Retirer (rotation)</button>
        </div>` : "";
      return `<div class="team ${ok ? "" : "revoked"}"><b>${esc(t.name)}</b> <span class="muted">époque ${t.epoch}${t.m.scope ? ` · reçoit : /${esc(t.m.scope)}/` : ""}</span>
        ${t.isAdmin ? '<span class="badge">responsable</span>' : ""}${ok ? "" : '<span class="badge red">accès refusé</span>'}${admin}</div>`;
    }).join("") || '<p class="muted">Aucune équipe.</p>';
    const canCreate = SOLO || !this.p?.creates ? "" : `<button data-a="create">Créer « ${esc(this.p.creates)} »</button>`;
    const profilePick = SOLO ? `<div class="row">Je joue :
      <select data-k="profile">${[["", "moi-même"], ...Object.entries(PROFILES).map(([k, p]) => [k, `${p.avatar} ${p.label} (${p.role})`])].map(([k, l]) => `<option value="${k}"${k === (this.st.profile ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <button data-a="profile">Choisir</button></div>` : "";
    const soloForms = SOLO ? `
      ${this.st.lastInvite ? `<div class="inbox">Lien « ${esc(this.st.lastInvite.team)} » : ${esc(this.st.lastInvite.why)}
        <textarea readonly rows="3" data-k="last-link">${esc(this.st.lastInvite.link)}</textarea>
        <div class="row"><button data-a="copy-last" class="primary">Copier</button><button data-a="hide-last">Masquer</button></div></div>` : ""}
      <details${this.teams.length ? "" : " open"}><summary>Rejoindre une équipe (lien reçu)</summary>
        <div class="row"><input data-k="paste" placeholder="frictionassist://join?team=…#…" size="34">${scopeSelect("join-scope")}<button data-a="paste-join" class="primary">Rejoindre</button></div>
        <p class="muted">Périmètre : seulement si tu es dans plusieurs équipes (comme Antoine, Support + Ventes). Il décide où part chaque demande. Sinon, « Tout ».</p></details>
      <details><summary>Créer une équipe (j'en serai responsable)</summary>
        <div class="row"><input data-k="new-name" placeholder="Nom (ex. Support)" size="16">${scopeSelect("new-scope")}<button data-a="create-solo">Créer</button></div></details>` : "";
    const inbox = this.st.inbox.map((i, n) => `<div class="inbox">DM de <b>${esc(i.from)}</b> : lien « ${esc(i.team)} »
      <code title="${esc(i.link)}">${esc(i.link.split("#")[0].slice(0, 38))}…#🔑</code> <button data-a="join" data-n="${n}">Rejoindre</button></div>`).join("");
    const reqs = this.st.requests.map((r) => {
      const s = this.st.solutions.find((x) => x.step === r.step);
      return `<li><span class="tag">${esc(r.team)}</span> Quelqu'un bloque : <i>${esc(r.step)}</i>
        ${s ? `<button data-a="share" data-r="${r.requestId}" class="primary">Partager « ${esc(s.title)} »</button>` : `<button data-a="answer" data-r="${r.requestId}">Je sais : répondre</button>`}</li>`;
    }).join("");
    const sols = this.st.solutions.map((s) => {
      const canCertify = s.shared && !s.certified && this.teams.some((t) => t.isAdmin && t.name === s.team);
      return `<li>${s.certified ? '<span class="badge green">✓ certifiée</span>' : ""}${s.shared ? `<span class="tag">${esc(s.team)}</span>` : '<span class="tag local">local</span>'}
        <b>${esc(s.title)}</b>${canCertify ? ` <button data-a="certify" data-s="${esc(s.id)}">Certifier</button>` : ""}</li>`;
    }).join("");
    const html = `
      <header><h2>${esc(this.p?.avatar ?? "")} ${esc(this.label)}</h2><span class="muted">${esc(this.role)}</span></header>
      ${profilePick}
      ${this.toast ? `<div class="toast">${this.toast}</div>` : ""}
      <section><h3>Équipes</h3>${teams}${canCreate && !this.teams.some((t) => t.isAdmin) ? canCreate : ""}${inbox}${soloForms}</section>
      <section><h3>Je bloque sur…</h3><div class="frictions">${FRICTIONS.map((f, i) => `<button data-a="friction" data-f="${i}">${esc(f.label)}</button>`).join("")}<button data-a="friction-custom">Autre…</button></div>
        ${Object.keys(this.st.mine).length ? `<p class="muted">${Object.keys(this.st.mine).length} demande(s) anonyme(s) en attente</p>` : ""}</section>
      ${reqs ? `<section><h3>Demandes de l'équipe</h3><ul>${reqs}</ul></section>` : ""}
      <section><h3>Solutions (${this.st.solutions.length})</h3><ul class="sols">${sols || '<li class="muted">aucune</li>'}</ul>
        ${SOLO && !this.st.solutions.some((s) => !s.shared) ? `<p class="muted">Choisis un profil en haut : tu connaîtras les règles qu'il donne dans le Slack de PipingTable.</p>` : ""}</section>
      <section class="log">${this.st.log.map(esc).join("<br>")}</section>`;
    if (html === this.html) return; // ne pas refermer une liste déroulante ouverte
    // Garder ce que la personne est en train de taper ou de choisir, et les sections ouvertes.
    const kept = new Map([...el.querySelectorAll<HTMLInputElement>("input[data-k], select[data-k]")].map((x) => [x.dataset.k!, x.value]));
    const focus = (document.activeElement as HTMLElement | null)?.dataset?.k;
    const opened = [...el.querySelectorAll("details")].map((d) => d.open);
    el.innerHTML = this.html = html;
    el.querySelectorAll<HTMLInputElement>("input[data-k], select[data-k]").forEach((x) => { if (kept.has(x.dataset.k!)) x.value = kept.get(x.dataset.k!)!; });
    el.querySelectorAll("details").forEach((d, i) => { if (opened[i] !== undefined) d.open = opened[i]; });
    if (focus) el.querySelector<HTMLElement>(`[data-k="${focus}"]`)?.focus();
  }
  async act(a: string, d: DOMStringMap) {
    if (a === "create") await this.createTeam(this.p!.creates!);
    if (a === "invite" || a === "remove") {
      const t = this.team(d.t!)!;
      const who = byId((document.querySelector(`#${this.id} [data-k="who-${t.id}"]`) as HTMLSelectElement).value);
      if (a === "invite") this.invite(d.t!, who); else await this.removeMember(d.t!, who);
    }
    if (a === "join") await this.join(Number(d.n));
    if (a === "friction") await this.friction(FRICTIONS[Number(d.f)]);
    if (a === "share") await this.share(this.st.requests.find((r) => r.requestId === d.r)!);
    if (a === "certify") await this.certify(this.st.solutions.find((s) => s.id === d.s)!);
    // mode « mon poste »
    const val = (k: string) => (document.querySelector(`#${this.id} [data-k="${k}"]`) as HTMLInputElement | null)?.value.trim() ?? "";
    if (a === "create-solo") {
      if (!val("new-name")) throw new Error("donner un nom à l'équipe");
      await this.createTeam(val("new-name"), val("new-scope"));
    }
    if (a === "paste-join") await this.joinLink(val("paste"), val("join-scope"));
    if (a === "copy-invite") this.st.lastInvite = { team: d.t!, link: this.team(d.t!)!.invite(), why: "à envoyer en privé à chaque membre (DM Slack)" };
    if (a === "rotate") {
      if (!confirm(`Changer la clé de « ${d.t} » ? Tous les membres devront recevoir le nouveau lien ; la personne partie ne le recevra pas.`)) return;
      const t = this.team(d.t!)!;
      const r = await t.rotate();
      this.st.lastInvite = { team: d.t!, link: r.invite, why: `nouvelle clé (époque ${t.epoch}) : à renvoyer aux membres RESTANTS seulement` };
      this.log(`clé de « ${d.t} » changée : ${r.republished} solution(s) republiée(s), l'ancien lien ne marche plus`);
    }
    if (a === "copy-last" && this.st.lastInvite) { await navigator.clipboard.writeText(this.st.lastInvite.link); this.log("lien copié : à coller dans un message privé"); }
    if (a === "hide-last") this.st.lastInvite = undefined;
    if (a === "profile") {
      this.st.profile = val("profile") || undefined;
      this.applyProfile();
      const add = rulesOf(this.p).filter((s) => !this.st.solutions.some((x) => x.id === s.id));
      this.st.solutions.push(...add);
      this.log(this.p ? `je joue ${this.p.label} : ${add.length} règle(s) connue(s) en plus` : "je joue moi-même");
    }
    if (a === "seed") {
      const add = structuredClone(seed).filter((s) => !this.st.solutions.some((x) => x.id === s.id));
      this.st.solutions.push(...add);
      this.log(`${add.length} règles de démo ajoutées à mes solutions`);
    }
    if (a === "answer") {
      const req = this.st.requests.find((r) => r.requestId === d.r)!;
      const title = prompt(`Quelqu'un bloque sur : ${req.step}\n\nLa réponse en une ligne (titre) :`)?.trim();
      if (!title) return;
      const body = prompt("Le détail (facultatif) :")?.trim() ?? "";
      await this.answer(req, title, body);
    }
    if (a === "friction-custom") {
      const stepText = prompt("Sur quelle étape bloques-tu ? Décris l'étape, sans nom ni donnée client (ex. « HubSpot : fusionner deux fiches contact »)")?.trim();
      if (stepText) await this.friction({ label: stepText, step: stepText, type: "unclear", control: "direct", detour: "demande_aide" });
    }
    this.save();
  }
}

if (SOLO) machines.push(new Machine("moi", "Mon poste", "mes clés restent dans ce navigateur", []));
else for (const [id, p] of Object.entries(PROFILES)) machines.push(new Machine(id, p.label, p.role, rulesOf(p), p));
await Promise.all(machines.map((m) => m.init()));

// ---- vue opérateur : ce que Supabase (ou quiconque vole la base) voit
const names = () => Object.fromEntries(machines.flatMap((m) => m.teams.map((t) => [t.id, t.name])));
async function renderOperator() {
  const v = await fetch("/api/operator").then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const n = names();
  const el = document.getElementById("operator-tables")!;
  if (v.error || v.note) { el.innerHTML = `<p class="muted">${esc(v.error ?? v.note)}</p>`; return; }
  el.innerHTML = `
    <table><tr><th>teams.id</th><th>époque</th><th>access_hash (sha256 du jeton)</th><th>admin_hash</th><th class="legend">légende*</th></tr>
    ${v.teams.map((t: any) => `<tr><td><code>${esc(t.id.slice(0, 8))}…</code></td><td>${t.epoch}</td><td><code>${esc(t.access_hash.slice(0, 20))}…</code></td><td><code>${esc(t.admin_hash.slice(0, 12))}…</code></td><td class="legend">${esc(n[t.id] ?? "?")}</td></tr>`).join("")}</table>
    <table><tr><th>seq</th><th>team_id</th><th>kind</th><th>époque</th><th>taille</th><th>ciphertext</th><th>day</th><th class="legend">légende*</th></tr>
    ${v.blobs.map((b: any) => `<tr><td>${b.seq}</td><td><code>${esc(b.team_id.slice(0, 8))}…</code></td><td>${esc(b.kind)}</td><td>${b.epoch}</td><td>${b.size}</td><td><code class="ct">${esc(b.ciphertext.slice(0, 64))}…</code></td><td>${esc(b.day)}</td><td class="legend">${esc(n[b.team_id] ?? "?")}</td></tr>`).join("")}</table>
    <p class="muted">* La colonne « légende » est ajoutée par les navigateurs des membres pour la démo : le serveur ne connaît aucun nom d'équipe, aucun auteur, aucune heure précise.</p>`;
  (window as any).lastBlobs = v.blobs;
}

// ---- attaques (menées depuis le navigateur, avec ce qu'un attaquant aurait réellement)
async function attack(kind: string) {
  const out = document.getElementById("attack-out")!;
  const res = (ok: boolean, s: string) => { out.innerHTML = `<div class="${ok ? "ok" : "ko"}">${ok ? "🛡️ Bloqué" : "⚠️ Réussi"} — ${s}</div>`; };
  const known = [...new Map(machines.flatMap((m) => m.teams.map((t) => [t.id, t] as const))).values()];
  const blobs: any[] = (window as any).lastBlobs ?? [];
  const victim = known.find((t) => blobs.some((b) => b.team_id === t.id)) ?? known[0];
  const supportId = victim?.id;
  if (kind === "read") {
    const h = apiKeyHeaders(cfg.anonKey);
    const r = await fetch(`${cfg.url}${cfg.restPath}/blobs?select=*`, { headers: h });
    const t = await r.text();
    res(!r.ok, `GET /blobs avec la clé publique (présente dans chaque client) → HTTP ${r.status} ${esc(t.slice(0, 90))}`);
  }
  if (kind === "write") {
    if (!supportId) return res(true, "créer d'abord une équipe");
    try { await store.put(supportId, "jeton-invente", "solution", 1, "x"); res(false, "écriture acceptée"); }
    catch (e) { res(true, `écrire dans « ${esc(victim.name)} » avec un jeton inventé → ${esc((e as Error).message)}`); }
  }
  if (kind === "decrypt") {
    const blob = blobs.find((b: any) => b.team_id === supportId);
    const other = known.find((t) => t.id !== supportId);
    if (!blob || !other) return res(true, "il faut deux équipes et au moins un blob (et la vue opérateur)");
    const keys = await deriveTeamKeys(b64u.dec(other.m.key));
    try { await open(keys, { teamId: supportId!, kind: blob.kind, epoch: blob.epoch }, blob.ciphertext); res(false, "déchiffré"); }
    catch { res(true, `blob n°${blob.seq} de « ${esc(victim.name)} », pris dans la base, avec la clé de « ${esc(other.name)} » → déchiffrement impossible (AES-GCM : authentification échouée)`); }
  }
}

// ---- scénario guidé : chaque étape fait ce que la personne ferait dans son panneau
const M = (id: string) => byId(id);
const SCENARIO: [string, string, () => Promise<unknown>][] = [
  ["1", "Claire crée « Support », Antoine « Ventes »", async () => { await M("claire").createTeam("Support"); await M("antoine").createTeam("Ventes"); }],
  ["2", "Liens envoyés en privé, chacun rejoint", async () => {
    for (const id of ["lea", "karim", "antoine"]) M("claire").invite("Support", M(id));
    M("antoine").invite("Ventes", M("sarah"));
    for (const id of ["lea", "karim", "antoine", "sarah"]) await M(id).join(0);
  }],
  ["3", "9 h 05 · Léa ne trouve pas Jean Dupont", () => M("lea").friction(F.introuvable)],
  ["4", "Karim partage", () => shareFirst("karim", "Support")],
  ["5", "11 h · Jean Dupont veut un dédommagement", () => M("lea").friction(F.geste)],
  ["6", "Claire partage et certifie sa règle", async () => {
    await shareFirst("claire", "Support");
    const s = M("claire").st.solutions.find((x) => x.id === "geste-commercial");
    if (s) await M("claire").certify(s, "Support");
  }],
  ["7", "15 h 30 · Antoine : prospect belge (→ Ventes seulement)", () => M("antoine").friction(F.prospect)],
  ["8", "Sarah partage", () => shareFirst("sarah", "Ventes")],
  ["9", "Karim quitte le Support : Claire change la clé", () => M("claire").removeMember("Support", M("karim"))],
  ["10", "Léa et Antoine prennent le nouveau lien", async () => { await M("lea").join(0); await M("antoine").join(0); }],
];
async function shareFirst(id: string, team: string) {
  const m = M(id);
  await m.poll();
  const r = m.st.requests.find((x) => x.team === team && m.st.solutions.some((s) => s.step === x.step));
  if (r) await m.share(r);
}

// ---- boucle
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try { for (const m of machines) await m.poll(); } catch (e) { console.error(e); }
  machines.forEach((m) => m.render());
  await renderOperator();
  busy = false;
}
async function run(fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { alert((e as Error).message); }
  machines.forEach((m) => m.save());
  await tick();
}

const scenarioEl = document.getElementById("scenario");
if (scenarioEl) scenarioEl.innerHTML = SCENARIO.map(([n, label], i) => `<button data-sc="${i}"><b>${n}</b> ${esc(label)}</button>`).join("");
scenarioEl?.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button[data-sc]") as HTMLElement | null;
  if (!b) return;
  b.classList.add("done");
  run(SCENARIO[Number(b.dataset.sc)][2]);
});
for (const m of machines) document.getElementById(m.id)!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button[data-a]") as HTMLElement | null;
  if (b) run(() => m.act(b.dataset.a!, b.dataset));
});
document.getElementById("attacks")!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button[data-x]") as HTMLElement | null;
  if (b) run(() => attack(b.dataset.x!));
});
document.getElementById("reset")!.addEventListener("click", async () => {
  if (SOLO) {
    if (!confirm("Oublier mes clés d'équipe sur ce navigateur ? Il faudra un nouveau lien pour revenir.")) return;
  } else {
    if (!confirm("Tout effacer (clés des 4 machines et base locale) ?")) return;
    const r = await fetch("/api/reset", { method: "POST", headers: H }).then((x) => x.json());
    if (r.error) alert(r.error);
  }
  machines.forEach((m) => m.reset());
  document.querySelectorAll("#scenario .done").forEach((b) => b.classList.remove("done"));
  document.getElementById("attack-out")!.innerHTML = "";
  await tick();
});
document.getElementById("store")!.textContent = cfg.label ?? cfg.url;
if (location.hash) document.getElementById(location.hash.slice(1))?.classList.add("focus");
window.addEventListener("hashchange", () => { document.querySelectorAll(".machine.focus").forEach((x) => x.classList.remove("focus")); document.getElementById(location.hash.slice(1))?.classList.add("focus"); });
await tick();
setInterval(tick, 2000);
