/**
 * Les notifications de la démo, en plusieurs variantes, pour le studio (`bun run studio:notifs`).
 * « Actuelle » reprend ce que le démon d'Andrea envoie aujourd'hui (agent/main.ts, solutions.seed.json).
 *
 * Mesuré dans le code du panneau Screenpipe (app/notification-panel/page.tsx) : le corps passe par
 * ReactMarkdown sans remark-breaks, donc un saut de ligne simple devient une espace. Pour deux lignes,
 * il faut une ligne vide (`\n\n`).
 */

export type ButtonKind = "lien" | "copier" | "retour";

export interface StudioButton {
	label: string;
	kind: ButtonKind;
	/** L'URL d'un lien, le texte copié ; rien pour un retour. */
	value: string;
	primary: boolean;
}

export interface StudioVariant {
	id: string;
	name: string;
	title: string;
	body: string;
	buttons: StudioButton[];
}

export interface StudioCase {
	key: string;
	label: string;
	/** Ce qui se passe à l'écran quand la notification arrive. */
	moment: string;
	variants: StudioVariant[];
}

export interface StudioLinks {
	jeanContact: string;
	bugsChannel: string;
	/** La page Notion qui documente la règle (à remplacer par la vraie URL une fois les pages importées). */
	notionRule: string;
	/** La page « Mon poste » de Haytham, ouverte par [Rédiger]. */
	myPage: string;
}

const link = (label: string, value: string, primary = false): StudioButton => ({ label, kind: "lien", value, primary });
const copy = (label: string, value: string, primary = false): StudioButton => ({ label, kind: "copier", value, primary });
const feedback = (label: string, primary = false): StudioButton => ({ label, kind: "retour", value: "", primary });
const DAEMON_FEEDBACK = [feedback("Ça m'a aidé", true), feedback("Pas ça")];

export function defaultCases(links: StudioLinks): StudioCase[] {
	return [
		{
			key: "fiche",
			label: "Fiche client (Crisp)",
			moment: "Jean écrit dans Crisp avec une autre adresse ; Léa cherche son adresse dans HubSpot : aucun résultat.",
			variants: [
				{
					id: "fiche-actuelle",
					name: "Actuelle (démon)",
					title: "Client : Jean Dupont · Le Bistro · Premium",
					body: "Fiche HubSpot retrouvée par son nom : il écrit avec une autre adresse que celle du contrat.\nVente : Le Bistro · Offre Premium.",
					buttons: [link("Y aller", links.jeanContact, true), feedback("Ça m'a aidé"), feedback("Pas ça")],
				},
				{
					id: "fiche-c",
					name: "C · un coup d'œil",
					title: "Jean Dupont · Le Bistro",
					body: "Client **Premium**",
					buttons: [link("Ouvrir sa fiche", links.jeanContact, true)],
				},
				{
					id: "fiche-a",
					name: "A · la réponse en titre",
					title: "C'est Jean Dupont, du Bistro",
					body: "Client **Premium** depuis mars.\n\nIl écrit avec une autre adresse que dans HubSpot.",
					buttons: [link("Ouvrir sa fiche", links.jeanContact, true), feedback("Pas lui")],
				},
				{
					id: "fiche-b",
					name: "B · minimale",
					title: "Jean Dupont · Le Bistro · Premium",
					body: "Autre adresse que dans HubSpot.",
					buttons: [link("Ouvrir sa fiche", links.jeanContact, true), feedback("Pas lui")],
				},
			],
		},
		{
			key: "appel",
			label: "Fiche client (appel)",
			moment: "Léa décroche : l'appel s'appelle « Appel Jean Dupont ». La fiche arrive avant la première phrase.",
			variants: [
				{
					id: "appel-actuelle",
					name: "Actuelle (démon)",
					title: "En ligne : Jean Dupont, Le Bistro",
					body: "Client **Premium** · vente « Le Bistro · Offre Premium ».\nFiche HubSpot retrouvée par le titre de l'appel.",
					buttons: [link("Ouvrir sa fiche", links.jeanContact, true)],
				},
				{
					id: "appel-c",
					name: "C · un coup d'œil",
					title: "Au téléphone : Jean Dupont",
					body: "Le Bistro · **Premium**",
					buttons: [link("Ouvrir sa fiche", links.jeanContact, true)],
				},
				{
					id: "appel-a",
					name: "A · qui parle",
					title: "Au téléphone : Jean Dupont",
					body: "**Le Bistro**, client **Premium** depuis mars.",
					buttons: [link("Ouvrir sa fiche", links.jeanContact, true)],
				},
			],
		},
		{
			key: "geste",
			label: "Geste commercial",
			moment: "Jean demande un dédommagement ; Léa ne sait pas ce qu'elle a le droit d'offrir.",
			variants: [
				{
					id: "geste-actuelle",
					name: "Actuelle (démon)",
					title: "Geste commercial : 1 mois offert maximum",
					body: "**Clients premium seulement.** Ajouter la note `geste commercial` sur la fiche HubSpot. Au-delà : validation de la responsable support.\nRéglé 3 fois dans l'équipe. Certifiée par le responsable (Support).",
					buttons: [...DAEMON_FEEDBACK, copy("Copier", "Geste commercial : 1 mois offert (client premium).")],
				},
				{
					id: "geste-c",
					name: "C · un coup d'œil",
					title: "Offrez 1 mois à Jean",
					body: "Il est **Premium** : c'est permis.",
					buttons: [copy("Copier la réponse", "Bonjour Jean, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un mois d'abonnement.", true)],
				},
				{
					id: "geste-a",
					name: "A · l'action en titre",
					title: "Offrez 1 mois à Jean",
					body: "**Premium** : il y a droit. Puis la note « geste commercial ».\n\nRègle de Claire · certifiée",
					buttons: [
						copy("Copier la réponse", "Bonjour Jean, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un mois d'abonnement.", true),
						copy("Copier la note", "Geste commercial : 1 mois offert (client premium), suite à la panne de la page de réservation."),
						feedback("Pas ça"),
					],
				},
				{
					id: "geste-b",
					name: "B · la règle, puis l'action",
					title: "1 mois offert : Jean y a droit",
					body: "Client **Premium**. Ajoutez la note `geste commercial` dans HubSpot.\n\nCertifiée par Claire (Support) · 3 fois cette semaine",
					buttons: [copy("Copier la réponse", "Bonjour Jean, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un mois d'abonnement.", true), feedback("Pas ça")],
				},
			],
		},
		{
			key: "autorise",
			label: "Déjà autorisé (appel)",
			moment: "Au téléphone, Jean demande un dédommagement. Léa hésite à voix haute ; la règle est certifiée par Claire, la responsable : pas besoin de lui redemander.",
			variants: [
				{
					id: "autorise-actuelle",
					name: "Actuelle (démon)",
					title: "Geste commercial : 1 mois offert maximum",
					body: "**Clients premium seulement.** Ajouter la note `geste commercial` sur la fiche HubSpot. Au-delà : validation de la responsable support.\nRéglé 3 fois dans l'équipe. Certifiée par le responsable (Support).",
					buttons: [...DAEMON_FEEDBACK, copy("Copier", "Geste commercial : 1 mois offert (client premium).")],
				},
				{
					id: "autorise-c",
					name: "C · un coup d'œil",
					title: "Oui : 1 mois, validé par Claire",
					body: "",
					buttons: [link("Voir la règle", links.notionRule, true)],
				},
				{
					id: "autorise-a",
					name: "A · l'autorisation en titre",
					title: "Déjà autorisé par Claire : 1 mois",
					body: "Jean est **Premium** : offrez 1 mois, sans redemander.\n\nRègle certifiée par Claire (Support)",
					buttons: [link("Voir la règle", links.notionRule, true), feedback("Pas ça")],
				},
				{
					id: "autorise-b",
					name: "B · la réponse à dire",
					title: "Vous pouvez offrir 1 mois",
					body: "Validé par Claire pour les clients **Premium**. Puis la note `geste commercial` dans HubSpot.",
					buttons: [link("Règle dans Notion", links.notionRule, true), copy("Copier la note", "Geste commercial : 1 mois offert (client premium)."), feedback("Pas ça")],
				},
			],
		},
		{
			key: "bug",
			label: "Signaler un bug",
			moment: "Jean décrit une erreur de paiement ; Léa ne sait pas où la signaler.",
			variants: [
				{
					id: "bug-actuelle",
					name: "Actuelle (démon)",
					title: "Bug client : #bugs avec le modèle, ticket « Support »",
					body: "Poster dans `#bugs` avec le modèle, puis créer le ticket HubSpot dans le pipeline **Support** (pas « Support OLD »), lié au client.\nRéglé 5 fois dans l'équipe.",
					buttons: [...DAEMON_FEEDBACK, copy("Copier", "Bug : [symptôme] | Client : [entreprise] | Offre : [offre] | Depuis : [heure] | Lien Crisp : [lien]")],
				},
				{
					id: "bug-c",
					name: "C · un coup d'œil",
					title: "À signaler dans #bugs",
					body: "Message prêt, avec le client.",
					buttons: [copy("Copier le message", "[Bug] Le Bistro · page de réservation en panne\nClient : Jean Dupont (Premium)\nDepuis : ce matin", true)],
				},
				{
					id: "bug-a",
					name: "A · deux étapes numérotées",
					title: "Signalez-le dans #bugs",
					body: "Le message est prêt, avec Le Bistro et Premium.\n\nTicket HubSpot : pipeline **Support**",
					buttons: [
						copy("1. Copier le message", "[Bug] Le Bistro · page de réservation en panne\nClient : Jean Dupont (Premium)\nDepuis : ce matin", true),
						link("2. Ouvrir #bugs", links.bugsChannel),
						feedback("Pas ça"),
					],
				},
				{
					id: "bug-b",
					name: "B · un seul geste",
					title: "Bug : message prêt pour #bugs",
					body: "Puis le ticket dans **Support**, pas « Support OLD ».",
					buttons: [link("Ouvrir #bugs", links.bugsChannel, true), copy("Copier", "[Bug] Le Bistro · page de réservation en panne\nClient : Jean Dupont (Premium)\nDepuis : ce matin"), feedback("Pas ça")],
				},
			],
		},
		{
			key: "promesse",
			label: "Promesse d'un commercial",
			moment: "Élodie dit que Thomas lui a promis l'installation ; Léa ne trouve rien dans HubSpot.",
			variants: [
				{
					id: "promesse-actuelle",
					name: "Actuelle (démon)",
					title: "Promesse d'un commercial : champ « Conditions particulières »",
					body: "Les promesses sont notées dans **Conditions particulières** de la vente. Si le champ est vide, demander au commercial dans `#ventes`, pas en message privé.\nRéglé 2 fois dans l'équipe.",
					buttons: DAEMON_FEEDBACK,
				},
				{
					id: "promesse-c",
					name: "C · un coup d'œil",
					title: "Rien de noté : demandez à Thomas",
					body: "",
					buttons: [copy("Copier la réponse", "Bonjour Élodie, je vérifie avec Thomas et je reviens vers vous aujourd'hui.", true)],
				},
				{
					id: "promesse-a",
					name: "A · la conclusion en titre",
					title: "Rien de noté : demandez à Thomas",
					body: "« Conditions particulières » est vide sur la vente.\n\nNe confirmez rien avant sa réponse.",
					buttons: [copy("Copier la réponse", "Bonjour Élodie, je vérifie avec Thomas et je reviens vers vous aujourd'hui.", true), feedback("Pas ça")],
				},
			],
		},
		{
			key: "prospect",
			label: "Prospect venu du chat",
			moment: "Un restaurateur belge écrit dans Crisp ; Léa ne sait pas à qui le passer.",
			variants: [
				{
					id: "prospect-actuelle",
					name: "Actuelle (démon)",
					title: "Prospect : stage « Lead », puis #new-leads",
					body: "Créer le contact en `Lead`. Belgique : responsable **Sarah**. Prévenir dans `#new-leads`.\nRéglé 4 fois dans l'équipe.",
					buttons: [...DAEMON_FEEDBACK, copy("Copier", "Nouveau lead : [entreprise], [pays], [besoin], arrivé par le chat.")],
				},
				{
					id: "prospect-c",
					name: "C · un coup d'œil",
					title: "Prospect belge : pour Sarah",
					body: "",
					buttons: [copy("Copier le message", "Nouveau lead : Brasserie des Arts, Belgique, 3 restaurants, arrivé par le chat.", true)],
				},
				{
					id: "prospect-a",
					name: "A · la personne en titre",
					title: "Prospect belge : pour Sarah",
					body: "Créez le contact en **Lead**, puis prévenez #new-leads.",
					buttons: [copy("Copier le message", "Nouveau lead : Brasserie des Arts, Belgique, 3 restaurants, arrivé par le chat.", true), feedback("Pas ça")],
				},
			],
		},
		{
			key: "certif",
			label: "Règle de la nuit (Claire)",
			moment: "La nuit, l'IA a tiré une règle des solutions partagées. Le matin, Claire, la responsable, la valide d'un clic.",
			variants: [
				{
					id: "certif-actuelle",
					name: "Actuelle (démon)",
					title: "Règle trouvée cette nuit : Dédommagement : 1 mois max Premium/Groupe, sinon bon 10 %",
					body: "Offrir 1 mois aux clients Premium ou Groupe ; sinon un bon de 10 %.\nÉtape : Crisp : un client demande un dédommagement. Certifiée, elle devient l'aide de toute l'équipe.",
					buttons: [feedback("Certifier", true), link("Rédiger", links.myPage)],
				},
				{
					id: "certif-c",
					name: "C · un coup d'œil",
					title: "Valider la règle de la nuit ?",
					body: "Dédommagement : 1 mois aux **Premium**.",
					buttons: [feedback("Certifier", true), link("Modifier", links.myPage)],
				},
				{
					id: "certif-a",
					name: "A · la décision en titre",
					title: "Nouvelle règle à valider",
					body: "**Dédommagement** : 1 mois aux Premium, sinon un bon de 10 %.\n\nValidée, elle aide toute l'équipe.",
					buttons: [feedback("Certifier", true), link("Modifier", links.myPage)],
				},
			],
		},
		{
			key: "collegue",
			label: "Demande anonyme (Karim)",
			moment: "Personne n'a de solution chez Léa : Karim, qui connaît la règle, reçoit la demande sans savoir de qui.",
			variants: [
				{
					id: "collegue-actuelle",
					name: "Actuelle (démon)",
					title: "Un collègue bloque : Crisp : un client demande un dédommagement",
					body: "Ta solution « Geste commercial : 1 mois offert maximum » peut l'aider. Personne ne saura qui a demandé.",
					buttons: [feedback("Partager", true), feedback("Pas maintenant")],
				},
				{
					id: "collegue-c",
					name: "C · un coup d'œil",
					title: "Un collègue a besoin de toi",
					body: "Sujet : geste commercial",
					buttons: [feedback("Partager", true), feedback("Plus tard")],
				},
				{
					id: "collegue-a",
					name: "A · ce qu'on attend de lui",
					title: "Un collègue a besoin de ta règle",
					body: "Sujet : geste commercial, client en attente.\n\nPersonne ne saura qui a demandé.",
					buttons: [feedback("Partager", true), feedback("Pas maintenant")],
				},
			],
		},
	];
}
