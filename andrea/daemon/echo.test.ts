import { expect, test } from "bun:test";
import { notify, withoutOwnNotifications } from "./screenpipe";

test("notre notification relue par l'OCR est retirée de l'épisode", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ message: "sent" })) as unknown as typeof fetch;
  await notify({ title: "Geste commercial : 1 mois offert maximum", body: "**Clients premium seulement.** Ajouter la note `geste commercial` sur la fiche HubSpot. Au-delà : validation de la responsable support.\\nRéglé 5 fois dans l'équipe.", actions: [{ label: "Ça m'a aidé" }, { label: "Pas ça" }] });
  globalThis.fetch = realFetch;
  // texte OCR mesuré le 17/10 (frame de Crisp sous Firefox, notification par-dessus)
  const ocr = "Ag Wee... Linear Geste commercial : mois offert maximum Clients premium seulement. Ajoutez- note suz- fiche HubSpot. Au-delä validation Ie responsable support. Réglé S fois 'éguipe. chanselmectl... Envoyer outils";
  expect(withoutOwnNotifications(ocr).echo).toBe(true);
  const real = "Jean Dupont : J'ai perdu des réservations ce soir, je veux un dédommagement pour mon restaurant";
  expect(withoutOwnNotifications(real)).toEqual({ text: real, echo: false });
});
