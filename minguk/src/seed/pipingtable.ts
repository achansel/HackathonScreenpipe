/**
 * PipingTable : l'entreprise fictive de la démo (un logiciel de réservation vendu aux restaurants).
 * Ce fichier décrit son catalogue et ses clients ; le script de création HubSpot le lira tel quel.
 * Présentation pour l'équipe : build/pipingtable.md.
 *
 * Règles (CLAUDE.md, docs/crisp.md) : e-mails en @example.com uniquement, noms inventés,
 * téléphones dans la plage 06 39 98 xx xx (réservée à la fiction).
 */

export type Plan = "essentiel" | "premium" | "groupe";
export type DealStage = "demo" | "contrat-envoye" | "signe" | "perdu";
export type Seller = "Thomas Girard" | "Sarah Lambert" | "Nadia Benali";

export interface Product {
	sku: string;
	name: string;
	/** Prix HT en euros : par mois et par établissement si `monthly`, sinon une fois. */
	price: number;
	billing: "monthly" | "once";
	description: string;
}

export interface Person {
	firstname: string;
	lastname: string;
	/** L'adresse enregistrée dans HubSpot. */
	email: string;
	phone?: string;
	jobtitle: string;
	/** L'adresse avec laquelle la personne écrit dans Crisp, quand elle diffère (friction de 9 h 05). */
	crispEmail?: string;
}

export interface DealLine {
	sku: string;
	quantity: number;
	discountPct?: number;
}

export interface Deal {
	stage: DealStage;
	seller: Seller;
	/** Date de signature, ou date de clôture prévue (AAAA-MM-JJ). */
	closeDate: string;
	lines: DealLine[];
	/** Champ « Conditions particulières » : là où les commerciaux doivent noter leurs promesses. */
	conditions?: string;
}

export interface Restaurant {
	key: string;
	name: string;
	/** Domaine du site, en .example (réservé, n'existe pas). */
	domain?: string;
	city: string;
	country: "France" | "Belgique";
	siren?: string;
	plan?: Plan;
	sites: number;
	contacts: Person[];
	deals: Deal[];
	/** Pourquoi ce client existe dans la démo, s'il sert une friction de UseCase.md. */
	scenario?: string;
}

/** Un prospect qui écrit dans Crisp mais n'existe pas encore dans HubSpot. */
export interface CrispOnly {
	person: Person;
	company: string;
	city: string;
	country: "France" | "Belgique";
	scenario: string;
}

export const PRODUCTS: Product[] = [
	{ sku: "PT-ESS", name: "Offre Essentiel", price: 49, billing: "monthly", description: "Réservation en ligne, plan de salle, 1 établissement" },
	{ sku: "PT-PREM", name: "Offre Premium", price: 99, billing: "monthly", description: "Essentiel + statistiques, support prioritaire, appel de suivi mensuel" },
	{ sku: "PT-GRP", name: "Offre Groupe", price: 79, billing: "monthly", description: "Premium pour 3 établissements ou plus, prix par établissement" },
	{ sku: "PT-SMS", name: "Rappels SMS", price: 15, billing: "monthly", description: "Rappel automatique la veille de la réservation" },
	{ sku: "PT-ACOMPTE", name: "Acompte anti no-show", price: 19, billing: "monthly", description: "Empreinte bancaire ou acompte à la réservation" },
	{ sku: "PT-GOOGLE", name: "Réserver avec Google", price: 10, billing: "monthly", description: "Bouton de réservation sur la fiche Google" },
	{ sku: "PT-AVIS", name: "Avis clients", price: 12, billing: "monthly", description: "Demande d'avis après le repas" },
	{ sku: "PT-INSTALL", name: "Installation sur site", price: 150, billing: "once", description: "Un technicien installe et paramètre sur place" },
	{ sku: "PT-FORM", name: "Formation de l'équipe", price: 90, billing: "once", description: "1 h 30 de formation pour la salle" },
];

/** Les règles maison que les aides 📘 et 💬 doivent connaître (UseCase.md, sections 2 et 3). */
export const HOUSE_RULES = [
	"Geste commercial : 1 mois offert au maximum, clients Premium ou Groupe seulement ; sinon un bon de 10 %. Note « geste commercial » dans HubSpot.",
	"Bug client : message dans #bugs avec le modèle ; ticket dans le pipeline « Support », jamais « Support OLD ».",
	"Promesse d'un commercial : toujours notée dans « Conditions particulières » de la transaction.",
	"Remise de plus de 15 % : validation dans #deal-desk avant d'envoyer le contrat.",
	"Prospect belge : Sarah Lambert, cycle de vie « Lead », puis un message dans #new-leads.",
	"Clôturer une vente : le SIREN de l'entreprise est obligatoire.",
] as const;

const phone = (n: number) => `+33 6 39 98 ${String(Math.floor(n / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}`;

/** Les clients au cœur des frictions de la démo. */
const SCENARIO: Restaurant[] = [
	{
		key: "le-bistro",
		name: "Le Bistro",
		domain: "le-bistro.example",
		city: "Paris",
		country: "France",
		siren: "900100001",
		plan: "premium",
		sites: 1,
		contacts: [
			{
				firstname: "Jean",
				lastname: "Dupont",
				email: "jean.dupont@example.com",
				crispEmail: "jean.d@example.com",
				phone: phone(1001),
				jobtitle: "Gérant",
			},
		],
		deals: [
			{
				stage: "signe",
				seller: "Thomas Girard",
				closeDate: "2026-03-12",
				lines: [
					{ sku: "PT-PREM", quantity: 1 },
					{ sku: "PT-SMS", quantity: 1 },
					{ sku: "PT-ACOMPTE", quantity: 1 },
				],
			},
		],
		scenario: "9 h 05 client introuvable (e-mail Crisp différent) ; 9 h 20 offre à 4 clics ; 9 h 40 bug ; 11 h geste commercial",
	},
	{
		key: "le-bistro-doublon",
		name: "Le Bistro",
		city: "Paris",
		country: "France",
		sites: 1,
		contacts: [],
		deals: [],
		scenario: "9 h 05 : doublon créé à la main en mars, sans contact ni transaction",
	},
	{
		key: "maison-pivoine",
		name: "Maison Pivoine",
		domain: "maison-pivoine.example",
		city: "Nantes",
		country: "France",
		siren: "900100002",
		plan: "premium",
		sites: 1,
		contacts: [{ firstname: "Élodie", lastname: "Marchand", email: "elodie.marchand@example.com", phone: phone(1002), jobtitle: "Propriétaire" }],
		deals: [
			{
				stage: "signe",
				seller: "Thomas Girard",
				closeDate: "2026-10-14",
				lines: [
					{ sku: "PT-PREM", quantity: 1 },
					{ sku: "PT-GOOGLE", quantity: 1 },
				],
			},
		],
		scenario: "14 h : « Thomas m'a promis l'installation gratuite », rien dans les conditions particulières",
	},
	{
		key: "le-petit-zinc",
		name: "Le Petit Zinc",
		domain: "le-petit-zinc.example",
		city: "Bordeaux",
		country: "France",
		sites: 1,
		contacts: [{ firstname: "Luc", lastname: "Fabre", email: "luc.fabre@example.com", phone: phone(1003), jobtitle: "Gérant" }],
		deals: [
			{
				stage: "contrat-envoye",
				seller: "Thomas Girard",
				closeDate: "2026-10-20",
				lines: [
					{ sku: "PT-ESS", quantity: 1 },
					{ sku: "PT-SMS", quantity: 1 },
				],
			},
		],
		scenario: "Thomas : impossible de clôturer, SIREN manquant",
	},
	{
		key: "osteria-nonna",
		name: "Osteria Nonna",
		domain: "osteria-nonna.example",
		city: "Lille",
		country: "France",
		siren: "900100004",
		sites: 2,
		contacts: [{ firstname: "Giulia", lastname: "Rinaldi", email: "giulia.rinaldi@example.com", phone: phone(1004), jobtitle: "Associée" }],
		deals: [
			{
				stage: "contrat-envoye",
				seller: "Nadia Benali",
				closeDate: "2026-10-24",
				lines: [
					{ sku: "PT-PREM", quantity: 2, discountPct: 20 },
					{ sku: "PT-ACOMPTE", quantity: 2 },
				],
			},
		],
		scenario: "Thomas/Nadia : remise de 20 % en attente de validation dans #deal-desk",
	},
	{
		key: "saveurs-du-sud",
		name: "Groupe Saveurs du Sud",
		domain: "saveurs-du-sud.example",
		city: "Marseille",
		country: "France",
		siren: "900100005",
		plan: "groupe",
		sites: 5,
		contacts: [
			{ firstname: "Sophie", lastname: "Arnaud", email: "sophie.arnaud@example.com", phone: phone(1005), jobtitle: "Directrice générale" },
			{ firstname: "Jean-Marc", lastname: "Ferrand", email: "jean-marc.ferrand@example.com", phone: phone(1006), jobtitle: "Responsable des opérations" },
		],
		deals: [
			{
				stage: "signe",
				seller: "Nadia Benali",
				closeDate: "2026-01-20",
				lines: [
					{ sku: "PT-GRP", quantity: 5 },
					{ sku: "PT-GOOGLE", quantity: 5 },
					{ sku: "PT-INSTALL", quantity: 1 },
				],
				conditions: "Installation des 5 sites en une seule visite.",
			},
		],
		scenario: "Groupe de 5 restaurants : « quel contrat couvre ce site ? »",
	},
];

/** Le reste du portefeuille, pour que HubSpot ait l'air habité (beaucoup de « Jean », plusieurs « Bistro »). */
const PORTFOLIO: Restaurant[] = (
	[
		["bistrot-du-marche", "Bistrot du Marché", "Lyon", "essentiel", 1, "Jean", "Moreau", "2025-11-03", "Thomas Girard", ["PT-ESS"]],
		["bistro-des-canuts", "Bistro des Canuts", "Lyon", "premium", 1, "Camille", "Robert", "2026-02-18", "Nadia Benali", ["PT-PREM", "PT-AVIS"]],
		["chez-mounia", "Chez Mounia", "Paris", "premium", 1, "Mounia", "Haddad", "2026-05-06", "Thomas Girard", ["PT-PREM", "PT-ACOMPTE"]],
		["l-escale", "L'Escale", "La Rochelle", "essentiel", 1, "Jean", "Lefebvre", "2025-12-09", "Nadia Benali", ["PT-ESS", "PT-SMS"]],
		["le-jardin-d-hiver", "Le Jardin d'Hiver", "Strasbourg", "premium", 1, "Claire", "Weber", "2026-04-22", "Nadia Benali", ["PT-PREM", "PT-GOOGLE"]],
		["au-vieux-four", "Au Vieux Four", "Toulouse", "essentiel", 1, "Jeanne", "Roux", "2026-06-30", "Thomas Girard", ["PT-ESS"]],
		["la-fourchette-verte", "La Fourchette Verte", "Rennes", "essentiel", 1, "Hugo", "Lemaire", "2026-07-15", "Thomas Girard", ["PT-ESS", "PT-AVIS"]],
		["le-quai-12", "Le Quai 12", "Bordeaux", "premium", 1, "Jean-Baptiste", "Morel", "2026-01-08", "Thomas Girard", ["PT-PREM", "PT-SMS", "PT-ACOMPTE"]],
		["sushi-kumo", "Sushi Kumo", "Paris", "premium", 2, "Kenji", "Mori", "2026-08-27", "Nadia Benali", ["PT-PREM", "PT-GOOGLE"]],
		["bella-sera", "Pizzeria Bella Sera", "Nice", "essentiel", 1, "Marco", "Bellini", "2025-10-21", "Nadia Benali", ["PT-ESS", "PT-SMS"]],
		["relais-du-port", "Le Relais du Port", "Brest", "essentiel", 1, "Jean", "Petit", "2026-03-30", "Thomas Girard", ["PT-ESS"]],
		["ker-avel", "Crêperie Ker Avel", "Quimper", "essentiel", 1, "Anne", "Le Gall", "2026-05-19", "Thomas Girard", ["PT-ESS", "PT-GOOGLE"]],
		["les-tontons", "Les Tontons Burger", "Lille", "premium", 3, "Yanis", "Brahimi", "2026-09-02", "Nadia Benali", ["PT-PREM", "PT-ACOMPTE"]],
		["le-petit-atelier", "Le Petit Atelier", "Annecy", "premium", 1, "Jean-Luc", "Gauthier", "2025-12-15", "Thomas Girard", ["PT-PREM", "PT-AVIS"]],
		["cafe-lumiere", "Café Lumière", "Montpellier", "essentiel", 1, "Inès", "Garcia", "2026-06-11", "Nadia Benali", ["PT-ESS"]],
		["le-bistro-gourmand", "Le Bistro Gourmand", "Dijon", "premium", 1, "Paul", "Bernard", "2026-02-02", "Thomas Girard", ["PT-PREM", "PT-SMS"]],
		["table-de-marius", "La Table de Marius", "Aix-en-Provence", "premium", 1, "Jean", "Fabre", "2026-04-08", "Nadia Benali", ["PT-PREM", "PT-ACOMPTE", "PT-GOOGLE"]],
		["comptoir-saint-pierre", "Le Comptoir Saint-Pierre", "Tours", "essentiel", 1, "Léon", "Dumas", "2026-08-05", "Thomas Girard", ["PT-ESS", "PT-SMS"]],
		["maison-sakura", "Maison Sakura", "Grenoble", "essentiel", 1, "Aiko", "Tanaka", "2026-09-23", "Nadia Benali", ["PT-ESS"]],
		["la-guinguette", "La Guinguette d'Auguste", "Angers", "essentiel", 1, "Margaux", "Perrin", "2025-11-27", "Thomas Girard", ["PT-ESS", "PT-AVIS"]],
		["brasserie-du-nord", "Brasserie du Nord", "Liège", "premium", 1, "Sander", "Peeters", "2026-07-01", "Sarah Lambert", ["PT-PREM"]],
		["les-comptoirs-de-lucie", "Les Comptoirs de Lucie", "Lyon", "groupe", 3, "Lucie", "Fontaine", "2026-03-04", "Nadia Benali", ["PT-GRP", "PT-SMS"]],
	] as const
).map(([key, name, city, plan, sites, firstname, lastname, closeDate, seller, skus], index): Restaurant => ({
	key,
	name,
	domain: `${key}.example`,
	city,
	country: city === "Liège" ? "Belgique" : "France",
	siren: `9002000${String(index + 1).padStart(2, "0")}`,
	plan,
	sites,
	contacts: [
		{
			firstname,
			lastname,
			email: `${slug(firstname)}.${slug(lastname)}@example.com`,
			phone: phone(2001 + index),
			jobtitle: "Gérant",
		},
	],
	deals: [{ stage: "signe", seller, closeDate, lines: skus.map((sku) => ({ sku, quantity: sites })) }],
}));

/** Des ventes qui n'ont pas abouti, et une en cours : un pipeline crédible. */
const LOST_AND_OPEN: Restaurant[] = [
	{
		key: "la-table-ronde",
		name: "La Table Ronde",
		domain: "la-table-ronde.example",
		city: "Reims",
		country: "France",
		sites: 1,
		contacts: [{ firstname: "Jean", lastname: "Mercier", email: "jean.mercier@example.com", phone: phone(3001), jobtitle: "Gérant" }],
		deals: [{ stage: "perdu", seller: "Thomas Girard", closeDate: "2026-06-18", lines: [{ sku: "PT-ESS", quantity: 1 }] }],
	},
	{
		key: "le-fil-rouge",
		name: "Le Fil Rouge",
		domain: "le-fil-rouge.example",
		city: "Metz",
		country: "France",
		sites: 1,
		contacts: [{ firstname: "Nora", lastname: "Klein", email: "nora.klein@example.com", phone: phone(3002), jobtitle: "Propriétaire" }],
		deals: [{ stage: "demo", seller: "Nadia Benali", closeDate: "2026-10-28", lines: [{ sku: "PT-PREM", quantity: 1 }] }],
	},
];

export const RESTAURANTS: Restaurant[] = [...SCENARIO, ...PORTFOLIO, ...LOST_AND_OPEN];

export const CRISP_ONLY: CrispOnly[] = [
	{
		person: { firstname: "Pieter", lastname: "Janssens", email: "pieter.janssens@example.com", jobtitle: "Associé" },
		company: "Brasserie des Arts (3 restaurants)",
		city: "Bruxelles",
		country: "Belgique",
		scenario: "15 h 30 : « Combien pour 3 restaurants ? » Un prospect belge, à créer en Lead pour Sarah",
	},
];

function slug(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z]+/g, "-")
		.replace(/^-|-$/g, "");
}
