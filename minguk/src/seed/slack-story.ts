/**
 * Le Slack de PipingTable : les canaux de travail et l'historique où vivent les règles non écrites.
 * Les règles sont celles de HOUSE_RULES (pipingtable.ts) ; Léa est jouée par la personne qui présente.
 *
 * Volontairement : la règle du geste commercial n'existe que dans un fil de #support (la page Notion
 * est périmée), et la demande de remise d'Osteria Nonna reste sans réponse.
 */

export interface Persona {
	name: string;
	/** Portrait illustré (DiceBear, style « avataaars ») : pas un vrai visage. */
	avatar: string;
}

// Slack refuse une icon_url de plus de ~255 caractères : seulement les traits qui comptent.
const AVATAR = "https://api.dicebear.com/9.x/avataaars/png?mouth=smile&eyes=default&eyebrows=defaultNatural&clothing=blazerAndShirt";
const avatar = (look: Record<string, string>) => `${AVATAR}&${new URLSearchParams({ facialHairProbability: "0", ...look })}`;

export const PERSONAS = {
	claire: { name: "Claire Morin (resp. support)", avatar: avatar({ seed: "Claire", top: "bob", hairColor: "4a312c", skinColor: "edb98a", backgroundColor: "c0aede" }) },
	karim: { name: "Karim Bensaïd (support)", avatar: avatar({ seed: "Karim", top: "shortFlat", hairColor: "2c1b18", skinColor: "ae5d29", backgroundColor: "b6e3f4", facialHair: "beardLight", facialHairProbability: "100" }) },
	yasmine: { name: "Yasmine Roche (support)", avatar: avatar({ seed: "Yasmine", top: "longButNotTooLong", hairColor: "2c1b18", skinColor: "d08b5b", backgroundColor: "ffd5dc" }) },
	thomas: { name: "Thomas Girard (ventes)", avatar: avatar({ seed: "Thomas", top: "shortWaved", hairColor: "a55728", skinColor: "ffdbb4", backgroundColor: "d1d4f9" }) },
	nadia: { name: "Nadia Benali (ventes)", avatar: avatar({ seed: "Nadia", top: "curly", hairColor: "2c1b18", skinColor: "ae5d29", backgroundColor: "ffdfbf" }) },
	sarah: { name: "Sarah Lambert (ventes Belgique)", avatar: avatar({ seed: "Sarah", top: "straight01", hairColor: "d6b370", skinColor: "ffdbb4", backgroundColor: "c0aede" }) },
	antoine: { name: "Antoine Rey (COO)", avatar: avatar({ seed: "Antoine", top: "sides", hairColor: "4a312c", skinColor: "edb98a", backgroundColor: "b6e3f4", facialHair: "beardMedium", facialHairProbability: "100" }) },
	max: { name: "Max Durand (tech)", avatar: avatar({ seed: "Max", top: "shortCurly", hairColor: "724133", skinColor: "ffdbb4", backgroundColor: "d1d4f9" }) },
} satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof PERSONAS;

export interface StoryMessage {
	from: PersonaKey;
	text: string;
	pin?: boolean;
	replies?: { from: PersonaKey; text: string }[];
}

export interface StoryChannel {
	name: string;
	purpose: string;
	messages: StoryMessage[];
}

export const CHANNELS: StoryChannel[] = [
	{
		name: "onboarding",
		purpose: "Bienvenue aux nouveaux : par où commencer",
		messages: [
			{
				from: "claire",
				text: "Bienvenue à Léa qui rejoint le support aujourd'hui ! 🎉\nLes process sont dans Notion (page « Process support »). Pour toute question : #support.",
				replies: [{ from: "karim", text: "Bienvenue Léa ! N'hésite pas, on est tous passés par là 🙂" }],
			},
		],
	},
	{
		name: "support",
		purpose: "Questions et entraide du support client",
		messages: [
			{
				from: "yasmine",
				text: "Un client m'écrit sur Crisp avec une adresse perso, je ne le trouve pas dans HubSpot 😩",
				replies: [
					{
						from: "karim",
						text: "Classique : les clients écrivent souvent avec une autre adresse que celle du contrat. Cherche par téléphone, par le domaine du site du restaurant, ou par le nom du restaurant.",
					},
				],
			},
			{
				from: "yasmine",
				text: "Où est-ce qu'on voit l'offre d'un client ? La fiche contact ne l'affiche pas",
				replies: [
					{ from: "karim", text: "Contact → Entreprise → Transactions → le contrat signé → Produits. 4 clics, oui 😅" },
					{ from: "claire", text: "Hugo doit ajouter l'offre sur la fiche contact, c'est dans sa liste." },
				],
			},
			{
				from: "yasmine",
				text: "La page de réservation de Chez Mounia ne charge plus, quelqu'un sait ce qui se passe ?",
				replies: [
					{
						from: "karim",
						text: "Pas ici 🙂 Les bugs vont dans #bugs, avec le modèle épinglé. Et le ticket HubSpot dans le pipeline « Support », pas « Support OLD ».",
					},
				],
			},
			{
				from: "yasmine",
				text: "Un client premium demande un dédommagement après la panne de mardi. J'ai le droit de faire quoi ?",
				replies: [
					{
						from: "claire",
						text: "Règle : 1 mois offert maximum, et seulement pour les Premium ou Groupe. Sinon, un bon de 10 %. Et toujours la note « geste commercial » dans HubSpot.",
					},
					{ from: "claire", text: "(la page Notion dit encore 2 mois, elle n'est plus à jour : je la corrige dès que j'ai 5 minutes 🙈)" },
					{ from: "yasmine", text: "Merci Claire !" },
				],
			},
			{
				from: "karim",
				text: "Rappel : une promesse d'un commercial doit être notée dans « Conditions particulières » de la transaction. Si un client dit « on m'a promis… » et que ce n'est pas noté, on demande au commercial avant de confirmer quoi que ce soit.",
			},
		],
	},
	{
		name: "bugs",
		purpose: "Signaler un bug client, avec le modèle épinglé",
		messages: [
			{
				from: "claire",
				pin: true,
				text: "📌 Modèle pour signaler un bug :\n[Bug] <restaurant> · <symptôme>\nClient : <nom> (<offre>)\nSymptôme : …\nDepuis : …\nFiche HubSpot : <lien>",
			},
			{
				from: "yasmine",
				text: "[Bug] Chez Mounia · page de réservation blanche\nClient : Mounia Haddad (Premium)\nSymptôme : la page reste blanche sur mobile\nDepuis : ce matin, 10 h\nFiche HubSpot : dans la fiche entreprise",
				replies: [{ from: "max", text: "Corrigé ✅ c'était le cache du CDN." }],
			},
			{
				from: "karim",
				text: "[Bug] Le Quai 12 · rappels SMS non envoyés\nClient : Jean-Baptiste Morel (Premium)\nSymptôme : aucun SMS de rappel depuis samedi\nDepuis : samedi",
				replies: [{ from: "max", text: "Pris, je regarde 👀" }],
			},
		],
	},
	{
		name: "deal-desk",
		purpose: "Validation des remises de plus de 15 %, avant le contrat",
		messages: [
			{
				from: "thomas",
				text: "Les Tontons Burger, 3 sites : je peux aller jusqu'à 25 % ?",
				replies: [{ from: "antoine", text: "20 % maximum sur ce volume. Au-delà de 15 %, toujours ici avant d'envoyer le contrat 👍" }],
			},
			{ from: "nadia", text: "Osteria Nonna (Lille, 2 sites) : 20 % sur l'offre Premium. Validation svp 🙏" },
		],
	},
	{
		name: "new-leads",
		purpose: "Nouveaux prospects à attribuer",
		messages: [
			{
				from: "sarah",
				pin: true,
				text: "Rappel : les prospects belges sont pour moi. Créez le contact en « Lead » dans HubSpot et postez-le ici, je reprends 😊",
			},
			{ from: "sarah", text: "Lead : Brasserie du Nord (Liège), 1 site, démo faite. Je m'en occupe." },
		],
	},
];
