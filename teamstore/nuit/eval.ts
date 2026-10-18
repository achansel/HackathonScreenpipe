// Évaluation de la boucle de nuit avec le VRAI modèle (celui de Screenpipe, choisi par le démon d'Andrea).
// 20 cas étiquetés « résolue / non résolue » (10 / 10), avec des pièges et des noms, e-mails, téléphones dans les
// contextes. Étiquettes écrites par Claude d'après les scénarios PipingTable : PAS une vérité humaine.
//   source ~/.config/screenpipe/env && bun teamstore/nuit/eval.ts [--tirages 2]
// Résultat : mesures/nuit-eval.json (+ tableau affiché).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IDENTIFYING, judge, type NightCase } from "./index";

const { chat } = await import("../../agent/screenpipe");
const { redact } = await import("../../agent/qualify");
const { MODEL } = await import("../../agent/config");
const DRAWS = Number(process.argv[process.argv.indexOf("--tirages") + 1] || 2);

type Labeled = NightCase & { expect: boolean; trap?: string };
const c = (label: string, expect: boolean, step: string, lines: string[], trap?: string): Labeled => ({ label, expect, step, at: 0, context: lines.join("\n"), trap });

const CASES: Labeled[] = [
  // ---- résolues (10)
  c("dédommagement", true, "Crisp : un client demande un dédommagement", ["Slack #support", "Yasmine Roche : Un client premium demande un dédommagement, j'ai le droit à quoi ?", "Claire Morin : 1 mois offert maximum, Premium ou Groupe seulement. Sinon un bon de 10 %. Note « geste commercial » dans HubSpot.", "Crisp · Léa : Je vous offre un mois, c'est noté."]),
  c("offre du client", true, "HubSpot : retrouver l'offre souscrite par un client", ["Slack #support · Léa : où on voit l'offre d'un client ?", "Karim Bensaïd : Contact → Entreprise → Transactions → contrat signé → Produits.", "HubSpot · Transactions · Contrat signé · Produits : Offre Premium, Rappels SMS"]),
  c("prospect belge", true, "HubSpot : créer un prospect venu du chat", ["Crisp · Pieter Janssens : Combien pour 3 restaurants à Bruxelles ?", "Slack #new-leads (épinglé) · Sarah Lambert : prospects belges → moi, contact en Lead, postez ici", "HubSpot · Créer un contact · Cycle de vie : Lead", "Slack #new-leads · Léa : Lead Brasserie des Arts, 3 sites"]),
  c("client introuvable", true, "HubSpot : retrouver le client d'un chat Crisp", ["HubSpot · recherche « jd.resto75@resa-paris.test » · 0 contacts", "Slack #support · Karim : les clients écrivent souvent avec une autre adresse, cherche par téléphone ou par le domaine du restaurant", "HubSpot · recherche « 06 39 98 41 07 » · 1 contact : Jean Dupont · Le Bistro"], "téléphone et nom dans le contexte"),
  c("signaler un bug", true, "Signaler un bug client à l'équipe tech", ["Slack #support · Léa : la page de réservation de Chez Mounia ne charge plus", "Karim : pas ici, les bugs vont dans #bugs avec le modèle épinglé, et le ticket HubSpot dans le pipeline « Support »", "Slack #bugs · Léa : [Bug] Chez Mounia · page blanche · Client : Mounia Haddad (Premium)"], "nom de client dans le contexte"),
  c("remise 20 %", true, "HubSpot : remise supérieure à 15 % bloquée", ["HubSpot · Transaction Osteria Nonna · remise 20 % · validation requise", "Slack #deal-desk · Antoine Rey : 20 % maximum sur ce volume. Au-delà de 15 %, toujours ici avant d'envoyer le contrat.", "Slack #deal-desk · Nadia : validation demandée pour Osteria Nonna"]),
  c("promesse d'un commercial", true, "HubSpot : vérifier une promesse faite par un commercial", ["Crisp · Élodie Marchand : Thomas m'avait promis l'installation gratuite", "Slack #support (épinglé) · Claire : une promesse d'un commercial doit être notée dans « Conditions particulières » de la transaction ; sinon on demande au commercial avant de confirmer", "HubSpot · Maison Pivoine · Conditions particulières : (vide)", "Slack DM · Léa → Thomas Girard : tu as promis l'installation gratuite à Maison Pivoine ?"]),
  c("pipeline du ticket (doc périmée)", true, "HubSpot : choisir le pipeline d'un ticket support", ["Notion · Process support (février 2025) : créer le ticket dans le pipeline « Support OLD »", "Slack #support · Karim : « Support OLD » est archivé, toujours le pipeline « Support »", "HubSpot · Nouveau ticket · Pipeline : Support"], "la doc contredit Slack"),
  c("tarif des options (doc)", true, "Notion : trouver le prix d'une option", ["Crisp · Kenji Mori : combien coûtent les rappels SMS ?", "Notion · Grille tarifaire 2026 · Options : Rappels SMS 15 €/mois, Acompte anti no-show 19 €/mois", "Crisp · Léa : Les rappels SMS sont à 15 € par mois."]),
  c("contact par domaine (CRM)", true, "HubSpot : retrouver le client d'un chat Crisp", ["HubSpot · recherche « km.0412@zvk.test » · 0 contacts", "HubSpot · recherche « sushikumo » · 1 entreprise : Sushi Kumo · 1 contact : Kenji Mori (kenji.mori@example.com)", "Crisp · Léa : Je vous ai retrouvé, merci de votre patience."], "e-mail dans le contexte"),
  // ---- non résolues (10)
  c("facture introuvable", false, "Retrouver la facture d'un client", ["HubSpot · recherche « facture » · 0 résultat", "Notion · recherche « facture » · Aucun résultat", "Slack #support · Léa : On trouve où les factures ?", "Crisp · Léa : Je me renseigne et je reviens vers vous."], "« je reviens vers vous »"),
  c("personne ne sait", false, "Changer l'heure d'envoi des SMS", ["Slack #support · Léa : on peut changer l'heure d'envoi des SMS de rappel ?", "Yasmine : aucune idée, demande à quelqu'un d'autre", "Crisp · Léa : je vérifie et je vous redis"], "réponse sans contenu"),
  c("passée à autre chose", false, "Retrouver un contrat signé", ["HubSpot · recherche « contrat Le Petit Zinc » · 0 résultat", "Slack #social · Hugo : qui vient manger ?", "Slack #social · Léa : moi ! 12 h 30"], "contexte hors sujet"),
  c("ça dépend", false, "Accorder un délai de paiement", ["Slack #support · Léa : un client demande un délai de paiement, on fait comment ?", "Karim : ça dépend des cas, faudrait voir avec quelqu'un"], "réponse vague"),
  c("blague", false, "Rembourser un acompte anti no-show", ["Slack #support · Léa : on rembourse un acompte no-show si le resto annule ?", "Max : 😅 bonne chance", "Léa : merci…"], "emoji seulement"),
  c("exception ponctuelle", false, "Accorder une remise exceptionnelle", ["Slack DM · Thomas : pour Le Bistro je fais une exception cette fois, ne le refais pas", "Crisp · Léa : c'est accordé pour cette fois"], "exception, pas une règle"),
  c("bruit OCR", false, "Retrouver le client d'un chat Crisp", ["Inbox | Crisp - Memory usage - 192 MB", "Contacts | HubSpot", "10:42", "Rechercher", "Filtres Tri Colonnes", "0 contacts"], "bruit d'interface"),
  c("contexte vide", false, "Retrouver le client d'un chat Crisp", [""], "rien vu"),
  c("désaccord", false, "Crisp : un client demande un dédommagement", ["Slack #support · Léa : on offre combien à un client premium ?", "Karim : 2 mois je crois", "Yasmine : non, 1 mois, mais je ne suis pas sûre", "Léa : ok… je demande demain"], "deux réponses contradictoires"),
  c("doc périmée seule", false, "Crisp : un client demande un dédommagement", ["Notion · Process support (février 2025) : geste commercial jusqu'à 2 mois, quelle que soit l'offre (page non mise à jour)", "Crisp · Léa : je vérifie la règle et je reviens vers vous"], "doc périmée, aucune confirmation"),
];

// ---- jeu RÉSERVÉ (--reserve) : écrit après le réglage de la consigne, jamais utilisé pour la régler.
const RESERVE: Labeled[] = [
  c("changer d'offre", true, "HubSpot : passer un client à une autre offre", ["Slack #support · Léa : un client veut passer d'Essentiel à Premium, je fais comment ?", "Claire : on crée une transaction « modification d'offre » sur l'entreprise, effet au 1er du mois suivant", "HubSpot · Nouvelle transaction · Modification d'offre · Premium · effet 2026-11-01"]),
  c("acompte remboursé", true, "Rembourser un acompte anti no-show", ["Notion · Grille tarifaire 2026 · Acompte anti no-show : remboursé au client final si le restaurant annule, depuis le menu Paiements", "Crisp · Léa : C'est remboursé depuis votre menu Paiements, je vous guide."]),
  c("ajouter un établissement", true, "HubSpot : ajouter un établissement à un client", ["Slack #support · Léa : Les Tontons Burger ouvrent un 4e site", "Karim : à partir de 3 sites c'est l'Offre Groupe : une ligne produit par établissement dans la transaction", "HubSpot · Transaction · Ajouter une ligne : Offre Groupe (4e établissement)"]),
  c("résiliation", true, "Traiter une demande de résiliation", ["Crisp · Marco Bellini (marco.bellini@example.com) : je veux résilier", "Slack #support (épinglé) · Claire : résiliation = préavis d'un mois, formulaire Notion « Résiliation » à envoyer au client", "Crisp · Léa : Voici le formulaire de résiliation, le préavis est d'un mois."], "e-mail dans le contexte"),
  c("renvoi vers la doc vide", false, "Configurer un menu de groupe", ["Slack #support · Léa : on configure comment un menu de groupe ?", "Karim : regarde dans Notion", "Notion · recherche « menu de groupe » · Aucun résultat"], "renvoi sans contenu"),
  c("page marquée obsolète", false, "Exporter les réservations d'un client", ["Notion · Export des réservations (OBSOLÈTE, ne plus suivre) : menu Outils > Export", "HubSpot · recherche « export » · 0 résultat", "Crisp · Léa : je regarde et je reviens vers vous"], "doc obsolète non confirmée"),
  c("remise ponctuelle validée", false, "HubSpot : remise supérieure à 15 % bloquée", ["Slack #deal-desk · Nadia : pour Sushi Kumo on a mis 18 %, Antoine a validé cette fois", "HubSpot · Sushi Kumo · remise 18 %"], "exception ponctuelle"),
  c("réponse coupée", false, "Crisp : un client demande un dédommagement", ["Slack #support · Léa : on offre quoi après une panne ?", "Claire : la règle c'est"], "réponse tronquée par la capture"),
];
const SET = process.argv.includes("--reserve") ? RESERVE : CASES;

// ---- tirages, en parallèle par 4
type Run = { label: string; expect: boolean; got: boolean; confidence: number; ms: number; rawLeak: boolean; title?: string; trap?: string };
const runs: Run[] = [];
const jobs = SET.flatMap((k) => Array.from({ length: DRAWS }, () => k));
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const k = jobs[next++];
    let raw = "";
    const t0 = performance.now();
    const f = await judge(k, async (s, u, n) => (raw = await chat(s, u, n)), redact);
    const ms = performance.now() - t0;
    let v: any = {};
    try { v = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch {}
    runs.push({ label: k.label, expect: k.expect, got: f.resolved, confidence: f.confidence, ms, rawLeak: IDENTIFYING.test(`${v.title ?? ""} ${v.body ?? ""}`), title: f.title ?? "", trap: k.trap });
  }
}
const t0 = Date.now();
await Promise.all([worker(), worker(), worker(), worker()]);

// ---- mesures
const tp = runs.filter((r) => r.expect && r.got).length, fp = runs.filter((r) => !r.expect && r.got).length;
const fn = runs.filter((r) => r.expect && !r.got).length, tn = runs.filter((r) => !r.expect && !r.got).length;
const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
const q = (p: number) => Math.round(ms[Math.min(ms.length - 1, Math.floor(p * ms.length))]);
const stable = SET.filter((k) => new Set(runs.filter((r) => r.label === k.label).map((r) => r.got)).size === 1).length;
const result = {
  date: new Date().toISOString(), set: process.argv.includes("--reserve") ? "réservé" : "réglage", model: MODEL, cases: SET.length, draws: DRAWS, judgments: runs.length,
  precision: +(tp / Math.max(1, tp + fp)).toFixed(2), recall: +(tp / Math.max(1, tp + fn)).toFixed(2), accuracy: +((tp + tn) / runs.length).toFixed(2),
  confusion: { tp, fp, fn, tn }, stableCases: stable,
  rawLeaks: runs.filter((r) => r.rawLeak).length, publishedLeaks: runs.filter((r) => r.got && r.title && IDENTIFYING.test(r.title)).length,
  titlesOver60: runs.filter((r) => r.title && r.title.length > 60).length,
  latencyMs: { p50: q(0.5), p95: q(0.95), max: Math.round(ms.at(-1)!) }, wallSeconds: Math.round((Date.now() - t0) / 1000),
  errors: SET.filter((k) => runs.some((r) => r.label === k.label && r.got !== k.expect)).map((k) => ({ label: k.label, expect: k.expect, got: runs.filter((r) => r.label === k.label).map((r) => r.got), trap: k.trap })),
  runs,
};
mkdirSync(join(import.meta.dir, "..", "mesures"), { recursive: true });
writeFileSync(join(import.meta.dir, "..", "mesures", process.argv.includes("--reserve") ? "nuit-eval-reserve.json" : "nuit-eval.json"), JSON.stringify(result, null, 2));
console.log(`Jeu ${result.set} · modèle ${result.model} · ${result.cases} cas × ${DRAWS} tirages = ${result.judgments} jugements · ${result.wallSeconds} s`);
console.log(`précision ${result.precision} · rappel ${result.recall} · exactitude ${result.accuracy} · confusion ${JSON.stringify(result.confusion)} · cas stables ${stable}/${SET.length}`);
console.log(`fuites dans la sortie brute du modèle : ${result.rawLeaks} · publiées après filtre : ${result.publishedLeaks} · titres > 60 car. : ${result.titlesOver60}`);
console.log(`latence par jugement : p50 ${result.latencyMs.p50} ms · p95 ${result.latencyMs.p95} ms · max ${result.latencyMs.max} ms`);
for (const e of result.errors) console.log(`  écart : ${e.label} (attendu ${e.expect ? "résolue" : "non résolue"}, obtenu ${e.got.join("/")})${e.trap ? ` · piège : ${e.trap}` : ""}`);
process.exit(0);
