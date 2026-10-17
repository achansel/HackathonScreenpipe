import { describe, expect, test } from "bun:test";
import { CRISP_CUSTOMERS } from "../src/seed/crisp-story.ts";
import { customerPage, indexPage } from "../src/sim/page.ts";

/** Le script intégré à la page doit au moins se compiler : une erreur de syntaxe désactive tous les boutons. */
function inlineScripts(html: string): string[] {
	return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
}

describe("Pages du simulateur", () => {
	test("le script de chaque page client se compile", () => {
		for (const customer of CRISP_CUSTOMERS) {
			for (const script of inlineScripts(customerPage(customer))) expect(() => new Function(script)).not.toThrow();
		}
	});

	test("la liste mène à chaque client", () => {
		const html = indexPage();
		for (const customer of CRISP_CUSTOMERS) expect(html).toContain(`/client/${customer.key}`);
	});
});
