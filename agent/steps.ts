// Regroupement des libellés d'étape : le modèle écrit chaque étape un peu différemment
// (« Choisir le pipeline d'un ticket client » / « … du ticket support »). Chaque nouveau libellé
// est rattaché à une étape CANONIQUE existante, ou en crée une. Cache local : un libellé
// n'est soumis au modèle qu'une fois.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STATE_DIR } from "./config";
import { chat } from "./screenpipe";

const CACHE = `${STATE_DIR}step-groups.json`; // { "<libellé>": "<étape canonique>" }
const key = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const PROMPT = `Tu regroupes des libellés d'étapes de process qui désignent LA MÊME étape (même outil, même action), même formulés différemment.
Pour chaque nouveau libellé, renvoie l'étape canonique existante qui lui correspond, ou un nouveau libellé canonique court (4 à 8 mots, « Outil : action »).
Même étape = même action sur le même objet métier, en ignorant les qualificatifs qui ne changent pas l'action (article, « client », « support », outil implicite). Deux actions différentes restent distinctes (ex. « choisir le pipeline » et « créer un prospect »).
Réponds uniquement par un JSON : {"<nouveau libellé>": "<étape canonique>", ...}`;

export async function canonicalSteps(labels: string[]): Promise<Map<string, string>> {
  const cache: Record<string, string> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const known = new Map(Object.entries(cache).map(([l, c]) => [key(l), c]));
  const fresh = [...new Set(labels.filter((l) => !known.has(key(l))))];
  for (let i = 0; i < fresh.length; i += 25) {
    const batch = fresh.slice(i, i + 25);
    const canon = [...new Set([...known.values()])];
    const out = await chat(PROMPT, `Étapes canoniques existantes :\n${canon.map((c) => `- ${c}`).join("\n") || "(aucune)"}\n\nNouveaux libellés :\n${batch.map((l) => `- ${l}`).join("\n")}`, 1500);
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch {}
    for (const l of batch) {
      const c = mapping[l] ?? Object.entries(mapping).find(([k]) => key(k) === key(l))?.[1] ?? l; // repli : le libellé lui-même
      cache[l] = c;
      known.set(key(l), c);
    }
    writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  }
  return new Map(labels.map((l) => [l, known.get(key(l)) ?? l]));
}
