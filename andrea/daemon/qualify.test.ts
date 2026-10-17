import { expect, test } from "bun:test";
import { groundedRequest, redact } from "./qualify";

test("masquage : e-mail, téléphone, IBAN", () => {
  const out = redact("jean.d@example.com au +33 6 12 34 56 78, IBAN FR76 3000 6000 0112 3456 7890 189");
  expect(out).not.toContain("example.com");
  expect(out).not.toContain("12 34 56");
  expect(out).not.toContain("3000 6000");
  expect(out).toContain("[EMAIL]");
});

test("demande anonyme : l'étape doit s'appuyer sur le texte (cas mesurés le 17/10)", () => {
  const pad = "Messages Boîte de réception principale Assignées à moi Vos boîtes de réception Automatisé Spam Agent IA";
  // légitimes
  expect(groundedRequest("Retrouver les factures et modifier l'envoi", "On trouve où les factures des clients ? On peut changer l'heure d'envoi des SMS de rappel ? Message #support")).toBe(true);
  expect(groundedRequest("Identifier le réglage des options de réservation", "v Huddle Conditions particulières SMS de rappel ? Réserver avec Google n'apparait pas, c'est quel réglage ? Message #support")).toBe(true);
  // parasites
  expect(groundedRequest("Retrouver la clé API HubSpot", `I - Kenji Mori Crisp Data ntegration Filtres maintenant En attente ${pad}`)).toBe(false);
  expect(groundedRequest("Attendre la réponse d'une collègue", `Anne Le Gall Le Plan de salle Ajouter une table nothing new; still watching for Elodie's message ${pad}`)).toBe(false);
  expect(groundedRequest("Renseigner l'information dans le bon stage", "noté où ? dans quel stage ? Shift")).toBe(false);
});
