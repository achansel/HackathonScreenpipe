/**
 * Crée les clients PipingTable dans HubSpot et note chaque identifiant dans un manifeste local,
 * pour pouvoir tout effacer (`wipe`) et recommencer.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HubSpot } from "./hubspot.ts";
import {
	type Available,
	CUSTOM_PROPERTIES,
	companyProperties,
	contactProperties,
	dealProperties,
	lineItemProperties,
	type ObjectType,
} from "./mapping.ts";
import type { Product, Restaurant } from "./pipingtable.ts";

export interface SeededDeal {
	id: string;
	lineItems: string[];
}

export interface SeededRestaurant {
	company?: string;
	/** Par adresse e-mail. */
	contacts: Record<string, string>;
	deals: SeededDeal[];
	complete: boolean;
}

export interface Manifest {
	portalId: number;
	uiDomain: string;
	restaurants: Record<string, SeededRestaurant>;
}

export type Log = (line: string) => void;

export function loadManifest(path: string): Manifest | undefined {
	if (!existsSync(path)) return undefined;
	return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

export function saveManifest(path: string, manifest: Manifest): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(manifest, null, "\t")}\n`, { mode: 0o600 });
}

/** Crée les propriétés personnalisées ; celles que la clé n'a pas le droit de créer sont simplement omises. */
export async function ensureProperties(api: HubSpot, log: Log): Promise<Available> {
	const available = new Set<string>();
	const forbidden: string[] = [];
	for (const [type, properties] of Object.entries(CUSTOM_PROPERTIES) as [ObjectType, NonNullable<(typeof CUSTOM_PROPERTIES)[ObjectType]>][]) {
		for (const property of properties) {
			const outcome = await api.createProperty(type, property);
			if (outcome === "forbidden") forbidden.push(`${type}.${property.name}`);
			else available.add(`${type}.${property.name}`);
		}
	}
	if (forbidden.length > 0) {
		log(`⚠ Propriétés non créées (droit crm.schemas.*.write manquant) : ${forbidden.join(", ")}. Les infos restent dans la description.`);
	}
	return available;
}

/**
 * Crée l'entreprise, ses contacts, ses transactions et leurs lignes. `record` est rempli au fur et à mesure :
 * si une requête échoue, ce qui a déjà été créé reste dans le manifeste et peut être effacé.
 */
export async function seedRestaurant(
	api: HubSpot,
	restaurant: Restaurant,
	products: Product[],
	available: Available,
	record: SeededRestaurant,
): Promise<void> {
	record.company ??= await api.create("companies", companyProperties(restaurant, available));
	const company = record.company;

	for (const person of restaurant.contacts) {
		if (record.contacts[person.email]) continue;
		const id = await api.create("contacts", contactProperties(person, restaurant, available));
		record.contacts[person.email] = id;
		await api.associate("contacts", id, "companies", company);
		await api.setPrimaryCompany(id, company);
	}

	const contactIds = Object.values(record.contacts);
	for (const [index, deal] of restaurant.deals.entries()) {
		let seeded = record.deals[index];
		if (!seeded) {
			const id = await api.create("deals", dealProperties(restaurant, deal, products, available));
			seeded = { id, lineItems: [] };
			record.deals[index] = seeded;
			await api.associate("deals", id, "companies", company);
			for (const contact of contactIds) await api.associate("deals", id, "contacts", contact);
		}
		for (const line of deal.lines.slice(seeded.lineItems.length)) {
			const lineItem = await api.create("line_items", lineItemProperties(line, products));
			seeded.lineItems.push(lineItem);
			await api.associate("line_items", lineItem, "deals", seeded.id);
		}
	}
	record.complete = true;
}

/** Ne garde que les propriétés personnalisées disponibles. */
function customOnly(type: ObjectType, props: Record<string, string>, available: Available): Record<string, string> {
	return Object.fromEntries(Object.entries(props).filter(([name]) => available.has(`${type}.${name}`)));
}

/**
 * Ajoute les propriétés personnalisées à un client déjà créé (quand le droit sur les schémas arrive après coup).
 * Renvoie le nombre d'objets mis à jour.
 */
export async function fillCustomProperties(
	api: HubSpot,
	restaurant: Restaurant,
	products: Product[],
	available: Available,
	record: SeededRestaurant,
): Promise<number> {
	let updated = 0;
	const patch = async (type: ObjectType, id: string | undefined, props: Record<string, string>) => {
		const custom = customOnly(type, props, available);
		if (!id || Object.keys(custom).length === 0) return;
		await api.update(type, id, custom);
		updated++;
	};
	await patch("companies", record.company, companyProperties(restaurant, available));
	for (const person of restaurant.contacts) await patch("contacts", record.contacts[person.email], contactProperties(person, restaurant, available));
	for (const [index, deal] of restaurant.deals.entries()) {
		await patch("deals", record.deals[index]?.id, dealProperties(restaurant, deal, products, available));
	}
	return updated;
}

/** Efface tout ce que le manifeste a créé, des lignes vers les entreprises. */
export async function wipe(api: HubSpot, manifest: Manifest, log: Log, onProgress: () => void): Promise<void> {
	for (const [key, record] of Object.entries(manifest.restaurants)) {
		for (const deal of record.deals) {
			for (const lineItem of deal.lineItems) await api.remove("line_items", lineItem);
			await api.remove("deals", deal.id);
		}
		for (const contact of Object.values(record.contacts)) await api.remove("contacts", contact);
		if (record.company) await api.remove("companies", record.company);
		delete manifest.restaurants[key];
		onProgress();
		log(`  effacé : ${key}`);
	}
}

export function recordUrl(manifest: Manifest, objectTypeId: "0-1" | "0-2" | "0-3", id: string): string {
	return `https://${manifest.uiDomain}/contacts/${manifest.portalId}/record/${objectTypeId}/${id}`;
}
