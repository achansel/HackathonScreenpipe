// Boucle de nuit : « la mémoire qui se nourrit seule » (idée de Minguk).
// Pour chaque friction de la journée restée sans réponse, on relit ce que la personne a vu à l'écran dans les
// 15 minutes QUI ONT SUIVI (Screenpipe), et l'IA dit si elle s'en est sortie, et comment.
//   - résolue     → une PROPOSITION de règle (générale, sans nom ni donnée client), chiffrée, à valider par la
//                   responsable : les démons ne s'en servent pas tant qu'elle n'est pas certifiée ;
//   - non résolue → une FRICTION EN ATTENTE pour la responsable (l'étape, pas la personne).
// Le texte de l'écran ne quitte jamais le poste, sauf vers le modèle choisi dans Screenpipe (comme le démon).
// Réutilise sans les modifier : search, chat (agent/screenpipe.ts), redact (agent/qualify.ts).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { routeTeams, type Team } from "./client";
import { sha256hex } from "./crypto";

export interface NightCase { step: string; at: number; requestId?: string; context: string; label?: string }
export interface Finding { step: string; resolved: boolean; title?: string; body?: string; how?: string; confidence: number; requestId?: string; label?: string }

const AFTER_MS = 15 * 60_000;
const MAX_CONTEXT = 8000;
const MIN_CONFIDENCE = 0.7;

const PROMPT = `Tu relis ce qu'une employée du support a vu à l'écran dans les 15 minutes APRÈS avoir bloqué sur une étape de process.
Dis si elle a trouvé comment faire, et si oui, formule la RÈGLE GÉNÉRALE que toute l'équipe pourra réutiliser.
- resolved : true seulement si le texte montre clairement la solution (une réponse d'un collègue, une page, un chemin dans un outil). Une question restée sans réponse, « je reviens vers vous », ou une exception accordée une seule fois (« pour ce client, cette fois ») : false, ce n'est pas une règle.
- title : la règle en une ligne (60 caractères max), forme « Sujet : ce qu'il faut faire ».
- body : une ou deux phrases d'explication.
- JAMAIS de nom de personne, de client, de restaurant, d'e-mail, de téléphone, de montant propre à un client. Des rôles (« la responsable support », « les commerciaux Belgique ») si besoin.
- how : slack | doc | crm | collegue | autre.
Réponds uniquement par un JSON : {"resolved":bool,"title":"","body":"","how":"","confidence":0.0}`;

/** Ce qui identifierait quelqu'un dans une règle : refusé avant publication (la responsable relit en plus). */
// Les prénoms sont cherchés AVEC majuscule : sinon « 1 mois offert max » passait pour « Max » (mesuré, nuit-eval).
const CONTACT = /[\w.+-]+@[\w-]+\.|(?:\+|00)\d[\d .-]{8,}|\b0\d(?:[ .-]?\d{2}){4}\b/i;
const NAMES = /(?<![\p{L}])(Léa|Claire|Karim|Yasmine|Thomas|Nadia|Sarah|Antoine|Max|Hugo|Jean|Kenji|Élodie|Pieter|Mounia)(?![\p{L}])/u;
export const IDENTIFYING = { test: (s: string) => CONTACT.test(s) || NAMES.test(s) };

export async function judge(c: NightCase, chat: (s: string, u: string, n?: number) => Promise<string>, redact: (s: string) => string): Promise<Finding> {
  const out = await chat(PROMPT, `Étape où elle a bloqué : ${c.step}\n\nCe qu'elle a vu ensuite :\n${redact(c.context).slice(0, MAX_CONTEXT)}`, 600);
  let v: any = {};
  try { v = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch {}
  const leaked = IDENTIFYING.test(`${v.title ?? ""} ${v.body ?? ""}`);
  const resolved = Boolean(v.resolved) && Number(v.confidence) >= MIN_CONFIDENCE && Boolean(v.title) && !leaked;
  return { step: c.step, resolved, title: resolved ? String(v.title).slice(0, 80) : undefined, body: resolved ? String(v.body ?? "").slice(0, 400) : undefined,
    how: v.how, confidence: Number(v.confidence) || 0, requestId: c.requestId, label: c.label };
}

/** Les frictions du jour restées sans réponse sur CE poste : les demandes anonymes du démon d'Andrea (events.jsonl)
 *  qui n'ont reçu aucune solution de l'équipe. */
export function dayCases(root: string, since: number): Omit<NightCase, "context">[] {
  const base = join(root, "agent", ".state");
  if (!existsSync(base)) return [];
  const files = [join(base, "events.jsonl"), ...readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(base, d.name, "events.jsonl"))];
  const asked: Omit<NightCase, "context">[] = [];
  const solved = new Set<string>();
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        const at = Date.parse(e.at);
        if (at < since) continue;
        if (e.kind === "asked" && e.step) asked.push({ step: e.step, at, requestId: e.requestId });
        if (e.kind === "solved" && e.requestId) solved.add(e.requestId);
      } catch {}
    }
  }
  return asked.filter((a) => !a.requestId || !solved.has(a.requestId));
}

/** Ce que la personne a vu dans les 15 minutes après la friction, dans les outils de travail seulement. */
export async function contextAfter(at: number, search: (p: Record<string, string>, max?: number) => Promise<any[]>, scope: RegExp): Promise<string> {
  const range = { start_time: new Date(at).toISOString(), end_time: new Date(at + AFTER_MS).toISOString() };
  const frames = [...await search({ content_type: "ocr", ...range }, 600), ...await search({ content_type: "accessibility", ...range }, 600).catch(() => [])];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const f of frames.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    const where = `${f.app_name ?? ""} ${f.window_name ?? ""} ${f.browser_url ?? ""}`;
    if (!scope.test(where)) continue;
    for (const l of String(f.text ?? "").split(/\n+/).map((x) => x.trim()).filter((x) => x.length > 3)) {
      if (seen.has(l)) continue;
      seen.add(l);
      lines.push(l);
    }
  }
  return lines.join("\n").slice(-MAX_CONTEXT);
}

/** Publie les résultats de la nuit dans les équipes concernées (routage par périmètre, comme les demandes). */
export async function publish(findings: Finding[], teams: Team[]) {
  const day = new Date().toISOString().slice(0, 10);
  let proposals = 0, pending = 0;
  for (const f of findings) {
    const targets = routeTeams(teams, f.step);
    const id = `nuit-${(await sha256hex(f.resolved ? `${f.title}` : f.step)).slice(0, 10)}`;
    const payload = f.resolved
      ? { type: "proposition", id, step: f.step, title: f.title, body: f.body, how: f.how, confidence: f.confidence, day, requestId: f.requestId }
      : { type: "attente", id, step: f.step, day, requestId: f.requestId };
    for (const t of targets) await t.publish("candidate", payload);
    if (targets.length) f.resolved ? proposals++ : pending++;
  }
  return { proposals, pending };
}

// ---- l'exemple préparé (annoncé comme tel) : des fils du Slack de PipingTable (integrations/src/seed/slack-story.ts),
// vus après quatre frictions de Léa. Le modèle juge pour de vrai ; seuls les textes d'écran sont préparés.
export const EXEMPLE: NightCase[] = [
  { label: "dédommagement", step: "Crisp : un client demande un dédommagement", at: 0, context: [
    "Slack #support", "Yasmine Roche : Un client premium demande un dédommagement après la panne de mardi. J'ai le droit de faire quoi ?",
    "Claire Morin : Règle : 1 mois offert maximum, et seulement pour les Premium ou Groupe. Sinon, un bon de 10 %. Et toujours la note « geste commercial » dans HubSpot.",
    "Claire Morin : (la page Notion dit encore 2 mois, elle n'est plus à jour)", "Crisp · Léa : Je vous offre un mois d'abonnement, c'est noté sur votre dossier."].join("\n") },
  { label: "offre du client", step: "HubSpot : retrouver l'offre souscrite par un client", at: 0, context: [
    "Slack #support", "Léa : Où est-ce qu'on voit l'offre d'un client ? La fiche contact ne l'affiche pas",
    "Karim Bensaïd : Contact → Entreprise → Transactions → le contrat signé → Produits. 4 clics, oui",
    "HubSpot · Le Bistro · Transactions · Contrat signé 2026-03-12 · Produits : Offre Premium, Rappels SMS, Acompte anti no-show"].join("\n") },
  { label: "prospect belge", step: "HubSpot : créer un prospect venu du chat", at: 0, context: [
    "Crisp · Pieter Janssens : Combien pour 3 restaurants ? Nous sommes à Bruxelles.", "HubSpot · recherche « Brasserie des Arts » · 0 contacts",
    "Slack #new-leads (épinglé) · Sarah Lambert : Rappel : les prospects belges sont pour moi. Créez le contact en « Lead » dans HubSpot et postez-le ici, je reprends",
    "HubSpot · Créer un contact · Cycle de vie : Lead", "Slack #new-leads · Léa : Lead : Brasserie des Arts (Bruxelles), 3 sites, demande de prix sur le chat."].join("\n") },
  { label: "facture introuvable", step: "Retrouver la facture d'un client", at: 0, context: [
    "Crisp · Kenji Mori : Bonjour, je ne trouve pas ma facture de septembre.", "HubSpot · recherche « facture » · 0 résultat",
    "Notion · recherche « facture » · Aucun résultat", "Slack #support · Léa : On trouve où les factures des clients ?",
    "Crisp · Léa : Je me renseigne et je reviens vers vous rapidement."].join("\n") },
];
