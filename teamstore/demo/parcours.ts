// Parcours guidé : la journée de Léa chez PipingTable, en 7 chapitres, pour comprendre l'outil en le voyant agir.
// Tout est réel sous le capot : vraies équipes chiffrées, vrais blocs dans le stockage (visibles en bas), vraies
// notifications Screenpipe si la case est cochée. Seuls l'écran de Léa (Crisp, HubSpot…) et la décision de l'IA
// sont mis en scène ; dans le vrai produit, c'est le démon d'Andrea et la détection Crisp de Minguk qui les font.
import { AccessDenied, membershipFromInvite, SupabaseStore, Team } from "../client";
import { classify } from "../../minguk/src/assist/crisp-assist.ts";
import { CRISP_CUSTOMERS } from "../../minguk/src/seed/crisp-story.ts";
import { escalationPayload } from "./escalade";
import { Board } from "./board";

type Sol = { id: string; step: string; title: string; body: string; copy?: string; certified?: boolean; cert?: string; requestId?: string; uses?: number; [k: string]: unknown };
type Stage = { icon: string; label: string; detail: string; state: "idle" | "active" | "done" | "miss" };
type Notif = { title: string; body: string; buttons?: { label: string; act?: string; primary?: boolean }[]; tone?: "help" | "ask" | "slack" | "warn" };
type Actor = { id: string; name: string; avatar: string; role: string; team: Team; solutions: Sol[]; cursor: number; status: string; notif?: Notif; revoked?: boolean };

const cfg = await (await fetch("/api/config")).json();
const seed: Sol[] = await (await fetch("/api/seed")).json();
const store = new SupabaseStore(cfg.url, cfg.anonKey, cfg.restPath);
const H = { "Content-Type": "application/json", "X-FA-Demo": "1" };
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
const sol = (id: string) => structuredClone(seed.find((s) => s.id === id)!);
const today = () => new Date().toISOString().slice(0, 10);
const jean = CRISP_CUSTOMERS.find((c) => c.key === "jean-dupont")!;
const pieter = CRISP_CUSTOMERS.find((c) => c.key === "pieter-janssens")!;

// ---------- état affiché ----------
const ui = {
  chapter: 0,
  title: "",
  what: "",
  why: "",
  screenOwner: "Léa",
  tab: "crisp" as "crisp" | "hubspot" | "slack" | "notion",
  crisp: [] as { who: string; text: string; when: string }[],
  hubspot: { query: "", result: "" },
  slack: [] as { who: string; text: string }[],
  notion: false,
  leaNotif: undefined as Notif | undefined,
  stages: [] as Stage[],
  reveal: undefined as { team: string; server: string } | undefined,
  countdown: 0,
  map: [] as { step: string; n: number; status: string }[],
  mapCommand: "",
  actions: [] as { label: string; act: string; primary?: boolean }[],
  agentNote: "",
  done: false,
};
const CHAPTERS = ["Aide immédiate", "Demander à l'équipe", "Certifier la règle", "Personne ne sait", "La nuit", "Le lendemain", "Quelqu'un part", "La carte"];
let actors: Actor[] = [];
const A = (id: string) => actors.find((a) => a.id === id)!;
const teamIds = new Set<string>();
let lastPendingRequest = ""; // la demande du prospect belge restée sans réponse (chapitre 4), que la nuit résout

// ---------- interactions : un bouton à cliquer (ou cliqué tout seul en mode présentation) ----------
let resolveAct: ((act: string) => void) | null = null;
const auto = () => ($("auto") as HTMLInputElement).checked;
function ask(actions: { label: string; act: string; primary?: boolean }[]): Promise<string> {
  ui.actions = actions;
  render();
  return new Promise((resolve) => {
    resolveAct = (act) => { ui.actions = []; resolveAct = null; resolve(act); };
    if (auto()) setTimeout(() => resolveAct?.(actions.find((a) => a.primary)?.act ?? actions[0].act), 2600);
  });
}
// Cocher « Mode présentation » pendant qu'un bouton attend le clique aussi (sinon le parcours restait bloqué).
$("auto").addEventListener("change", () => {
  const pending = ui.actions;
  if (auto() && resolveAct && pending.length) setTimeout(() => { if (auto() && ui.actions === pending) resolveAct?.(pending.find((a) => a.primary)?.act ?? pending[0].act); }, 1200);
});
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
  if (b && resolveAct) { b.classList.add("pressed"); resolveAct(b.dataset.act!); }
  const c = (e.target as HTMLElement).closest("[data-copy]") as HTMLElement | null;
  if (c) navigator.clipboard.writeText(c.dataset.copy!).then(() => { c.textContent = "Copié"; });
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, auto() ? ms : ms * 0.8));
async function stage(i: number, state: Stage["state"], detail?: string) {
  ui.stages[i] = { ...ui.stages[i], state, ...(detail ? { detail } : {}) };
  render();
  await wait(state === "active" ? 700 : 450);
}
function pipeline(...details: string[]) {
  const base: [string, string][] = [["👁", "Screenpipe voit l'écran"], ["🧠", "L'IA qualifie"], ["📦", "Mémoire du poste"], ["🔒", "Équipe (chiffré)"]];
  ui.stages = base.map(([icon, label], i) => ({ icon, label, detail: details[i] ?? "", state: "idle" }));
}

// ---------- vraies notifications Screenpipe (facultatif) ----------
async function screenpipe(n: Notif | object, who: string) {
  if (!($("notify") as HTMLInputElement).checked) return;
  const p = "title" in n && "body" in n && !("pipe_name" in n)
    ? { id: `fa-parcours-${Math.random().toString(36).slice(2, 8)}`, title: `[${who}] ${(n as Notif).title}`, body: (n as Notif).body, priority: "normal", timeout: 15000, actions: [{ id: "open", label: "Voir le parcours", type: "link", url: `${location.origin}/parcours` }] }
    : { ...(n as object), title: `[${who}] ${(n as any).title}` };
  await fetch("/api/notify", { method: "POST", headers: H, body: JSON.stringify(p) }).catch(() => {});
}

// ---------- équipe réelle ----------
async function setup() {
  const claire = await Team.create(store, "Support");
  teamIds.add(claire.id);
  const join = () => Team.open(store, membershipFromInvite(claire.invite()));
  actors = [
    { id: "lea", name: "Léa", avatar: "🙋‍♀️", role: "Support, 2 semaines", team: await join(), solutions: [sol("client-introuvable")], cursor: 0, status: "" },
    { id: "claire", name: "Claire Morin", avatar: "👩‍💼", role: "Responsable support", team: claire, solutions: [sol("geste-commercial")], cursor: 0, status: "connaît la règle du geste commercial" },
    { id: "karim", name: "Karim Bensaïd", avatar: "👨‍💻", role: "Support, 3 ans", team: await join(), solutions: ["client-introuvable", "offre-du-client", "signaler-bug", "promesse-commercial"].map(sol), cursor: 0, status: "connaît les chemins HubSpot, #bugs, les promesses" },
    { id: "yasmine", name: "Yasmine Roche", avatar: "👩‍💻", role: "Support", team: await join(), solutions: [], cursor: 0, status: "ne connaît encore aucune règle" },
  ];
  // « Hier », Karim a partagé « client introuvable » avec l'équipe : Léa l'a dans sa mémoire depuis.
  await A("karim").team.publish("solution", { ...sol("client-introuvable"), sharedAt: new Date(Date.now() - 86_400_000).toISOString() });
  for (const a of actors) await pull(a);
}
async function pull(a: Actor) {
  const rows = await a.team.pull(a.cursor);
  for (const r of rows) {
    a.cursor = Math.max(a.cursor, r.seq);
    if (r.kind !== "solution") continue;
    const s = r.data as Sol;
    const existing = a.solutions.find((x) => x.id === s.id);
    // Une version non certifiée d'une règle certifiée (falsification) fait tomber le badge : on le signale.
    if (existing) Object.assign(existing, s.certified ? { certified: true, cert: s.cert, body: s.body, title: s.title, forged: false } : existing.certified ? { certified: false, forged: true } : {});
    else a.solutions.push(s);
  }
  return rows;
}
async function lastCiphertext(seq: number) {
  const v = await fetch("/api/operator").then((r) => r.json()).catch(() => ({}));
  const b = (v.blobs ?? []).find((x: any) => Number(x.seq) === seq);
  return b ? `${b.ciphertext.slice(0, 120)}…  (${b.size} caractères)` : "(vue opérateur indisponible : stockage distant)";
}
async function signature(a: Actor, step: string, type: string, control: string, detour: string) {
  await a.team.publish("signature", { step, type, control, detour, day: today() });
}

// ---------- les chapitres ----------
async function chapter1() {
  const s = sol("client-introuvable");
  ui.chapter = 1; ui.screenOwner = "Léa"; ui.tab = "crisp";
  ui.title = "9 h 05 · Léa a déjà la réponse";
  ui.what = "Jean Dupont, client du restaurant **Le Bistro**, écrit sur Crisp : sa page de réservation est en panne. Avant de l'aider, Léa doit retrouver sa fiche dans HubSpot.";
  ui.why = "";
  pipeline("", "", "", "");
  render(); await wait(600);
  ui.crisp.push({ who: jean.nickname, text: jean.messages[0].text, when: "9 h 05" }); render();
  await ask([{ label: `🔎 Léa cherche « ${jean.email} » dans HubSpot`, act: "go", primary: true }]);
  ui.tab = "hubspot"; ui.hubspot = { query: jean.email, result: "0 résultat" };
  ui.what = "Jean écrit sur Crisp avec une **autre adresse** que celle de HubSpot : Léa ne le trouve pas. Elle pourrait chercher 10 minutes, ou demander sur Slack.";
  await stage(0, "active", `HubSpot · recherche « ${jean.email} » · **0 résultat**`); await stage(0, "done");
  await stage(1, "active", `Friction : **retrouver un client** (type « recherche », confiance 0,95)`); await stage(1, "done");
  await stage(2, "active", `Solution en mémoire : **« ${s.title} »** (partagée hier par Karim)`); await stage(2, "done");
  await signature(A("lea"), s.step, "unclear", "direct", "recherche");
  await stage(3, "miss", "**Rien n'est envoyé** à l'équipe. Juste une signature anonyme pour la carte.");
  ui.leaNotif = { title: s.title, body: s.body, tone: "help", buttons: [{ label: "Ça m'a aidé", act: "ok", primary: true }] };
  await screenpipe(ui.leaNotif, "Léa");
  ui.why = "La solution trouvée hier par un collègue arrive **au bon moment, en 2 secondes**, sans que Léa demande quoi que ce soit, et sans que rien ne quitte son poste.";
  await ask([{ label: "👍 Ça m'a aidé", act: "ok", primary: true }]);
  ui.leaNotif = undefined;
}

async function chapter2() {
  const s = sol("geste-commercial");
  ui.chapter = 2; ui.tab = "crisp"; ui.why = "";
  ui.title = "11 h · Léa ne sait pas : elle demande à l'équipe, anonymement";
  ui.what = "Jean revient : il a perdu des réservations et **veut un dédommagement**. Que peut-on offrir ? Léa n'en a aucune idée.";
  pipeline(); render(); await wait(500);
  ui.crisp.push({ who: jean.nickname, text: jean.messages[1].text, when: "11 h 00" }); render();
  const needs = classify(jean.messages[1].text);
  await ask([{ label: "✍️ Léa demande sur Slack « On peut offrir quelque chose à un client premium ? »", act: "go", primary: true }]);
  ui.tab = "slack"; ui.slack.push({ who: "Léa", text: "On peut offrir quelque chose à un client premium ?" });
  await stage(0, "active", `Crisp : message de Jean (détection de Minguk : besoin « **${needs[0] ?? "?"}** ») · Slack : Léa pose la question`); await stage(0, "done");
  await stage(1, "active", "Friction : **un client demande un dédommagement** (confiance 0,92)"); await stage(1, "done");
  await stage(2, "miss", "**Aucune solution** dans la mémoire de Léa");
  const req = { requestId: Math.random().toString(16).slice(2, 18), step: s.step, type: "unclear", control: "required", detour: "demande_aide", at: new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString() };
  await signature(A("lea"), s.step, "unclear", "required", "demande_aide");
  const seq = await A("lea").team.publish("request", req);
  await stage(3, "active", "Demande **anonyme et chiffrée** envoyée au Support : l'étape seulement. Ni « Léa », ni « Jean Dupont ».");
  ui.reveal = { team: JSON.stringify({ step: req.step, type: req.type, detour: req.detour }, null, 1), server: await lastCiphertext(seq) };
  ui.what = "Regarde la différence entre ce que lit l'équipe et ce que voit le serveur (en bas).";
  for (const id of ["claire", "karim", "yasmine"]) await pull(A(id));
  A("claire").notif = { title: `Un collègue bloque : ${s.step}`, body: `Ta solution « ${s.title} » peut l'aider. Personne ne saura qui a demandé.`, tone: "ask", buttons: [{ label: "Partager", act: "share", primary: true }] };
  A("karim").status = "a reçu la demande, ne connaît pas la règle : rien ne s'affiche";
  A("yasmine").status = "a reçu la demande, ne connaît pas la règle : rien ne s'affiche";
  await screenpipe(A("claire").notif!, "Claire");
  render();
  await ask([{ label: "Claire clique « Partager »", act: "share", primary: true }]);
  A("claire").notif = undefined; A("claire").status = "a partagé, sans savoir qui demandait";
  await A("claire").team.publish("solution", { ...s, requestId: req.requestId, sharedAt: new Date().toISOString() });
  await pull(A("lea"));
  await stage(3, "done", "Solution reçue de l'équipe, déchiffrée sur le poste de Léa");
  ui.tab = "crisp"; ui.reveal = undefined;
  ui.leaNotif = { title: s.title, body: `${s.body}\nRéglé ${s.uses} fois dans l'équipe.`, tone: "help", buttons: [{ label: "Copier la réponse", act: "ok", primary: true }] };
  await screenpipe(ui.leaNotif, "Léa");
  ui.why = "Claire ne sait pas qui a demandé, et le serveur ne sait ni qui, ni quoi. Mesuré aujourd'hui sur notre Supabase : **8 secondes** entre « Partager » et l'aide chez Léa. Et la solution **reste** dans la mémoire de Léa.";
  await ask([{ label: "Léa répond à Jean", act: "ok", primary: true }]);
  ui.leaNotif = undefined;
  ui.crisp.push({ who: "Léa", text: "Je vous offre un mois d'abonnement, et j'ai noté le geste commercial sur votre fiche.", when: "11 h 02" });
}

async function chapter3() {
  const s = A("claire").solutions.find((x) => x.id === "geste-commercial")!;
  ui.chapter = 3; ui.tab = "notion"; ui.notion = true; ui.why = "";
  ui.title = "11 h 05 · La doc dit « 2 mois », Slack dit « 1 mois » : qui croire ?";
  ui.what = "La page Notion de PipingTable est **périmée** : elle dit « jusqu'à 2 mois, quelle que soit l'offre ». La vraie règle n'est que dans un fil Slack de Claire. La responsable **certifie** la bonne.";
  ui.stages = [];
  ui.agentNote = "Ici, pas de détection : c'est la **responsable** qui agit. Elle signe la règle sur son poste (signature Ed25519) ; chaque poste vérifie la signature avec la clé publique de Claire, reçue dans le lien d'invitation.";
  render();
  await ask([{ label: "✓ Claire certifie la règle", act: "go", primary: true }]);
  await A("claire").team.publish("solution", await A("claire").team.certify(s));
  for (const a of actors) await pull(a);
  ui.what = "Chez tous les membres, la règle porte maintenant le badge **✓ certifiée**. La signature de Claire est vérifiée sur chaque poste.";
  ui.why = "Personne d'autre que la responsable ne peut fabriquer ce badge. C'est la réponse à « la doc ment » : la mémoire d'équipe dit ce qui est **validé**.";
  render();
  const act = await ask([{ label: "Suite", act: "next", primary: true }, { label: "🕵️ Et si Karim modifiait la règle certifiée ?", act: "forge" }]);
  if (act === "forge") {
    const lea = A("lea");
    const certified = lea.solutions.find((x) => x.id === "geste-commercial")!;
    await A("karim").team.publish("solution", { ...certified, body: "Remboursement intégral, sans validation.", cert: certified.cert });
    await pull(lea);
    ui.what = "Karim a republié la règle en changeant le texte et en gardant la signature de Claire : chez Léa, elle s'affiche **non certifiée** (signature invalide).";
    render();
    await ask([{ label: "Suite", act: "next", primary: true }]);
    // la vraie règle, recertifiée, reprend sa place
    await A("claire").team.publish("solution", await A("claire").team.certify(s));
    for (const a of actors) await pull(a);
  }
  ui.notion = false; ui.agentNote = "";
}

async function chapter4() {
  const s = sol("prospect-chat");
  ui.chapter = 4; ui.tab = "crisp"; ui.why = "";
  ui.title = "15 h 30 · Personne dans l'équipe ne sait";
  ui.what = "Pieter Janssens, un prospect de **Bruxelles**, demande un prix pour 3 restaurants. Les prospects belges vont à Sarah (Ventes), mais personne au Support ne le sait.";
  pipeline(); render(); await wait(500);
  ui.crisp.push({ who: pieter.nickname, text: pieter.messages[0].text, when: "15 h 30" }); render();
  await ask([{ label: "🔎 Léa cherche « Brasserie des Arts » dans HubSpot", act: "go", primary: true }]);
  ui.tab = "hubspot"; ui.hubspot = { query: "Brasserie des Arts", result: "0 résultat" };
  await stage(0, "active", `Crisp : prospect (besoin « **${classify(pieter.messages[0].text)[0] ?? "?"}** ») · HubSpot : 0 résultat`); await stage(0, "done");
  await stage(1, "active", "Friction : **créer un prospect venu du chat**"); await stage(1, "done");
  await stage(2, "miss", "Aucune solution dans la mémoire de Léa");
  const req = { requestId: Math.random().toString(16).slice(2, 18), step: s.step, type: "handoff", control: "influence", detour: "demande_aide", at: new Date().toISOString() };
  lastPendingRequest = req.requestId;
  await signature(A("lea"), s.step, "handoff", "influence", "demande_aide");
  await A("lea").team.publish("request", req);
  await stage(3, "active", "Demande anonyme envoyée au Support…");
  for (const id of ["claire", "karim", "yasmine"]) { await pull(A(id)); A(id).status = "a reçu la demande : pas de solution"; }
  render();
  for (let n = 5; n > 0; n--) { ui.countdown = n; render(); await wait(900); }
  ui.countdown = 0;
  await stage(3, "miss", "**Personne n'a répondu** (en vrai : au bout de 2 minutes)");
  const { payload } = escalationPayload(req.requestId, s.step, cfg.slack ?? { support: "#", bugs: "#", dealDesk: "#", newLeads: "#" });
  ui.leaNotif = { title: payload.title, body: payload.body, tone: "slack", buttons: payload.actions.map((a: any) => ({ label: a.label, act: "ok", primary: a.primary })) };
  await screenpipe(payload, "Léa");
  ui.what = "L'outil ne laisse jamais Léa seule : il lui propose **le bon canal Slack** (#new-leads) et une question **déjà rédigée**. C'est la notification « 💬 Slack + message » de Minguk.";
  ui.why = "Et cette étape apparaîtra sur la carte comme **« sans solution »** : la responsable sait quoi documenter.";
  await ask([{ label: "Léa copie le message et ouvre #new-leads", act: "ok", primary: true }]);
  ui.leaNotif = undefined;
  for (const id of ["karim", "yasmine"]) A(id).status = "";
}

// La nuit : le poste de Léa relit ce qui a suivi la friction restée sans réponse (le prospect belge), et l'IA dit
// si elle s'en est sortie. Le texte d'écran est mis en scène (ce que Léa a vu après l'escalade) ; le jugement est
// celui de la vraie IA de Screenpipe ; la proposition est réellement publiée, chiffrée, pour Claire.
async function chapterNight() {
  const s = sol("prospect-chat");
  ui.chapter = 5; ui.screenOwner = "Léa"; ui.tab = "slack"; ui.why = ""; ui.leaNotif = undefined;
  ui.title = "La nuit · le poste de Léa relit ce qui s'est passé après";
  ui.what = "Après l'escalade, Léa a demandé dans **#new-leads**, et le message épinglé de Sarah lui a donné la réponse. Personne ne l'a écrite dans la mémoire d'équipe. Cette nuit, son poste relit les 15 minutes qui ont suivi la friction.";
  ui.slack = [{ who: "Sarah Lambert (épinglé)", text: "Rappel : les prospects belges sont pour moi. Créez le contact en « Lead » dans HubSpot et postez-le ici, je reprends." }, { who: "Léa", text: "Lead : Brasserie des Arts (Bruxelles), 3 sites, demande de prix sur le chat." }];
  ui.stages = [
    { icon: "🌙", label: "Relire l'après-friction (Screenpipe)", detail: "", state: "idle" },
    { icon: "🧠", label: "L'IA juge : résolue ? comment ?", detail: "", state: "idle" },
    { icon: "✍️", label: "Règle générale, sans nom ni client", detail: "", state: "idle" },
    { icon: "🔒", label: "Proposition chiffrée pour la responsable", detail: "", state: "idle" },
  ];
  render();
  await ask([{ label: "🌙 Lancer la boucle de nuit", act: "go", primary: true }]);
  const context = [`Crisp · ${pieter.nickname} : ${pieter.messages[0].text}`, "HubSpot · recherche « Brasserie des Arts » · 0 contacts", ...ui.slack.map((m) => `Slack #new-leads · ${m.who} : ${m.text}`), "HubSpot · Créer un contact · Cycle de vie : Lead"].join("\n");
  await stage(0, "active", "Crisp, HubSpot, Slack #new-leads : les 15 minutes après la friction, **sur le poste de Léa seulement**"); await stage(0, "done");
  await stage(1, "active", "Le modèle choisi dans Screenpipe lit ce texte…");
  const r = await fetch("/api/nuit", { method: "POST", headers: H, body: JSON.stringify({ cases: [{ step: s.step, context, label: "prospect belge" }] }) }).then((x) => x.json()).catch(() => ({}));
  const f = r.findings?.[0] ?? { resolved: true, title: "Prospect belge : créer en Lead, poster dans #new-leads", body: "Les prospects belges vont à la commerciale Belgique.", how: "slack", confidence: 0.9, fallback: true };
  await stage(1, f.resolved ? "done" : "miss", f.resolved ? `**Résolue** (trouvé via ${f.how}, confiance ${f.confidence})${f.fallback ? " · IA indisponible : verdict préparé" : ""}` : "Non résolue : la friction part en attente chez la responsable");
  await stage(2, "done", f.resolved ? `« **${f.title}** »\n${f.body}` : "—");
  const id = `nuit-${Math.random().toString(16).slice(2, 12)}`;
  const seq = await A("lea").team.publish("candidate", f.resolved ? { type: "proposition", id, step: s.step, title: f.title, body: f.body, how: f.how, confidence: f.confidence, day: today() } : { type: "attente", id, step: s.step, day: today() });
  await stage(3, "done", "Publiée, chiffrée : les démons ne s'en servent **pas** tant que Claire ne l'a pas certifiée");
  ui.reveal = { team: JSON.stringify({ type: f.resolved ? "proposition" : "attente", title: f.title, step: s.step }, null, 1), server: await lastCiphertext(seq) };
  A("claire").notif = { title: "1 proposition de la nuit à valider", body: `« ${f.title ?? s.step} »\nDes collègues ont trouvé comment faire. Relis, puis certifie.`, tone: "ask", buttons: [{ label: "Certifier", act: "certify", primary: true }] };
  await screenpipe(A("claire").notif!, "Claire");
  ui.what = "Le matin, Claire reçoit la proposition. Elle relit (elle peut corriger le texte) et certifie.";
  ui.why = "**La mémoire se nourrit seule** : personne n'a eu à écrire de documentation. Mais rien n'entre dans la mémoire d'équipe sans la responsable : l'IA propose, l'humaine valide.";
  render();
  await ask([{ label: "✓ Claire certifie la proposition", act: "certify", primary: true }]);
  A("claire").notif = undefined; ui.reveal = undefined;
  if (f.resolved) {
    await A("claire").team.publish("solution", await A("claire").team.certify({ id, step: s.step, title: f.title, body: f.body, owner: "nuit", reviewed: today(), uses: 0, requestId: lastPendingRequest }));
    await A("claire").team.purge(seq).catch(() => false);
    for (const a of actors) await pull(a);
    A("claire").status = "a certifié la règle trouvée cette nuit";
    ui.what = "La règle est maintenant dans la mémoire de toute l'équipe, avec le badge **✓ certifiée**. Le prochain prospect belge aura l'aide tout de suite.";
  }
  render();
  await ask([{ label: "Suite", act: "ok", primary: true }]);
}

async function chapter5() {
  const camille = CRISP_CUSTOMERS.find((c) => c.key !== "jean-dupont" && c.key !== "pieter-janssens" && c.key !== "elodie-marchand")?.nickname ?? "Camille Robert";
  ui.chapter = 6; ui.screenOwner = "Yasmine"; ui.tab = "crisp"; ui.why = "";
  ui.crisp = []; ui.slack = []; ui.hubspot = { query: "", result: "" };
  ui.title = "Le lendemain · Yasmine a la même question… et la réponse est déjà là";
  ui.what = `Yasmine (Support) n'a jamais entendu parler de la règle. Un client, ${camille}, demande à son tour un dédommagement.`;
  pipeline(); render();
  await pull(A("yasmine"));
  await wait(500);
  ui.crisp.push({ who: camille, text: "Le service a été coupé deux heures, vous pouvez faire un geste ?", when: "10 h 12" }); render();
  await ask([{ label: "Yasmine ouvre la conversation", act: "go", primary: true }]);
  const s = A("yasmine").solutions.find((x) => x.id === "geste-commercial")!;
  await stage(0, "active", "Crisp : demande de geste commercial"); await stage(0, "done");
  await stage(1, "active", "Friction : **un client demande un dédommagement**"); await stage(1, "done");
  await signature(A("yasmine"), s.step, "unclear", "required", "demande_aide");
  await stage(2, "done", "Solution **déjà dans la mémoire de l'équipe**, reçue hier, **✓ certifiée** par Claire");
  await stage(3, "miss", "Rien à demander à personne");
  ui.leaNotif = { title: s.title, body: `${s.body}\nRègle certifiée par la responsable.`, tone: "help", buttons: [{ label: "Copier la réponse", act: "ok", primary: true }] };
  await screenpipe(ui.leaNotif, "Yasmine");
  ui.why = "**La friction ne s'est payée qu'une fois.** Hier, Léa a cherché et Claire a répondu. Aujourd'hui, Yasmine a la bonne règle en 2 secondes, sans déranger personne.";
  await ask([{ label: "Suite", act: "ok", primary: true }]);
  ui.leaNotif = undefined; ui.screenOwner = "Léa";
}

async function chapter6() {
  ui.chapter = 7; ui.why = ""; ui.stages = [];
  ui.title = "Karim quitte l'équipe Support : on change la serrure";
  ui.what = "Karim part chez les Ventes. Il ne doit plus lire ce que partage le Support. Claire, la responsable, change la clé de l'équipe.";
  ui.agentNote = "Le poste de Claire relit les solutions et signatures, génère une **nouvelle clé**, envoie au serveur seulement **l'empreinte** du nouveau jeton, puis republie tout sous la nouvelle clé. Le nouveau lien part en privé aux membres restants.";
  render();
  await ask([{ label: "🔑 Claire change la clé", act: "go", primary: true }]);
  const r = await A("claire").team.rotate();
  try { await A("karim").team.pull(); } catch (e) { if (e instanceof AccessDenied) { A("karim").revoked = true; A("karim").status = "accès refusé : l'ancien lien ne marche plus"; } }
  for (const id of ["lea", "yasmine"]) {
    A(id).team = await Team.open(store, membershipFromInvite(r.invite));
    A(id).cursor = 0;
    await pull(A(id));
    A(id).status = "a reçu le nouveau lien en privé : tout est là";
  }
  ui.what = `Nouvelle clé (époque ${A("claire").team.epoch}). Les anciens blocs ont **disparu du serveur**, et les ${r.republished} solutions ont été **republiées** sous la nouvelle clé pour les membres restants.`;
  ui.why = "Karim n'a plus accès à rien, Léa et Yasmine n'ont rien perdu. Le serveur n'a jamais eu la clé : il a seulement remplacé une empreinte.";
  render();
  await ask([{ label: "Suite", act: "ok", primary: true }]);
}

async function chapter7() {
  ui.chapter = 8; ui.stages = []; ui.agentNote = "";
  ui.title = "La carte de l'équipe : où ça coince, jamais qui";
  const rows = await A("claire").team.pull(0);
  const steps = new Map<string, { n: number; solved: boolean; certified: boolean }>();
  for (const r of rows) {
    const d = r.data ?? {};
    const e = steps.get(d.step) ?? { n: 0, solved: false, certified: false };
    if (r.kind === "signature") e.n++;
    if (r.kind === "solution") { e.solved = true; e.certified ||= Boolean(d.certified); }
    if (d.step) steps.set(d.step, e);
  }
  ui.map = [...steps.entries()].filter(([, e]) => e.n).sort((a, b) => b[1].n - a[1].n)
    .map(([step, e]) => ({ step, n: e.n, status: e.certified ? "✓ règle certifiée" : e.solved ? "solution partagée" : "⚠ sans solution : à documenter" }));
  ui.mapCommand = `./teamstore/start.sh carte --lien "${A("claire").team.invite()}"`;
  ui.what = "Chaque friction a laissé une **signature anonyme** (l'étape, le type, le jour). Additionnées, elles montrent à la responsable **où l'équipe perd du temps**.";
  ui.why = "On mesure le **process**, jamais la personne : impossible de savoir qui a bloqué. La même carte s'affiche dans Screenpipe (carte d'Andrea).";
  render();
  await ask([{ label: "Terminer", act: "ok", primary: true }]);
  ui.done = true; ui.chapter = 9; render();
}

// ---------- affichage ----------
function notifHtml(n: Notif) {
  return `<div class="sp-notif ${n.tone ?? ""}"><div class="sp-app">screenpipe · friction-assist</div><div class="sp-title">${esc(n.title)}</div><div class="sp-body">${md(n.body)}</div>
    ${n.buttons?.length ? `<div class="sp-actions">${n.buttons.map((b) => `<button ${b.act ? `data-act="${b.act}"` : ""} class="${b.primary ? "primary" : ""}">${esc(b.label)}</button>`).join("")}</div>` : ""}</div>`;
}
function screenHtml() {
  const tabs = [["crisp", "Crisp"], ["hubspot", "HubSpot"], ["slack", "Slack"], ["notion", "Notion"]].map(([k, l]) => `<span class="tab ${ui.tab === k ? "on" : ""}">${l}</span>`).join("");
  let body = "";
  if (ui.tab === "crisp") body = ui.crisp.length ? ui.crisp.map((m) => `<div class="msg ${m.who === ui.screenOwner || m.who === "Léa" ? "me" : ""}"><b>${esc(m.who)}</b> <span class="muted">${esc(m.when)}</span><br>${esc(m.text)}</div>`).join("") : `<p class="muted">Boîte de réception Crisp</p>`;
  if (ui.tab === "hubspot") body = `<div class="search">🔎 <span>${esc(ui.hubspot.query)}</span></div><div class="result ${ui.hubspot.result.startsWith("0") ? "zero" : ""}">${esc(ui.hubspot.result)}</div>`;
  if (ui.tab === "slack") body = `<div class="muted">#support</div>${ui.slack.map((m) => `<div class="msg me"><b>${esc(m.who)}</b><br>${esc(m.text)}</div>`).join("")}`;
  if (ui.tab === "notion") body = `<div class="notion"><div class="muted">Notion · Process support (février 2025)</div><h4>Geste commercial</h4><p class="stale">« Jusqu'à 2 mois offerts, quelle que soit l'offre. »</p><span class="badge red">page périmée</span></div>
    <div class="msg"><b>Claire Morin</b> <span class="muted">Slack · #support</span><br>« La page Notion n'est plus à jour : <b>1 mois max</b>, Premium ou Groupe seulement, sinon un bon de 10 %. »</div>`;
  return `<div class="screen-head"><b>Écran de ${esc(ui.screenOwner)}</b><div class="tabs">${tabs}</div></div><div class="screen-body">${body}</div>${ui.leaNotif ? notifHtml(ui.leaNotif) : ""}`;
}
function render() {
  $("progress").innerHTML = CHAPTERS.map((c, i) => `<span class="${i + 1 < ui.chapter ? "done" : i + 1 === ui.chapter ? "on" : ""}">${i + 1}. ${c}</span>`).join("");
  if (ui.done) {
    $("story").innerHTML = `<h2>Ce que tu viens de voir</h2>
      <ol class="recap"><li><b>Aide immédiate</b> : une solution déjà connue arrive au bon moment, rien ne sort du poste.</li>
      <li><b>Demande anonyme</b> : sinon l'équipe est sollicitée sans savoir qui bloque ; le serveur ne lit rien.</li>
      <li><b>Certification</b> : la responsable valide la bonne règle, infalsifiable.</li>
      <li><b>Escalade</b> : si personne ne sait, le bon canal Slack et un message prêt.</li>
      <li><b>La nuit</b> : le poste relit ce qui a suivi, l'IA propose la règle trouvée, la responsable la certifie le matin.</li>
      <li><b>Mémoire d'équipe</b> : le lendemain, la friction ne se repaie pas.</li>
      <li><b>Départ</b> : on change la clé, rien n'est perdu.</li>
      <li><b>Carte</b> : où ça coince, jamais qui.</li></ol>
      <div class="next"><a class="btn primary" href="/parcours">Rejouer</a> <a class="btn" href="/equipe">Voir l'équipe simulée (5 postes)</a> <a class="btn" href="/moi">L'utiliser avec mes collègues</a></div>`;
  } else {
    $("story").innerHTML = `<div class="chap">Chapitre ${ui.chapter} / 8</div><h2>${esc(ui.title)}</h2>
      <p class="what">${md(ui.what)}</p>${ui.why ? `<p class="why"><b>Pourquoi ça compte</b> · ${md(ui.why)}</p>` : ""}
      ${ui.countdown ? `<p class="countdown">Personne ne répond… ${ui.countdown}</p>` : ""}
      <div class="acts">${ui.actions.map((a) => `<button data-act="${a.act}" class="${a.primary ? "primary pulse" : ""}">${esc(a.label)}</button>`).join("")}</div>`;
  }
  $("screen").innerHTML = screenHtml();
  $("agent").innerHTML = `<h3>Ce que fait l'agent sur le poste de ${esc(ui.screenOwner)}</h3>${ui.stages.length ? ui.stages.map((s) => `<div class="stage ${s.state}"><span class="ic">${s.icon}</span><div><b>${esc(s.label)}</b><div>${md(s.detail || "…")}</div></div></div>`).join("") : ui.agentNote ? `<p class="note">${md(ui.agentNote)}</p>` : '<p class="muted">—</p>'}
    ${ui.reveal ? `<div class="reveal"><div><b>Ce que lit l'équipe</b><pre>${esc(ui.reveal.team)}</pre></div><div><b>Ce que voit le serveur</b><pre class="ct">${esc(ui.reveal.server)}</pre></div></div>` : ""}
    ${ui.map.length ? `<table class="map"><tr><th>Étape</th><th>Détours</th><th>État</th></tr>${ui.map.map((m) => `<tr><td>${esc(m.step)}</td><td>${m.n}</td><td>${esc(m.status)}</td></tr>`).join("")}</table>
      <p class="muted">Dans Screenpipe : <code>${esc(ui.mapCommand.slice(0, 60))}…</code> <button data-copy="${esc(ui.mapCommand)}">Copier la commande</button></p>` : ""}`;
  $("team").innerHTML = `<h3>L'équipe Support</h3>${actors.filter((a) => a.id !== "lea" || ui.screenOwner !== "Léa").filter((a) => a.id !== "yasmine" || ui.screenOwner !== "Yasmine").map((a) => `
    <div class="member ${a.revoked ? "revoked" : ""}"><div class="who"><span class="av">${a.avatar}</span><div><b>${esc(a.name)}</b><div class="muted">${esc(a.role)}</div></div></div>
      ${a.notif ? notifHtml(a.notif) : `<div class="st">${esc(a.status)}</div>`}
      <div class="mem">${a.solutions.map((s) => `<span class="chip ${s.certified ? "cert" : s.forged ? "bad" : ""}">${s.certified ? "✓ " : s.forged ? "⚠ non certifiée · " : ""}${esc(s.title.split(":")[0])}</span>`).join("")}</div></div>`).join("")}
    <div class="member mine"><div class="muted">Mémoire de ${esc(ui.screenOwner)} :</div><div class="mem">${(A(ui.screenOwner === "Léa" ? "lea" : "yasmine")?.solutions ?? []).map((s) => `<span class="chip ${s.certified ? "cert" : s.forged ? "bad" : ""}">${s.certified ? "✓ " : s.forged ? "⚠ non certifiée · " : ""}${esc(s.title.split(":")[0])}</span>`).join("") || '<span class="muted">vide</span>'}</div></div>`;
}

async function renderServer() {
  const v = await fetch("/api/operator").then((r) => r.json()).catch(() => ({ note: "indisponible" }));
  if (v.note || v.error) { $("server").innerHTML = `<p class="muted">${esc(v.note ?? v.error)}</p>`; return; }
  const blobs = (v.blobs as any[]).filter((b) => teamIds.has(b.team_id)).slice(0, 8);
  $("server").innerHTML = `<table><tr><th>n°</th><th>équipe</th><th>type</th><th>époque</th><th>taille</th><th>contenu</th></tr>
    ${blobs.map((b, i) => `<tr class="${i === 0 ? "fresh" : ""}"><td>${b.seq}</td><td><code>${esc(b.team_id.slice(0, 8))}…</code></td><td>${esc(b.kind)}</td><td>${b.epoch}</td><td>${b.size}</td><td><code class="ct">${esc(b.ciphertext.slice(0, 70))}…</code></td></tr>`).join("") || '<tr><td colspan="6" class="muted">rien encore</td></tr>'}</table>
    <p class="muted">Pas de nom d'équipe, pas d'auteur, pas d'heure, et tous les blocs ont la même taille.</p>`;
}

// ---------- tableau « Frictions en direct » : la vue de la responsable, mise à jour en continu ----------
const board = new Board();
let boardCursor = 0, boardEpoch = 0, lastLive = { sig: "", at: 0 };
async function feedBoard() {
  const claire = actors.find((a) => a.id === "claire");
  if (!claire) return;
  if (claire.team.epoch !== boardEpoch) { boardEpoch = claire.team.epoch; }
  const rows = await claire.team.pull(boardCursor).catch(() => []);
  for (const r of rows) boardCursor = Math.max(boardCursor, r.seq);
  board.add(claire.team.id, claire.team.name, claire.team.epoch, rows);
  const st = board.state();
  $("board").innerHTML = Board.html(st);
  const live = $("live") as HTMLInputElement;
  if (!live.checked || !cfg.liveView) { $("live-status").textContent = cfg.liveView ? "" : "(jeton Screenpipe absent : tableau dans la page seulement)"; return; }
  const sig = JSON.stringify([st.pending.map((p) => p.requestId), st.today, st.resolved.length, st.certified, st.timeline.length, st.steps]);
  if (sig === lastLive.sig && Date.now() - lastLive.at < 5000) return;
  lastLive = { sig, at: Date.now() };
  const r = await fetch("/api/live", { method: "POST", headers: H, body: JSON.stringify({ blocks: Board.liveView(st) }) }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
  $("live-status").textContent = r.ok ? `publié dans Screenpipe à ${new Date().toLocaleTimeString("fr-FR")}` : `Live View : ${r.error}`;
}

// ---------- lancement ----------
$("story").innerHTML = `<h2>Préparation de l'équipe…</h2>`;
await setup();
setInterval(renderServer, 1500);
let feeding = false;
setInterval(async () => { if (feeding) return; feeding = true; try { await feedBoard(); } finally { feeding = false; } }, 1500);
render();
for (const ch of [chapter1, chapter2, chapter3, chapter4, chapterNight, chapter5, chapter6, chapter7]) await ch();
