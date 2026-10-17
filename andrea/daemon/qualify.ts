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

export async function qualify(ep: Episode, solutions: Solution[]): Promise<Verdict | null> {
  const catalogue = solutions.map((s) => `- ${s.id} : ${s.step}`).join("\n");
  const user = `Solutions d'équipe :\n${catalogue}\n\nAppli : ${ep.app}\nFenêtres récentes : ${ep.titles.map(redact).join(" → ")}\nTexte nouveau : ${redact(ep.text)}`;
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
