/**
 * Traduit les données PipingTable en propriétés HubSpot. Fonctions pures, sans réseau.
 */
import type { Deal, DealLine, DealStage, Person, Plan, Product, Restaurant } from "./pipingtable.ts";

export type ObjectType = "companies" | "contacts" | "deals" | "line_items";

/** Étapes du pipeline « Sales Pipeline » par défaut de HubSpot. */
export const STAGE_ID: Record<DealStage, string> = {
	demo: "appointmentscheduled",
	"contrat-envoye": "contractsent",
	signe: "closedwon",
	perdu: "closedlost",
};

const PLAN_LABEL: Record<Plan, string> = { essentiel: "Essentiel", premium: "Premium", groupe: "Groupe" };
const SELLERS = ["Thomas Girard", "Nadia Benali", "Sarah Lambert"];

export interface PropertyDef {
	name: string;
	label: string;
	type: "string" | "number" | "enumeration" | "bool";
	fieldType: "text" | "textarea" | "number" | "select" | "booleancheckbox";
	groupName: string;
	options?: { label: string; value: string }[];
}

const options = (values: string[]) => values.map((value) => ({ label: value, value }));
const SEED_FLAG = (groupName: string): PropertyDef => ({
	name: "demo_seed",
	label: "Créé pour la démo",
	type: "bool",
	fieldType: "booleancheckbox",
	groupName,
	options: [
		{ label: "Oui", value: "true" },
		{ label: "Non", value: "false" },
	],
});

/** Propriétés personnalisées que le script crée, si la clé en a le droit. */
export const CUSTOM_PROPERTIES: Partial<Record<ObjectType, PropertyDef[]>> = {
	companies: [
		{ name: "pt_offre", label: "Offre PipingTable", type: "enumeration", fieldType: "select", groupName: "companyinformation", options: options(Object.values(PLAN_LABEL)) },
		{ name: "pt_etablissements", label: "Nombre d'établissements", type: "number", fieldType: "number", groupName: "companyinformation" },
		{ name: "siren", label: "SIREN", type: "string", fieldType: "text", groupName: "companyinformation" },
		SEED_FLAG("companyinformation"),
	],
	contacts: [SEED_FLAG("contactinformation")],
	deals: [
		{ name: "pt_commercial", label: "Commercial", type: "enumeration", fieldType: "select", groupName: "dealinformation", options: options(SELLERS) },
		{ name: "conditions_particulieres", label: "Conditions particulières", type: "string", fieldType: "textarea", groupName: "dealinformation" },
		SEED_FLAG("dealinformation"),
	],
};

/** Les propriétés personnalisées réellement disponibles, sous la forme « companies.siren ». */
export type Available = ReadonlySet<string>;
type Props = Record<string, string>;

function custom(available: Available, type: ObjectType, values: Record<string, string | number | undefined>): Props {
	const props: Props = {};
	for (const [name, value] of Object.entries(values)) {
		if (value !== undefined && available.has(`${type}.${name}`)) props[name] = String(value);
	}
	return props;
}

export function lifecycle(restaurant: Restaurant): "customer" | "opportunity" | "other" {
	if (restaurant.deals.some((deal) => deal.stage === "signe")) return "customer";
	if (restaurant.deals.some((deal) => deal.stage === "demo" || deal.stage === "contrat-envoye")) return "opportunity";
	return "other";
}

/** Lisible dans HubSpot même sans propriétés personnalisées. */
export function companyDescription(restaurant: Restaurant): string {
	const parts = [restaurant.plan ? `Client PipingTable · Offre ${PLAN_LABEL[restaurant.plan]}` : "Prospect PipingTable"];
	parts.push(`${restaurant.sites} établissement${restaurant.sites > 1 ? "s" : ""}`);
	if (restaurant.siren) parts.push(`SIREN ${restaurant.siren}`);
	return parts.join(" · ");
}

export function companyProperties(restaurant: Restaurant, available: Available): Props {
	const props: Props = {
		name: restaurant.name,
		city: restaurant.city,
		country: restaurant.country,
		description: companyDescription(restaurant),
		...custom(available, "companies", {
			pt_offre: restaurant.plan && PLAN_LABEL[restaurant.plan],
			pt_etablissements: restaurant.sites,
			siren: restaurant.siren,
			demo_seed: "true",
		}),
	};
	if (restaurant.domain) props.domain = restaurant.domain;
	// Le doublon de 9 h 05 a été créé à la main, sans cycle de vie.
	if (restaurant.contacts.length > 0 || restaurant.deals.length > 0) props.lifecyclestage = lifecycle(restaurant);
	return props;
}

/** Seule l'adresse HubSpot est enregistrée : l'adresse Crisp (`crispEmail`) doit rester introuvable. */
export function contactProperties(person: Person, restaurant: Restaurant, available: Available): Props {
	const props: Props = {
		firstname: person.firstname,
		lastname: person.lastname,
		email: person.email,
		jobtitle: person.jobtitle,
		company: restaurant.name,
		city: restaurant.city,
		country: restaurant.country,
		lifecyclestage: lifecycle(restaurant),
		...custom(available, "contacts", { demo_seed: "true" }),
	};
	if (person.phone) props.phone = person.phone;
	return props;
}

export function productBySku(products: Product[], sku: string): Product {
	const product = products.find((candidate) => candidate.sku === sku);
	if (!product) throw new Error(`Produit inconnu : ${sku}`);
	return product;
}

function lineTotal(line: DealLine, product: Product): number {
	return product.price * line.quantity * (1 - (line.discountPct ?? 0) / 100);
}

/** Montant de la transaction : le premier mois (abonnements) plus les frais uniques. */
export function dealAmount(deal: Deal, products: Product[]): number {
	return Math.round(deal.lines.reduce((sum, line) => sum + lineTotal(line, productBySku(products, line.sku)), 0) * 100) / 100;
}

export function dealName(restaurant: Restaurant, deal: Deal, products: Product[]): string {
	const main = deal.lines[0] ? productBySku(products, deal.lines[0].sku).name : "Abonnement";
	return `${restaurant.name} · ${main}`;
}

export function dealProperties(restaurant: Restaurant, deal: Deal, products: Product[], available: Available): Props {
	return {
		dealname: dealName(restaurant, deal, products),
		pipeline: "default",
		dealstage: STAGE_ID[deal.stage],
		closedate: `${deal.closeDate}T12:00:00.000Z`,
		amount: String(dealAmount(deal, products)),
		...custom(available, "deals", {
			pt_commercial: deal.seller,
			conditions_particulieres: deal.conditions,
			demo_seed: "true",
		}),
	};
}

/** Une ligne libre (nom, prix, référence) : pas besoin de la bibliothèque de produits. */
export function lineItemProperties(line: DealLine, products: Product[]): Props {
	const product = productBySku(products, line.sku);
	const props: Props = {
		name: product.name,
		hs_sku: product.sku,
		price: String(product.price),
		quantity: String(line.quantity),
		description: product.description,
	};
	if (line.discountPct) props.hs_discount_percentage = String(line.discountPct);
	if (product.billing === "monthly") {
		props.recurringbillingfrequency = "monthly";
		props.hs_recurring_billing_period = "P12M";
	}
	return props;
}
