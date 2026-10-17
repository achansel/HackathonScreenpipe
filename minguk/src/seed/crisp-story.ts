/**
 * Les clients qui écrivent dans Crisp pendant la démo, et leurs messages.
 * Mêmes personnes que dans HubSpot (pipingtable.ts), sauf l'adresse de Jean Dupont (friction de 9 h 05)
 * et Pieter Janssens, absent de HubSpot. Règles : docs/crisp.md.
 */

export interface CrispCustomer {
	key: string;
	nickname: string;
	email: string;
	/** Ce qu'on voit dans le simulateur, pas dans Crisp. */
	label: string;
	messages: { when: string; text: string }[];
}

export const CRISP_WEBSITE_ID = "7dc5c68e-4cc3-4480-879d-15eee53f96e9";

export const CRISP_CUSTOMERS: CrispCustomer[] = [
	{
		key: "jean-dupont",
		nickname: "Jean Dupont",
		email: "jean.d@example.com",
		label: "Le Bistro, Paris · Premium · adresse différente de HubSpot",
		messages: [
			{ when: "9 h 05", text: "Bonjour, ma page de réservation est en panne !! Les clients ne peuvent plus réserver pour ce soir." },
			{ when: "11 h 00", text: "Toujours rien… J'ai perdu des réservations ce midi, je veux un dédommagement." },
		],
	},
	{
		key: "elodie-marchand",
		nickname: "Élodie Marchand",
		email: "elodie.marchand@example.com",
		label: "Maison Pivoine, Nantes · Premium · signée il y a 3 jours",
		messages: [{ when: "14 h 00", text: "Bonjour ! Thomas m'avait promis l'installation sur place gratuite, quand passez-vous ?" }],
	},
	{
		key: "pieter-janssens",
		nickname: "Pieter Janssens",
		email: "pieter.janssens@example.com",
		label: "Brasserie des Arts, Bruxelles · prospect, absent de HubSpot",
		messages: [{ when: "15 h 30", text: "Bonjour, combien pour 3 restaurants ? Nous sommes à Bruxelles." }],
	},
	{
		key: "sophie-arnaud",
		nickname: "Sophie Arnaud",
		email: "sophie.arnaud@example.com",
		label: "Groupe Saveurs du Sud, Marseille · Groupe, 5 sites",
		messages: [{ when: "option", text: "Bonjour, le restaurant de Toulon n'envoie pas les rappels SMS. C'est inclus dans notre contrat ?" }],
	},
	// Anciennes conversations, pour que la boîte de réception ait l'air habitée.
	{
		key: "camille-robert",
		nickname: "Camille Robert",
		email: "camille.robert@example.com",
		label: "Bistro des Canuts, Lyon · historique",
		messages: [{ when: "historique", text: "Bonjour, comment ajouter une table en terrasse sur le plan de salle ?" }],
	},
	{
		key: "marco-bellini",
		nickname: "Marco Bellini",
		email: "marco.bellini@example.com",
		label: "Pizzeria Bella Sera, Nice · historique",
		messages: [{ when: "historique", text: "Les SMS de rappel partent à 8 h du matin, c'est possible de les envoyer plutôt à 11 h ?" }],
	},
	{
		key: "kenji-mori",
		nickname: "Kenji Mori",
		email: "kenji.mori@example.com",
		label: "Sushi Kumo, Paris · historique",
		messages: [{ when: "historique", text: "Bonjour, je ne trouve pas ma facture de septembre." }],
	},
	{
		key: "anne-le-gall",
		nickname: "Anne Le Gall",
		email: "anne.le-gall@example.com",
		label: "Crêperie Ker Avel, Quimper · historique",
		messages: [{ when: "historique", text: "Le bouton Réserver n'apparaît pas sur notre fiche Google, c'est normal ?" }],
	},
	{
		key: "yanis-brahimi",
		nickname: "Yanis Brahimi",
		email: "yanis.brahimi@example.com",
		label: "Les Tontons Burger, Lille · historique",
		messages: [{ when: "historique", text: "On voudrait demander un acompte seulement pour les tables de plus de 6 personnes." }],
	},
];
