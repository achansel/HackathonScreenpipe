import { describe, expect, test } from "bun:test";
import { HubSpot, HubSpotError } from "../src/seed/hubspot.ts";
import { companyProperties, contactProperties, dealAmount, dealProperties, lineItemProperties } from "../src/seed/mapping.ts";
import { PRODUCTS, RESTAURANTS, type Restaurant } from "../src/seed/pipingtable.ts";
import { ensureProperties, fillCustomProperties, type Manifest, type SeededRestaurant, seedRestaurant, wipe } from "../src/seed/seeder.ts";

const bistro = RESTAURANTS.find((restaurant) => restaurant.key === "le-bistro")!;
const doublon = RESTAURANTS.find((restaurant) => restaurant.key === "le-bistro-doublon")!;
const osteria = RESTAURANTS.find((restaurant) => restaurant.key === "osteria-nonna")!;
const ALL = new Set(["companies.pt_offre", "companies.siren", "deals.pt_commercial", "deals.conditions_particulieres"]);

describe("Traduction en propriétés HubSpot", () => {
	test("l'adresse Crisp de Jean Dupont n'entre pas dans HubSpot", () => {
		const props = contactProperties(bistro.contacts[0]!, bistro, ALL);
		expect(props.email).toBe("jean.dupont@example.com");
		expect(JSON.stringify(props)).not.toContain("jd.resto75@resa-paris.test");
		expect(props.lifecyclestage).toBe("customer");
	});

	test("sans droit sur les propriétés personnalisées, les infos restent dans la description", () => {
		const props = companyProperties(bistro, new Set());
		expect(props.siren).toBeUndefined();
		expect(props.description).toBe("Client PipingTable · Offre Premium · 1 établissement · SIREN 900100001");
	});

	test("le doublon n'a ni domaine ni cycle de vie", () => {
		const props = companyProperties(doublon, ALL);
		expect(props.domain).toBeUndefined();
		expect(props.lifecyclestage).toBeUndefined();
	});

	test("montant et remise", () => {
		const deal = osteria.deals[0]!;
		// 2 × 99 € − 20 % + 2 × 19 €
		expect(dealAmount(deal, PRODUCTS)).toBe(196.4);
		expect(dealProperties(osteria, deal, PRODUCTS, ALL)).toMatchObject({ dealstage: "contractsent", pt_commercial: "Nadia Benali" });
		expect(lineItemProperties(deal.lines[0]!, PRODUCTS)).toMatchObject({ hs_discount_percentage: "20", recurringbillingfrequency: "monthly" });
		expect(lineItemProperties({ sku: "PT-INSTALL", quantity: 1 }, PRODUCTS).recurringbillingfrequency).toBeUndefined();
	});
});

/** Un faux HubSpot : il attribue des identifiants et peut échouer sur une requête donnée. */
function fakeHubSpot(options: { failOn?: (method: string, path: string) => boolean; forbidSchemas?: boolean } = {}) {
	const calls: string[] = [];
	const objects = new Map<string, Record<string, string>>();
	let nextId = 100;
	const fetch = async (url: string | URL | Request, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		const path = String(url).replace("https://api.hubapi.com", "");
		calls.push(`${method} ${path}`);
		if (options.failOn?.(method, path)) return Response.json({ category: "VALIDATION_ERROR", message: "refusé" }, { status: 400 });
		if (path.startsWith("/crm/v3/properties/")) {
			return options.forbidSchemas ? Response.json({ category: "MISSING_SCOPES", message: "non" }, { status: 403 }) : Response.json({}, { status: 201 });
		}
		const create = path.match(/^\/crm\/v3\/objects\/(\w+)$/);
		if (method === "POST" && create) {
			const id = String(nextId++);
			objects.set(`${create[1]}/${id}`, JSON.parse(String(init?.body)).properties);
			return Response.json({ id }, { status: 201 });
		}
		const remove = path.match(/^\/crm\/v3\/objects\/(\w+)\/(\d+)$/);
		if (method === "DELETE" && remove) {
			const existed = objects.delete(`${remove[1]}/${remove[2]}`);
			return new Response(null, { status: existed ? 204 : 404 });
		}
		return Response.json({});
	};
	const api = new HubSpot("jeton-secret", { fetch: fetch as typeof globalThis.fetch, sleep: async () => {}, minGapMs: 0 });
	return { api, calls, objects };
}

const emptyRecord = (): SeededRestaurant => ({ contacts: {}, deals: [], complete: false });

describe("Création et effacement", () => {
	test("Le Bistro : entreprise, contact, vente, trois lignes, toutes reliées", async () => {
		const hub = fakeHubSpot();
		const record = emptyRecord();
		await seedRestaurant(hub.api, bistro, PRODUCTS, ALL, record);
		expect(record.complete).toBe(true);
		expect(record.deals[0]!.lineItems).toHaveLength(3);
		const associations = hub.calls.filter((call) => call.startsWith("PUT")).map((call) => call.replace(/\d+/g, "#"));
		expect(associations).toEqual([
			"PUT /crm/v#/objects/contacts/#/associations/default/companies/#",
			"PUT /crm/v#/objects/contacts/#/associations/companies/#",
			"PUT /crm/v#/objects/deals/#/associations/default/companies/#",
			"PUT /crm/v#/objects/deals/#/associations/default/contacts/#",
			...Array(3).fill("PUT /crm/v#/objects/line_items/#/associations/default/deals/#"),
		]);
	});

	test("une erreur en route : ce qui est créé reste noté, et un nouvel essai reprend sans doublon", async () => {
		let fail = true;
		const hub = fakeHubSpot({ failOn: (method, path) => fail && method === "POST" && path.endsWith("/line_items") && hub.objects.size > 3 });
		const record = emptyRecord();
		await expect(seedRestaurant(hub.api, bistro, PRODUCTS, ALL, record)).rejects.toBeInstanceOf(HubSpotError);
		expect(record.complete).toBe(false);
		expect(record.deals[0]!.lineItems).toHaveLength(1);

		fail = false;
		await seedRestaurant(hub.api, bistro, PRODUCTS, ALL, record);
		expect(record.complete).toBe(true);
		expect([...hub.objects.keys()].filter((key) => key.startsWith("companies/"))).toHaveLength(1);
		expect([...hub.objects.keys()].filter((key) => key.startsWith("line_items/"))).toHaveLength(3);
	});

	test("wipe efface tout, même ce qui a déjà disparu", async () => {
		const hub = fakeHubSpot();
		const manifest: Manifest = { portalId: 1, uiDomain: "app-eu1.hubspot.com", restaurants: {} };
		for (const restaurant of [bistro, osteria] as Restaurant[]) {
			const record = emptyRecord();
			manifest.restaurants[restaurant.key] = record;
			await seedRestaurant(hub.api, restaurant, PRODUCTS, ALL, record);
		}
		await hub.api.remove("contacts", manifest.restaurants["le-bistro"]!.contacts["jean.dupont@example.com"]!);
		await wipe(hub.api, manifest, () => {}, () => {});
		expect(hub.objects.size).toBe(0);
		expect(manifest.restaurants).toEqual({});
	});

	test("sans droit sur les schémas, aucune propriété personnalisée n'est envoyée", async () => {
		const hub = fakeHubSpot({ forbidSchemas: true });
		const warnings: string[] = [];
		const available = await ensureProperties(hub.api, (line) => warnings.push(line));
		expect(available.size).toBe(0);
		expect(warnings[0]).toContain("crm.schemas");
		const record = emptyRecord();
		await seedRestaurant(hub.api, bistro, PRODUCTS, available, record);
		const company = hub.objects.get(`companies/${record.company}`)!;
		expect(company.siren).toBeUndefined();
		expect(company.demo_seed).toBeUndefined();
	});

	test("--fill ajoute seulement les propriétés personnalisées aux clients déjà créés", async () => {
		const hub = fakeHubSpot();
		const record = emptyRecord();
		await seedRestaurant(hub.api, osteria, PRODUCTS, new Set(), record);
		hub.calls.length = 0;
		const updated = await fillCustomProperties(hub.api, osteria, PRODUCTS, ALL, record);
		expect(updated).toBe(2);
		expect(hub.calls.map((call) => call.replace(/\d+$/, "#"))).toEqual(["PATCH /crm/v3/objects/companies/#", "PATCH /crm/v3/objects/deals/#"]);
	});

	test("le jeton n'apparaît pas dans les erreurs", async () => {
		const hub = fakeHubSpot({ failOn: () => true });
		const error = await hub.api.create("companies", { name: "x" }).catch((caught: Error) => caught);
		expect(String(error)).not.toContain("jeton-secret");
	});
});
