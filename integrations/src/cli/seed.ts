/**
 * Remplit le portail HubSpot de démo avec les clients PipingTable (src/seed/pipingtable.ts).
 *
 * `bun run seed --dry-run`               ce qui serait créé, sans réseau ni jeton
 * `bun run seed --only le-bistro,…`      seulement ces clients (clés de pipingtable.ts)
 * `bun run seed --limit 2`               les N premiers clients
 * `bun run seed`                         tous ; ceux déjà créés sont sautés
 * `bun run seed --wipe`                  efface tout ce que le script a créé
 * `bun run seed --fill`                  ajoute les propriétés personnalisées aux clients déjà créés
 *
 * Jeton : HUBSPOT_SEED_TOKEN (~/.config/friction/env), jamais affiché.
 * Manifeste des identifiants créés : FRICTION_SEED_MANIFEST, par défaut ~/.local/share/friction/hubspot-seed.json.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { HubSpot, HubSpotError } from "../seed/hubspot.ts";
import { companyProperties, contactProperties, dealProperties, lineItemProperties } from "../seed/mapping.ts";
import { PRODUCTS, RESTAURANTS, type Restaurant } from "../seed/pipingtable.ts";
import { ensureProperties, fillCustomProperties, loadManifest, type Manifest, recordUrl, saveManifest, seedRestaurant, wipe } from "../seed/seeder.ts";

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		"dry-run": { type: "boolean", default: false },
		only: { type: "string" },
		limit: { type: "string" },
		wipe: { type: "boolean", default: false },
		fill: { type: "boolean", default: false },
	},
});

const manifestPath = process.env.FRICTION_SEED_MANIFEST || join(homedir(), ".local", "share", "friction", "hubspot-seed.json");
const log = (line: string) => console.log(line);

function selection(): Restaurant[] {
	let chosen = RESTAURANTS;
	if (values.only) {
		const keys = values.only.split(",").map((key) => key.trim());
		const unknown = keys.filter((key) => !RESTAURANTS.some((restaurant) => restaurant.key === key));
		if (unknown.length > 0) throw new Error(`Clé inconnue : ${unknown.join(", ")}`);
		chosen = RESTAURANTS.filter((restaurant) => keys.includes(restaurant.key));
	}
	if (values.limit) chosen = chosen.slice(0, Number(values.limit));
	return chosen;
}

function dryRun(restaurants: Restaurant[]): void {
	const all = new Set(["companies.pt_offre", "companies.pt_etablissements", "companies.siren", "deals.pt_commercial", "deals.conditions_particulieres"]);
	for (const restaurant of restaurants) {
		log(`\n■ ${restaurant.key}`);
		log(`  entreprise ${JSON.stringify(companyProperties(restaurant, all))}`);
		for (const person of restaurant.contacts) log(`  contact    ${JSON.stringify(contactProperties(person, restaurant, all))}`);
		for (const deal of restaurant.deals) {
			log(`  vente      ${JSON.stringify(dealProperties(restaurant, deal, PRODUCTS, all))}`);
			for (const line of deal.lines) log(`    ligne    ${JSON.stringify(lineItemProperties(line, PRODUCTS))}`);
		}
	}
	const contacts = restaurants.reduce((sum, restaurant) => sum + restaurant.contacts.length, 0);
	const deals = restaurants.flatMap((restaurant) => restaurant.deals);
	log(`\n${restaurants.length} entreprises, ${contacts} contacts, ${deals.length} ventes, ${deals.flatMap((deal) => deal.lines).length} lignes.`);
}

async function main(): Promise<void> {
	const restaurants = selection();
	if (values["dry-run"]) return dryRun(restaurants);

	const token = process.env.HUBSPOT_SEED_TOKEN;
	if (!token) throw new Error("HUBSPOT_SEED_TOKEN absent : source ~/.config/friction/env");
	const api = new HubSpot(token);
	const account = await api.accountDetails();
	const manifest: Manifest = loadManifest(manifestPath) ?? { portalId: account.portalId, uiDomain: account.uiDomain, restaurants: {} };
	if (manifest.portalId !== account.portalId) {
		throw new Error(`Le manifeste concerne le portail ${manifest.portalId}, la clé ouvre le ${account.portalId} : rien n'est fait.`);
	}
	const save = () => saveManifest(manifestPath, manifest);

	if (values.wipe) {
		log(`Effacement de ${Object.keys(manifest.restaurants).length} clients du portail ${account.portalId}…`);
		await wipe(api, manifest, log, save);
		save();
		log("Terminé.");
		return;
	}

	if (account.companyCurrency !== "EUR" || account.timeZone !== "Europe/Paris") {
		log(`⚠ Portail en ${account.companyCurrency}, ${account.timeZone} : attendu EUR, Europe/Paris (Paramètres → Compte).`);
	}
	const available = await ensureProperties(api, log);
	if (values.fill) {
		if (available.size === 0) throw new Error("Aucune propriété personnalisée disponible : vérifier les droits crm.schemas.*.write de la clé.");
		let updated = 0;
		for (const restaurant of restaurants) {
			const record = manifest.restaurants[restaurant.key];
			if (record) updated += await fillCustomProperties(api, restaurant, PRODUCTS, available, record);
		}
		log(`${updated} objets complétés.`);
		return;
	}
	let created = 0;
	for (const restaurant of restaurants) {
		const record = (manifest.restaurants[restaurant.key] ??= { contacts: {}, deals: [], complete: false });
		if (record.complete) continue;
		try {
			await seedRestaurant(api, restaurant, PRODUCTS, available, record);
			created++;
			log(`  ✓ ${restaurant.key}`);
		} finally {
			save();
		}
	}
	log(`\n${created} clients créés (${Object.keys(manifest.restaurants).length} au total). Manifeste : ${manifestPath}`);

	const bistro = manifest.restaurants["le-bistro"];
	const jean = bistro?.contacts["jean.dupont@example.com"];
	if (bistro?.complete && jean && bistro.deals[0]) {
		log("\nURL pour la démo (à mettre dans l'environnement) :");
		log(`export DEMO_HUBSPOT_RECORD_URL="${recordUrl(manifest, "0-1", jean)}"`);
		log(`export DEMO_HUBSPOT_DEAL_URL="${recordUrl(manifest, "0-3", bistro.deals[0].id)}"`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof HubSpotError || error instanceof Error ? `✗ ${error.message}` : error);
	process.exit(1);
});
