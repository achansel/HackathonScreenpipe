// Le classifieur à mots-clés (integrations/src/assist/crisp-assist.ts, classify) sur 15 messages client :
// 10 du script de la démo, 5 hors script. Déterministe, sans réseau.
//   bun docs/mesures/mots-cles.ts
import { classify } from "../../integrations/src/assist/crisp-assist.ts";

// [message, besoin attendu (— = aucune aide), origine]
const CASES: [string, string, string][] = [
  ["Bonjour, ma page de réservation est en panne, les clients ne peuvent plus réserver.", "bug", "script"],
  ["Toujours rien… J'ai perdu des réservations ce midi, je veux un dédommagement.", "geste", "script"],
  ["Bonjour, les rappels SMS sont inclus dans notre contrat ?", "offre", "script"],
  ["Bonjour ! Thomas m'avait promis l'installation sur place gratuite, quand passez-vous ?", "promesse", "script"],
  ["Bonjour, combien pour 3 restaurants ? Nous sommes à Bruxelles.", "prospect", "script"],
  ["Bonjour, je ne trouve pas ma facture de septembre.", "—", "script"],
  ["Les SMS de rappel partent à 8 h du matin, c'est possible de les envoyer plutôt à 11 h ?", "—", "script"],
  ["Le bouton Réserver n'apparaît pas sur notre fiche Google, c'est normal ?", "—", "script"],
  ["Bonjour, comment ajouter une table en terrasse sur le plan de salle ?", "—", "script"],
  ["Merci, tout marche", "—", "script"],
  ["Le restaurant de Toulon n'envoie pas les rappels SMS. C'est inclus dans notre contrat ?", "offre", "hors script"],
  ["Le prix affiché sur ma facture de septembre est faux", "—", "hors script"],
  ["C'était une erreur de ma part, je n'étais pas bloqué, merci !", "—", "hors script"],
  ["Vous pouvez m'envoyer un devis pour la formation de l'équipe ?", "—", "hors script"],
  ["Votre collègue m'a dit que c'était réglé, mais rien n'a changé", "promesse", "hors script"],
];

let ok = 0;
for (const [message, expected, origin] of CASES) {
  const got = classify(message).join(",") || "—";
  const right = got === expected;
  ok += right ? 1 : 0;
  console.log(`${right ? "✓" : "✗"} ${origin.padEnd(11)} obtenu ${got.padEnd(9)} attendu ${expected.padEnd(9)} ${message.slice(0, 70)}`);
}
console.log(`${ok}/${CASES.length} justes`);
