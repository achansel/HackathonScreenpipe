import { describe, expect, test } from "bun:test";
import { buildPayload, LIMITS, lintPayload, PIPE_NAME, preview, relativeDay } from "../src/notify/templates.ts";
import type { NotifyPayload } from "../src/notify/types.ts";
import { DAY_MS, episode, pathHelp, ruleHelp, slackHelp } from "./fixtures.ts";

const NOW = 10 * DAY_MS;

describe("buildPayload", () => {
	test("les trois aides passent le contrôle", () => {
		for (const help of [pathHelp, slackHelp, ruleHelp]) {
			const payload = buildPayload(episode(help), { now: () => NOW });
			expect(lintPayload(payload)).toEqual([]);
			expect(payload.pipe_name).toBe(PIPE_NAME);
		}
	});

	test("l'id de la notification est celui de l'épisode", () => {
		const ep = episode(ruleHelp);
		expect(buildPayload(ep).id).toBe(ep.id);
	});

	test(": toast seul, 30 s, [Y aller] et le fil d'Ariane", () => {
		const payload = buildPayload(episode(pathHelp));
		expect(payload.title).toBe("Produits du contrat signé");
		expect(payload.priority).toBe("low");
		expect(payload.timeout).toBe(30_000);
		expect(payload.body).toContain("1 clic au lieu de 4");
		expect(payload.body).toContain("`Contact › Transactions › Contrat signé › Produits`");
		expect(payload.actions).toEqual([
			{ id: "go", label: "Y aller", type: "link", url: "https://app.hubspot.com/contacts/1/record/0-3/2", primary: true },
		]);
	});

	test(": sans URL résolue, [Ouvrir la fiche] vers la fiche de départ", () => {
		const payload = buildPayload(episode({ ...pathHelp, url: null }));
		expect(payload.actions[0]).toMatchObject({ label: "Ouvrir la fiche", url: "https://app.hubspot.com/contacts/1/record/0-1/3" });
	});

	test(": copier puis ouvrir, aperçu de la première ligne", () => {
		const payload = buildPayload(episode(slackHelp));
		expect(payload.title).toBe("Bug client → #bugs");
		expect(payload.priority).toBe("normal");
		expect(payload.body).toContain("`[Bug] Le Bistro · page en panne`");
		expect(payload.actions.map((action) => action.label)).toEqual(["1. Copier le message", "2. Ouvrir #bugs"]);
		expect(payload.actions[0]).toMatchObject({ type: "copy", value: slackHelp.message });
	});

	test(": client en attente → high, reste affichée, trois boutons", () => {
		const payload = buildPayload(episode(ruleHelp, { customerWaiting: true }), { now: () => NOW });
		expect(payload.priority).toBe("high");
		expect(payload.timeout).toBe(0);
		expect(payload.body.split("\n")).toEqual([
			"**Premium seulement.** Sinon : un bon de 10 %.",
			"Note `geste commercial` dans HubSpot.",
			"Règle de l'équipe · confirmée il y a 10 jours",
		]);
		expect(payload.actions.map((action) => action.type)).toEqual(["link", "copy", "copy"]);
	});

	test(": sans client en attente → normal", () => {
		expect(buildPayload(episode(ruleHelp)).priority).toBe("normal");
	});

	test("l'option link transforme toutes les URL [Y aller] / [Ouvrir …]", () => {
		const link = (ep: { id: string }, target: string) => `http://127.0.0.1:4517/go/${ep.id}?t=${target.length}`;
		for (const help of [pathHelp, slackHelp, ruleHelp]) {
			const ep = episode(help);
			const go = buildPayload(ep, { link }).actions.find((action) => action.id === "go");
			expect(go?.type === "link" && go.url.startsWith(`http://127.0.0.1:4517/go/${ep.id}`)).toBe(true);
		}
	});
});

describe("lintPayload", () => {
	const valid = (): NotifyPayload => buildPayload(episode(ruleHelp));

	test("titre trop long", () => {
		const payload = { ...valid(), title: "x".repeat(LIMITS.titleChars + 1) };
		expect(lintPayload(payload).join()).toContain("titre trop long");
	});

	test("un émoji compte pour un caractère", () => {
		const payload = { ...valid(), title: `${"x".repeat(LIMITS.titleChars - 2)}` };
		expect(lintPayload(payload)).toEqual([]);
	});

	test("plus de trois lignes", () => {
		expect(lintPayload({ ...valid(), body: "a\nb\nc\nd" }).join()).toContain("corps trop long");
	});

	test("listes, titres et citations markdown refusés, le gras accepté", () => {
		for (const line of ["- puce", "* puce", "1. étape", "# Titre", "> citation"]) {
			expect(lintPayload({ ...valid(), body: line }).join()).toContain("non affichés sur Mac");
		}
		expect(lintPayload({ ...valid(), body: "**gras** puis `code`" })).toEqual([]);
	});

	test("bouton api refusé", () => {
		const payload = { ...valid(), actions: [{ id: "x", label: "Ça m'a aidé", type: "api", url: "http://127.0.0.1:4517/x" }] };
		expect(lintPayload(payload as unknown as NotifyPayload).join()).toContain("api est refusé");
	});

	test("plus de trois boutons, copie vide, pipe_name absent", () => {
		const copy = { id: "c", label: "Copier", type: "copy" as const, value: "" };
		const problems = lintPayload({ ...valid(), pipe_name: "autre", actions: [copy, copy, copy, copy] }).join();
		expect(problems).toContain("trop de boutons");
		expect(problems).toContain("rien à copier");
		expect(problems).toContain("pipe_name");
	});
});

describe("helpers", () => {
	test("relativeDay", () => {
		expect(relativeDay(NOW, NOW)).toBe("aujourd'hui");
		expect(relativeDay(NOW - DAY_MS, NOW)).toBe("hier");
		expect(relativeDay(NOW - 5 * DAY_MS, NOW)).toBe("il y a 5 jours");
		expect(relativeDay(NOW - 21 * DAY_MS, NOW)).toBe("il y a 3 semaines");
		expect(relativeDay(NOW + DAY_MS, NOW)).toBe("aujourd'hui");
	});

	test("preview : première ligne non vide, sans backtick, tronquée", () => {
		expect(preview("\n  `a` b\nsuite")).toBe("'a' b");
		expect([...preview("x".repeat(80))].length).toBe(LIMITS.previewChars);
		expect(preview("x".repeat(80)).endsWith("…")).toBe(true);
	});
});
