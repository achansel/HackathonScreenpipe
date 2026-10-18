import { expect, test } from "bun:test";
import { EpisodeBuilder } from "./episodes";

const T0 = Date.parse("2026-10-17T10:00:00Z");
const frame = (app: string, window: string, text: string, dt: number, source = "accessibility") =>
  ({ app_name: app, window_name: window, text, text_source: source, timestamp: new Date(T0 + dt).toISOString() });

test("un épisode sort après le debounce, pas avant", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("Slack.exe", "#support - Slack", "Message #support", -1000)); // ouverture du canal
  b.addFrame(frame("Slack.exe", "#support - Slack", "Message #support Quelqu'un sait quel pipeline choisir pour ce ticket", 0));
  expect(b.ready(T0 + 1000)).toHaveLength(0);
  const eps = b.ready(T0 + 2500);
  expect(eps).toHaveLength(1);
  expect(eps[0].text).toContain("pipeline");
  expect(b.ready(T0 + 5000)).toHaveLength(0); // un changement ne sort qu'une fois
});

test("hors périmètre : une autre appli titrée « … - Slack » est ignorée", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("claude.exe", "logistics (Channel) - Piping Company - Slack", "texte d'une autre appli confidentiel", 0));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
});

test("hors périmètre : page de connexion Google qui cite HubSpot dans son URL", () => {
  const b = new EpisodeBuilder();
  b.addFrame({ ...frame("chrome.exe", "Connexion : comptes Google - Google Chrome", "Utilisez votre clé d'accès pour confirmer votre identité", 0),
    browser_url: "https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fapp.hubspot.com%2Flogin" });
  expect(b.ready(T0 + 5000)).toHaveLength(0);
  const hubspot = { browser_url: "https://app-eu1.hubspot.com/contacts/1234" };
  b.addFrame({ ...frame("chrome.exe", "Contacts - Google Chrome", "Contacts Rechercher", 5000), ...hubspot });
  b.addFrame({ ...frame("chrome.exe", "Contacts - Google Chrome", "Contacts Rechercher Aucun contact ne correspond à votre recherche", 6000), ...hubspot });
  expect(b.ready(T0 + 9000)).toHaveLength(1);
});

test("Firefox : texte d'accessibilité ignoré (autre onglet possible), OCR gardé", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("firefox.exe", "Camille Martin | Crisp — Mozilla Firefox", "texte d'un autre onglet boite de reception", 0, "accessibility"));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
  b.addFrame(frame("firefox.exe", "Camille Martin | Crisp — Mozilla Firefox", "Boite de réception", 5000, "ocr"));
  b.addFrame(frame("firefox.exe", "Camille Martin | Crisp — Mozilla Firefox", "Boite de réception je veux obtenir un remboursement pour ma commande", 6000, "ocr"));
  expect(b.ready(T0 + 9000)).toHaveLength(1);
});

test("historique affiché à l'ouverture d'une fenêtre : pas un épisode", () => {
  const b = new EpisodeBuilder();
  // ouverture de #deal-desk : la question d'un collègue est déjà là (mesuré le 17/10)
  b.addFrame(frame("Slack.exe", "deal-desk (Channel) - Piping Company - Slack", "Thomas Girard Les Tontons Burger, 3 sites : je peux aller jusqu'à 25 % ?", 0));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
});

test("Crisp côté client (go.crisp.chat) ignoré ; retour sur l'onglet agent après 5 min : le nouveau message est vu", () => {
  const b = new EpisodeBuilder();
  const agent = { browser_url: "https://app.crisp.chat/website/abc/inbox/session_1/" };
  b.addFrame({ ...frame("chrome.exe", "Jean Dupont | Crisp - Google Chrome", "Jean Dupont Bonjour, ma page de réservation est en panne", 0), ...agent });
  b.addFrame({ ...frame("chrome.exe", "Chat - Google Chrome", "J'ai perdu des réservations, je veux un dédommagement", 60_000),
    browser_url: "https://go.crisp.chat/chat/embed/?website_id=abc" });
  expect(b.ready(T0 + 70_000)).toHaveLength(0);
  b.addFrame({ ...frame("chrome.exe", "Jean Dupont | Crisp - Google Chrome", "Jean Dupont Bonjour, ma page de réservation est en panne J'ai perdu des réservations, je veux un dédommagement", 300_000), ...agent });
  const eps = b.ready(T0 + 303_000);
  expect(eps).toHaveLength(1);
  expect(eps[0].text).toContain("dédommagement");
  expect(eps[0].text).not.toContain("Bonjour"); // l'ancien message n'est pas repris, seulement 4 mots de contexte
});

test("Slack alterne OCR et accessibilité : l'historique déjà vu n'est pas nouveau, la question garde son contexte", () => {
  const b = new EpisodeBuilder();
  const w = "support (Channel) - Piping Company - Slack";
  const hist = "Yasmine Roche 3:26 PM Un client premium demande un dédommagement après la panne de mardi";
  b.addFrame(frame("Slack.exe", w, `Huddle DMs ${hist}`, 0, "ocr"));
  b.addFrame(frame("Slack.exe", w, `Minimize Maximize Close Back in history ${hist}`, 2000, "accessibility"));
  b.addFrame(frame("Slack.exe", w, `Huddle DMs ${hist}`, 4000, "ocr"));
  expect(b.ready(T0 + 9000)).toHaveLength(1); // le passage à l'accessibilité apporte « Minimize Maximize… »
  b.addFrame(frame("Slack.exe", w, `Minimize Maximize Close Back in history ${hist}`, 10_000, "accessibility"));
  expect(b.ready(T0 + 15_000)).toHaveLength(0); // déjà vu : rien de neuf
  b.addFrame(frame("Slack.exe", w, `Huddle DMs ${hist} Andrea 3:38 PM On peut offrir qqchose a un client premium ou quoi ?`, 16_000, "ocr"));
  const eps = b.ready(T0 + 21_000);
  expect(eps).toHaveLength(1);
  expect(eps[0].text).toContain("offrir qqchose a un client premium ou quoi");
});

test("badge de non-lus dans le titre : même fenêtre", () => {
  const b = new EpisodeBuilder();
  const agent = { browser_url: "https://app.crisp.chat/website/abc/inbox/session_1/" };
  b.addFrame({ ...frame("chrome.exe", "Jean Dupont | Crisp - Google Chrome", "Jean Dupont Bonjour, ma page de réservation est en panne", 0), ...agent });
  b.addFrame({ ...frame("chrome.exe", "💬1 - Jean Dupont | Crisp - Google Chrome", "Jean Dupont Bonjour, ma page de réservation est en panne Julien J'ai perdu des réservations", 5000), ...agent });
  expect(b.ready(T0 + 8000)).toHaveLength(1);
});

test("aperçus alt-tab ignorés", () => {
  const b = new EpisodeBuilder();
  b.addFrame(frame("chrome.exe", "Task Switching", "Crisp HubSpot Slack WhatsApp Gmail", 0));
  expect(b.ready(T0 + 5000)).toHaveLength(0);
});

test("identifiant déterministe : même historique, même épisode", () => {
  const run = () => {
    const b = new EpisodeBuilder();
    b.addFrame(frame("Slack.exe", "#support - Slack", "Message #support", -1000));
    b.addFrame(frame("Slack.exe", "#support - Slack", "Message #support question sur le pipeline support ou support old", 0));
    return b.ready(T0 + 3000)[0].id;
  };
  expect(run()).toBe(run());
});

test("recherche dans l'URL, résultat sur une capture OCR sans URL (Windows) : un épisode avec la recherche et son résultat", () => {
  const b = new EpisodeBuilder();
  const w = "Contacts | All contacts - Google Chrome"; // le titre ne dit pas HubSpot : seule l'URL le dit
  const list = "https://app-eu1.hubspot.com/contacts/1/objects/0-1/views/all/list";
  const nav = "Home Contacts Companies Deals Tasks Segments Marketing Sales Platform Workflows More";
  b.addFrame({ ...frame("chrome.exe", w, `${nav} Jean Dupont Kenji Mori 12 contacts`, 0), browser_url: list });
  b.addFrame({ ...frame("chrome.exe", w, nav, 3000), browser_url: `${list}?query=km.0412%40zvk.test` });
  expect(b.ready(T0 + 5500)).toHaveLength(0); // une recherche attend son résultat
  b.addFrame(frame("chrome.exe", w, `${nav} No Contacts match the current filters 0 contacts`, 6000, "ocr")); // pas d'URL
  const eps = b.ready(T0 + 13_000);
  expect(eps).toHaveLength(1);
  expect(eps[0].text).toContain("Recherche « km.0412@zvk.test »");
  expect(eps[0].text).toContain("0 contacts");
});

test("même recherche refaite après avoir vidé le champ : nouveau geste (répétition juste avant la démo)", () => {
  const b = new EpisodeBuilder();
  const w = "Contacts | All contacts - Google Chrome";
  const list = "https://app-eu1.hubspot.com/contacts/1/objects/0-1/views/all/list";
  const nav = "Home Contacts Companies Deals Tasks Segments Marketing Sales Platform Workflows More";
  b.addFrame({ ...frame("chrome.exe", w, `${nav} 12 contacts`, 0), browser_url: list });
  b.addFrame({ ...frame("chrome.exe", w, `${nav} 0 contacts`, 3000), browser_url: `${list}?query=jd.resto75%40resa-paris.test` });
  expect(b.ready(T0 + 10_000)).toHaveLength(1);
  b.addFrame({ ...frame("chrome.exe", w, `${nav} 12 contacts`, 12_000), browser_url: list }); // champ vidé
  b.addFrame({ ...frame("chrome.exe", w, `${nav} 0 contacts`, 15_000), browser_url: `${list}?query=jd.resto75%40resa-paris.test` });
  const eps = b.ready(T0 + 22_000);
  expect(eps).toHaveLength(1);
  expect(eps[0].text).toContain("Recherche « jd.resto75@resa-paris.test »");
});
