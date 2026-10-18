// Qualifie un épisode en un appel : friction ou non, type (vocabulaire Screenpipe + détour),
// et solution d'équipe correspondante. Les identifiants évidents sont masqués avant l'envoi.
import type { Episode } from "./episodes";
import { chat } from "./screenpipe";
import type { Solution } from "./solutions";

export type Verdict = {
  friction: boolean;
  detour: string;
  type: string;
  control: string;
  step: string;
  solution_id: string | null;
  confiance: number;
};

const SYSTEM = `Tu repères les frictions de PROCESS d'un employé à partir d'un extrait de son écran.
Friction = détour sur une étape de process que des collègues connaissent (règle non écrite, champ obligatoire, validation, outil à trouver).
Pas une friction : travail normal, réponse courtoise à un client, discussion sociale, message de succès, panne technique (404, timeout), écran de connexion ou de mot de passe.
Le texte mêle ce qui vient d'apparaître et de l'historique déjà affiché (anciens messages horodatés de collègues ou de clients). Juge ce que l'employé fait MAINTENANT : sa question, sa recherche, ses allers-retours. Un message de collègue ou de client, à lui seul, n'est pas une friction de l'employé.
Une recherche qui affiche ce qui était cherché n'est pas une friction ; une recherche sans résultat ou répétée en est une.
Une question que l'employé pose lui-même à ses collègues sur une règle ou un process (« on peut… ? », « je fais comment ? ») est une demande_aide.
detour : blocage | demande_aide | recherche | tatonnement | parcours | ressaisie | contournement | attente_relance | aucun.
type (Screenpipe) : waiting | switching | rework | handoff | unclear. control : direct | influence | external | required.
step : l'étape du process en 4 à 8 mots, sans nom de personne, e-mail, numéro ni identifiant client.
solution_id : l'id de la solution d'équipe qui répond à CETTE étape, ou null si aucune ne correspond vraiment.
Réponds uniquement par un JSON : {"friction":bool,"detour":"","type":"","control":"","step":"","solution_id":null,"confiance":0.0}`;

const DETOURS = ["blocage", "demande_aide", "recherche", "tatonnement", "parcours", "ressaisie", "contournement", "attente_relance"];

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/**
 * Une demande anonyme part vers toute l'équipe : on exige que l'étape s'appuie sur le texte de l'épisode
 * (un mot de l'étape d'au moins 5 lettres retrouvé par ses 5 premières lettres) et un texte d'au moins
 * 12 mots. Mesuré le 17/10 : bloque « Retrouver la clé API HubSpot » (étape inventée), « Attendre la
 * réponse d'une collègue » (texte de la fenêtre Claude), « Renseigner l'information dans le bon stage »
 * (7 mots pris pendant la frappe) ; laisse passer factures, heure des SMS, réglage Réserver avec Google.
 */
export function groundedRequest(step: string, text: string): boolean {
  const words = fold(text).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length < 12) return false;
  const stems = new Set(words.filter((w) => w.length >= 5).map((w) => w.slice(0, 5)));
  return fold(step).split(/[^a-z0-9]+/).some((w) => w.length >= 5 && stems.has(w.slice(0, 5)));
}

export function redact(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[EMAIL]")
    .replace(/(?:\+|00)\d[\d .-]{8,14}\d/g, "[PHONE]")
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}\b/g, "[IBAN]");
}

/** Côté collègue : laquelle de MES solutions répond à cette étape (décrite sans contexte) ? */
export async function matchStep(step: string, solutions: Solution[]): Promise<string | null> {
  if (!solutions.length) return null;
  const catalogue = solutions.map((s) => `- ${s.id} : ${s.step}`).join("\n");
  const out = await chat(
    "Un collègue bloque sur une étape de process. Réponds uniquement par l'id de la solution qui y répond vraiment, ou par null.",
    `Étape : ${step}\n\nSolutions :\n${catalogue}`,
    200,
  );
  const id = (out.match(/[a-z0-9-]+/gi) ?? []).find((w) => solutions.some((s) => s.id === w));
  return id ?? null;
}

/** dossier : le dernier message client (Crisp), contexte pour nommer l'étape, jamais une friction à lui seul. */
export async function qualify(ep: Episode, solutions: Solution[], dossier?: string): Promise<Verdict | null> {
  const catalogue = solutions.map((s) => `- ${s.id} : ${s.step}`).join("\n");
  const context = dossier ? `Dossier en cours (message d'un client, contexte seulement, pas une friction à lui seul) : « ${redact(dossier).slice(0, 300)} »\n` : "";
  const user = `Solutions d'équipe :\n${catalogue}\n\n${context}Appli : ${ep.app}\nFenêtres récentes : ${ep.titles.map(redact).join(" → ")}\nTexte nouveau : ${redact(ep.text)}`;
  const out = await chat(SYSTEM, user, 400);
  try {
    const v = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "") as Verdict;
    if (v.solution_id && !solutions.some((s) => s.id === v.solution_id)) v.solution_id = null;
    if (!DETOURS.includes(v.detour)) v.friction = false; // mesuré : detour "aucun", ou un type (« rework ») à sa place
    if (!v.friction) v.solution_id = null; // mesuré : friction:false avec une solution
    return v;
  } catch {
    return null;
  }
}
