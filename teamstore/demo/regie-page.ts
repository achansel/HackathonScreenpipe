// Régie de répétition : on joue le déroulé d'Andrea (andrea/docs/demo.md) avec les VRAIS outils (Crisp, HubSpot,
// Slack, le démon, Screenpipe), et la page coche chaque étape quand la vraie réaction arrive, chronomètre en main.
// Elle ne décide rien et ne lit pas l'écran : elle observe (voir teamstore/regie.ts).
import { Board, type BoardState } from "./board";

type Signals = {
  now: number;
  checks: { id: string; label: string; ok: boolean; detail: string }[];
  notifications: { at: number; id: string; title: string; body: string }[];
  clicks: { at: number; label: string; type: string }[];
  events: { at: number; instance: string; kind: string; detail: string }[];
  board: BoardState | null;
  live: string;
};
type Evidence = { at: number; what: string };
type Step = {
  id: string; role: "lea" | "karim"; title: string; gesture: string;
  actions?: { label: string; href?: string; copy?: string }[];
  expect?: { label: string; target: number; timeout: number; match: (s: Signals, start: number) => Evidence | null };
  fallback?: string;
};

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hms = (t: number) => new Date(t).toLocaleTimeString("fr-FR");

// Clients de répétition (docs/crisp.md) : Jean d'abord, puis d'autres pour rejouer sans l'anti-répétition
// de 10 min du démon. Adresses en .test : aucun morceau ne correspond à un contact HubSpot (0 résultat garanti).
const CUSTOMERS = [
  { name: "Jean Dupont", email: "jd.resto75@resa-paris.test", note: "la démo" },
  { name: "Kenji Mori", email: "km.0412@zvk.test", note: "répétition" },
  { name: "Élodie Marchand", email: "em.2207@qmx.test", note: "répétition" },
  { name: "Luc Fabre", email: "lf.1903@wpx.test", note: "répétition" },
];
const crispLink = (c: (typeof CUSTOMERS)[number]) => `https://go.crisp.chat/chat/embed/?website_id=7dc5c68e-4cc3-4480-879d-15eee53f96e9&user_nickname=${encodeURIComponent(c.name)}&user_email=${encodeURIComponent(c.email)}&locale=fr`;
const HUBSPOT_CONTACTS = "https://app-eu1.hubspot.com/contacts/149568075/objects/0-1/views/all/list";
const SLACK_SUPPORT = "https://app.slack.com/client/T0CAR1HU95W/C0C9ZBHECDU";
const MSG_PANNE = "Bonjour, ma page de réservation est en panne, les clients ne peuvent plus réserver.";
const MSG_GESTE = "Toujours rien… J'ai perdu des réservations ce midi, je veux un dédommagement.";
const MSG_SLACK = "On peut offrir quelque chose à un client premium ?";

const S = JSON.parse(localStorage.getItem("fa-regie") ?? "null") ?? { since: 0, role: "lea", customer: 0, starts: {}, done: {}, live: true };
const save = () => localStorage.setItem("fa-regie", JSON.stringify(S));
const cust = () => CUSTOMERS[S.customer] ?? CUSTOMERS[0];
const after = <T extends { at: number }>(xs: T[], t: number) => xs.filter((x) => x.at >= t);

function steps(): Step[] {
  const c = cust();
  return [
    { id: "l-ecran", role: "lea", title: "Préparer l'écran de Léa", gesture: `Crisp au premier plan (liste des conversations), HubSpot ouvert sur la <b>liste des contacts</b> (pas une fiche). <b>Aucune recherche HubSpot avant le message du client.</b> Terminal et Claude hors de l'écran (l'OCR leur prend du texte). Démon lancé avec <code>FRICTION_SEED_IDS=client-introuvable FRICTION_REQUEST_JITTER=0</code>.`,
      actions: [{ label: "Ouvrir les contacts HubSpot", href: HUBSPOT_CONTACTS }] },
    { id: "l-message", role: "lea", title: `${c.name} écrit dans Crisp`, gesture: `Envoyer le message du client depuis son chat Crisp (ou le simulateur de Minguk lancé avec <code>--sans-aide</code>). <b>Un seul message</b> avant la recherche.`,
      actions: [{ label: `Ouvrir le chat de ${c.name}`, href: crispLink(c) }, { label: "Copier le message", copy: MSG_PANNE }, { label: "Simulateur de Minguk", href: "http://127.0.0.1:4518" }] },
    { id: "l-fiche", role: "lea", title: "Léa cherche le client dans HubSpot", gesture: `Ouvrir la conversation, <b>copier</b> l'adresse <code>${esc(c.email)}</code>, la <b>coller</b> dans la recherche des contacts : « 0 contacts ». Rester 5 s.`,
      actions: [{ label: "Copier l'adresse", copy: c.email }, { label: "Ouvrir la recherche HubSpot", href: `${HUBSPOT_CONTACTS}?query=${encodeURIComponent(c.email)}` }],
      expect: { label: `Notification « Client : ${c.name} · … » (ou « Client introuvable »)`, target: 10, timeout: 45,
        match: (s, t) => { const n = after(s.notifications, t).find((x) => /client\s*:|introuvable|fiche/i.test(x.title)); return n ? { at: n.at, what: `🔔 ${n.title}` } : null; } },
      fallback: "Pas de notification : vérifier le démon (« épisode … »), Chrome (pas Firefox), la clé HubSpot. Repli : <code>bun andrea/daemon/main.ts injecter lea \"…\"</code> en simulation." },
    { id: "l-aide", role: "lea", title: "Léa clique « Ça m'a aidé »", gesture: "Dans la notification, cliquer <b>Ça m'a aidé</b> (ou [Y aller] pour ouvrir la fiche).",
      expect: { label: "Clic reçu par Screenpipe ou par le démon", target: 15, timeout: 90,
        match: (s, t) => { const c1 = after(s.clicks, t).find((x) => /aid|aller/i.test(x.label)); if (c1) return { at: c1.at, what: `👆 ${c1.label}` }; const e = after(s.events, t).find((x) => /click|feedback/.test(x.kind)); return e ? { at: e.at, what: `⚙️ ${e.kind} ${e.detail}` } : null; } } },
    { id: "l-demande", role: "lea", title: "Dédommagement : Léa demande sur Slack", gesture: `Le client écrit le 2e message. Léa écrit dans <b>#support</b> : « ${esc(MSG_SLACK)} ». Le démon n'a pas la solution : demande anonyme à l'équipe.`,
      actions: [{ label: "Copier le message du client", copy: MSG_GESTE }, { label: "Ouvrir Slack #support", href: SLACK_SUPPORT }, { label: "Copier la question de Léa", copy: MSG_SLACK }],
      expect: { label: "Demande anonyme envoyée (démon) ou visible dans l'équipe", target: 20, timeout: 90,
        match: (s, t) => { const e = after(s.events, t).find((x) => x.kind === "asked"); if (e) return { at: e.at, what: `⚙️ demande anonyme · ${e.detail}` }; const p = s.board?.pending.find((x) => x.since >= t); return p ? { at: p.since, what: `🔒 en attente · ${p.step}` } : null; } },
      fallback: "Rien ne part : l'IA a pu juger que ce n'était pas une friction (rejouer la question), ou le délai d'anonymat n'est pas à 0." },
    { id: "l-reponse", role: "lea", title: "L'équipe répond", gesture: "Côté Karim : « Un collègue bloque » puis <b>Partager</b>. Côté Léa : rien à faire.",
      expect: { label: "Notification « Geste commercial : … » chez Léa", target: 15, timeout: 120,
        match: (s, t) => { const n = after(s.notifications, t).find((x) => /geste|dédommag|offert/i.test(x.title)); if (n) return { at: n.at, what: `🔔 ${n.title}` }; const e = after(s.events, t).find((x) => x.kind === "solved"); return e ? { at: e.at, what: "⚙️ solution reçue de l'équipe" } : null; } } },
    { id: "l-carte", role: "lea", title: "La carte et le tableau dans Screenpipe", gesture: "Ouvrir la carte d'Andrea (la semaine) et « Frictions en direct » (maintenant).",
      actions: [{ label: "Carte des frictions", href: "screenpipe://live-view/friction-map" }, { label: "Frictions en direct", href: "screenpipe://live-view/friction-live" }] },
    { id: "k-pret", role: "karim", title: "Préparer le poste de Karim", gesture: "Démon lancé avec les solutions de démo (graine par défaut). Sur Mac : Screenpipe <b>patché</b> (boutons <code>api</code>), sinon la page « Mon poste » en repli.",
      actions: [{ label: "Mon poste (repli)", href: "/moi" }] },
    { id: "k-recoit", role: "karim", title: "Karim reçoit « Un collègue bloque »", gesture: "Attendre la demande de Léa.",
      expect: { label: "Notification « Un collègue bloque : … »", target: 10, timeout: 180,
        match: (s, t) => { const n = after(s.notifications, t).find((x) => /coll[eè]gue bloque/i.test(x.title)); if (n) return { at: n.at, what: `🔔 ${n.title}` }; const e = after(s.events, t).find((x) => x.kind === "share-asked"); return e ? { at: e.at, what: `⚙️ ${e.kind}` } : null; } } },
    { id: "k-partage", role: "karim", title: "Karim clique « Partager »", gesture: "Dans la notification, cliquer <b>Partager</b>.",
      expect: { label: "Partage reçu (clic ou démon)", target: 10, timeout: 120,
        match: (s, t) => { const c1 = after(s.clicks, t).find((x) => /partag/i.test(x.label)); if (c1) return { at: c1.at, what: `👆 ${c1.label}` }; const e = after(s.events, t).find((x) => x.kind === "shared"); return e ? { at: e.at, what: "⚙️ solution partagée" } : null; } } },
  ].filter((x) => x.role === S.role) as Step[];
}

// ---------- boucle ----------
let sig: Signals | null = null;
async function poll() {
  if (!S.since) { render(); return; }
  sig = await fetch(`/api/regie?since=${S.since}&live=${S.live ? 1 : 0}`).then((r) => r.json()).catch(() => sig);
  if (!sig) return;
  const list = steps();
  const current = list.find((x) => !S.done[x.id]);
  if (current?.expect) {
    S.starts[current.id] ??= Date.now();
    const ev = current.expect.match(sig, S.starts[current.id]);
    if (ev) { S.done[current.id] = { at: ev.at, what: ev.what, delay: Math.round((ev.at - S.starts[current.id]) / 1000) }; const next = list[list.indexOf(current) + 1]; if (next) S.starts[next.id] = Date.now(); save(); }
  }
  render();
}

function render() {
  const list = steps();
  const current = list.find((x) => !S.done[x.id]);
  $("checks").innerHTML = sig ? sig.checks.map((c) => `<div class="chk ${c.ok ? "ok" : "ko"}">${c.ok ? "✓" : "✗"} ${esc(c.label)}${c.detail ? `<small>${esc(c.detail)}</small>` : ""}</div>`).join("") : '<p class="muted">Démarrer la répétition pour vérifier les outils.</p>';
  $("steps").innerHTML = list.map((st, i) => {
    const d = S.done[st.id];
    const on = st === current && S.since;
    const started = S.starts[st.id];
    const elapsed = on && started ? Math.round((Date.now() - started) / 1000) : 0;
    const late = on && st.expect && elapsed > st.expect.timeout;
    return `<div class="rstep ${d ? "done" : on ? "on" : ""}">
      <div class="rhead"><span class="n">${d ? "✓" : i + 1}</span><b>${esc(st.title)}</b>${d?.delay !== undefined && st.expect ? `<span class="chrono ${d.delay <= st.expect.target ? "good" : "slow"}">${d.delay} s</span>` : ""}</div>
      ${on || !d ? `<div class="gesture">${st.gesture}</div>` : ""}
      ${on && st.actions ? `<div class="ractions">${st.actions.map((a) => a.href ? `<a class="btn" href="${esc(a.href)}" target="_blank" rel="noopener">${esc(a.label)}</a>` : `<button data-copy="${esc(a.copy)}">${esc(a.label)}</button>`).join("")}</div>` : ""}
      ${st.expect ? `<div class="expect">${d ? `Vu à ${hms(d.at)} : ${esc(d.what)}` : `Attendu : ${esc(st.expect.label)} (≈ ${st.expect.target} s)${on && started ? ` · <b>${elapsed} s</b>` : ""}`}</div>` : ""}
      ${late && st.fallback ? `<div class="fallback">${st.fallback}</div>` : ""}
      ${on ? `<div class="ractions">${st.expect ? `<button data-skip="${st.id}">Passer</button>` : `<button class="primary" data-ok="${st.id}">Fait</button>`}</div>` : ""}
    </div>`;
  }).join("");
  const feed = sig ? [
    ...sig.notifications.map((n) => ({ at: n.at, t: "🔔 Screenpipe a affiché", d: n.title })),
    ...sig.clicks.map((c) => ({ at: c.at, t: "👆 Clic sur un bouton", d: c.label })),
    ...sig.events.map((e) => ({ at: e.at, t: `⚙️ Démon (${e.instance})`, d: `${e.kind}${e.detail ? ` · ${e.detail}` : ""}` })),
  ].sort((a, b) => b.at - a.at).slice(0, 30) : [];
  $("feed").innerHTML = feed.map((f) => `<div class="ev"><span class="muted">${hms(f.at)}</span> <b>${esc(f.t)}</b><br>${esc(f.d)}</div>`).join("") || '<p class="muted">Aucune réaction depuis le début de la répétition.</p>';
  $("board").innerHTML = sig?.board ? Board.html(sig.board) : `<p class="muted">${sig ? "L'équipe n'est pas lisible ici (voir les vérifications)." : ""}</p>`;
  $("live-status").textContent = sig?.live ? `publiée dans Screenpipe à ${hms(sig.now)}` : "";
  $("since").textContent = S.since ? `répétition commencée à ${hms(S.since)}` : "";
  const total = list.filter((x) => x.expect && S.done[x.id]?.delay !== undefined);
  $("report").innerHTML = total.length ? `Mesuré : ${total.map((x) => `${esc(x.title)} <b>${S.done[x.id].delay} s</b>`).join(" · ")}` : "";
  (document.getElementById("role") as HTMLSelectElement).value = S.role;
  (document.getElementById("customer") as HTMLSelectElement).value = String(S.customer);
  (document.getElementById("live") as HTMLInputElement).checked = S.live;
}

document.getElementById("customer")!.innerHTML = CUSTOMERS.map((c, i) => `<option value="${i}">${esc(c.name)} · ${esc(c.email)} (${c.note})</option>`).join("");
document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const copy = t.closest("[data-copy]") as HTMLElement | null;
  if (copy) navigator.clipboard.writeText(copy.dataset.copy!).then(() => { copy.textContent = "Copié"; });
  const ok = t.closest("[data-ok]") as HTMLElement | null;
  const skip = t.closest("[data-skip]") as HTMLElement | null;
  const id = ok?.dataset.ok ?? skip?.dataset.skip;
  if (id) {
    S.done[id] = { at: Date.now(), what: skip ? "passé" : "fait" };
    const list = steps(); const next = list[list.findIndex((x) => x.id === id) + 1];
    if (next) S.starts[next.id] = Date.now();
    save(); render();
  }
  if (t.id === "start") { Object.assign(S, { since: Date.now(), starts: {}, done: {} }); save(); poll(); }
  if (t.id === "copy-report") {
    const lines = steps().map((x) => `- ${S.done[x.id] ? "✓" : "✗"} ${x.title}${S.done[x.id]?.delay !== undefined && x.expect ? ` : ${S.done[x.id].delay} s` : ""}${S.done[x.id]?.what ? ` (${S.done[x.id].what})` : ""}`);
    navigator.clipboard.writeText(`Répétition ${S.role === "lea" ? "Léa" : "Karim"} du ${new Date(S.since).toLocaleString("fr-FR")}, client ${cust().name}\n${lines.join("\n")}`);
    t.textContent = "Copié";
  }
});
document.getElementById("role")!.addEventListener("change", (e) => { S.role = (e.target as HTMLSelectElement).value; save(); render(); });
document.getElementById("customer")!.addEventListener("change", (e) => { S.customer = Number((e.target as HTMLSelectElement).value); save(); render(); });
document.getElementById("live")!.addEventListener("change", (e) => { S.live = (e.target as HTMLInputElement).checked; save(); });
render();
setInterval(poll, 1500);
setInterval(render, 1000);
