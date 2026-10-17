import { describe, expect, test } from "bun:test";
import { CRISP_ONLY, PRODUCTS, RESTAURANTS } from "../src/seed/pipingtable.ts";

const people = [...RESTAURANTS.flatMap((restaurant) => restaurant.contacts), ...CRISP_ONLY.map((entry) => entry.person)];

describe("Données PipingTable", () => {
	test("toutes les adresses sont en @example.com", () => {
		const emails = people.flatMap((person) => [person.email, person.crispEmail].filter(Boolean));
		expect(emails.filter((email) => !email!.endsWith("@example.com"))).toEqual([]);
	});

	test("une adresse ne sert qu'à une personne", () => {
		const emails = people.map((person) => person.email);
		expect(new Set(emails).size).toBe(emails.length);
	});

	test("téléphones dans la plage de fiction", () => {
		const phones = people.flatMap((person) => (person.phone ? [person.phone] : []));
		expect(phones.filter((phone) => !/^\+33 6 39 98 \d{2} \d{2}$/.test(phone))).toEqual([]);
	});

	test("clés uniques et domaines en .example", () => {
		const keys = RESTAURANTS.map((restaurant) => restaurant.key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(RESTAURANTS.filter((restaurant) => restaurant.domain && !restaurant.domain.endsWith(".example"))).toEqual([]);
	});

	test("chaque ligne de vente renvoie à un produit du catalogue", () => {
		const skus = new Set(PRODUCTS.map((product) => product.sku));
		const lines = RESTAURANTS.flatMap((restaurant) => restaurant.deals.flatMap((deal) => deal.lines));
		expect(lines.filter((line) => !skus.has(line.sku))).toEqual([]);
	});

	test("un client signé a une offre ; un prospect n'en a pas", () => {
		for (const restaurant of RESTAURANTS) {
			const signed = restaurant.deals.some((deal) => deal.stage === "signe");
			expect({ key: restaurant.key, plan: Boolean(restaurant.plan) }).toEqual({ key: restaurant.key, plan: signed });
		}
	});

	test("la friction de 9 h 05 est en place : Jean Dupont écrit avec une autre adresse, et Le Bistro a un doublon", () => {
		const bistros = RESTAURANTS.filter((restaurant) => restaurant.name === "Le Bistro");
		expect(bistros).toHaveLength(2);
		const jean = bistros.flatMap((restaurant) => restaurant.contacts).find((person) => person.lastname === "Dupont");
		expect(jean?.crispEmail).toBeDefined();
		expect(jean?.crispEmail).not.toBe(jean?.email);
	});
});
