/**
 * Les notifications d'aide, avant / après réécriture, pour les comparer dans le vrai panneau Screenpipe
 * (`bun run preview:notifs`). « Avant » reprend ce que le démon d'Andrea affiche aujourd'hui
 * (andrea/daemon/solutions.seed.json et helpNotification) ; « après » est la proposition.
 *
 * Quatre règles pour « après » :
 * 1. le titre est la réponse, en 40 caractères au plus ;
 * 2. deux lignes au plus : ce qui est déjà vérifié, puis la seule chose à faire ;
 * 3. la confiance en quelques mots, à la fin (« Règle de Claire · certifiée ») ;
 * 4. le bouton principal est l'action ; un clic dessus vaut « ça m'a aidé », il ne reste que [Pas ça].
 * Ni emoji ni « ! » (règle de design Screenpipe).
 */

export interface PreviewButton {
	label: string;
	/** Copié au clic ; à défaut, `url` est ouvert. */
	copy?: string;
	url?: string;
}

export interface PreviewNotification {
	title: string;
	body: string;
	buttons: PreviewButton[];
}

export interface Proposal {
	key: string;
	/** Ce que la comparaison montre, pour la personne qui regarde. */
	label: string;
	before: PreviewNotification;
	after: PreviewNotification;
}

export interface ProposalLinks {
	jeanContact: string;
	bugsChannel: string;
}

const FEEDBACK: PreviewButton[] = [{ label: "Ça m'a aidé", copy: "(retour envoyé au démon)" }, { label: "Pas ça", copy: "(retour envoyé au démon)" }];
const NOT_THIS: PreviewButton = { label: "Pas ça", copy: "(retour envoyé au démon)" };

export function proposals(links: ProposalLinks): Proposal[] {
	return [
		{
			key: "fiche",
			label: "Fiche client : le cas d'ouverture (Jean écrit avec une autre adresse)",
			before: {
				title: "Client : Jean Dupont · Le Bistro · Premium",
				body: "Fiche HubSpot retrouvée par son nom : il écrit avec une autre adresse que celle du contrat.\nVente : Le Bistro · Offre Premium.",
				buttons: [{ label: "Y aller", url: links.jeanContact }, ...FEEDBACK],
			},
			after: {
				title: "C'est Jean Dupont, du Bistro",
				body: "Client **Premium** depuis mars.\nIl écrit avec une autre adresse que dans HubSpot.",
				buttons: [{ label: "Ouvrir sa fiche", url: links.jeanContact }, { label: "Pas lui", copy: "(retour envoyé au démon)" }],
			},
		},
		{
			key: "geste",
			label: "Geste commercial : Jean demande un dédommagement",
			before: {
				title: "Geste commercial : 1 mois offert maximum",
				body: "**Clients premium seulement.** Ajouter la note `geste commercial` sur la fiche HubSpot. Au-delà : validation de la responsable support.\nRéglé 3 fois dans l'équipe. Certifiée par le responsable (Support).",
				buttons: [...FEEDBACK, { label: "Copier", copy: "Geste commercial : 1 mois offert (client premium)." }],
			},
			after: {
				title: "Offrez 1 mois à Jean",
				body: "**Premium** : il y a droit. Puis la note « geste commercial ».\nRègle de Claire · certifiée",
				buttons: [
					{ label: "Copier la réponse", copy: "Bonjour Jean, nous sommes désolés pour la gêne occasionnée. Nous vous offrons un mois d'abonnement." },
					{ label: "Copier la note", copy: "Geste commercial : 1 mois offert (client premium), suite à la panne de la page de réservation." },
					NOT_THIS,
				],
			},
		},
		{
			key: "bug",
			label: "Bug client : où le signaler",
			before: {
				title: "Bug client : #bugs avec le modèle, ticket « Support »",
				body: "Poster dans `#bugs` avec le modèle, puis créer le ticket HubSpot dans le pipeline **Support** (pas « Support OLD »), lié au client.\nRéglé 5 fois dans l'équipe.",
				buttons: [...FEEDBACK, { label: "Copier", copy: "Bug : [symptôme] | Client : [entreprise] | Offre : [offre] | Depuis : [heure] | Lien Crisp : [lien]" }],
			},
			after: {
				title: "Signalez-le dans #bugs",
				body: "Le message est prêt, avec Le Bistro et Premium.\nTicket HubSpot : pipeline **Support**",
				buttons: [
					{ label: "1. Copier le message", copy: "[Bug] Le Bistro · page de réservation en panne\nClient : Jean Dupont (Premium)\nDepuis : ce matin" },
					{ label: "2. Ouvrir #bugs", url: links.bugsChannel },
					NOT_THIS,
				],
			},
		},
		{
			key: "promesse",
			label: "Promesse d'un commercial : Élodie dit que Thomas a promis l'installation",
			before: {
				title: "Promesse d'un commercial : champ « Conditions particulières »",
				body: "Les promesses sont notées dans **Conditions particulières** de la vente. Si le champ est vide, demander au commercial dans `#ventes`, pas en message privé.\nRéglé 2 fois dans l'équipe.",
				buttons: FEEDBACK,
			},
			after: {
				title: "Rien de noté : demandez à Thomas",
				body: "« Conditions particulières » est vide sur la vente.\nNe confirmez rien avant sa réponse.",
				buttons: [{ label: "Copier la réponse", copy: "Bonjour Élodie, je vérifie avec Thomas et je reviens vers vous aujourd'hui." }, NOT_THIS],
			},
		},
		{
			key: "prospect",
			label: "Prospect belge : à qui le passer",
			before: {
				title: "Prospect : stage « Lead », puis #new-leads",
				body: "Créer le contact en `Lead`. Belgique : responsable **Sarah**. Prévenir dans `#new-leads`.\nRéglé 4 fois dans l'équipe.",
				buttons: [...FEEDBACK, { label: "Copier", copy: "Nouveau lead : [entreprise], [pays], [besoin], arrivé par le chat." }],
			},
			after: {
				title: "Prospect belge : pour Sarah",
				body: "Créez le contact en **Lead**, puis prévenez #new-leads.",
				buttons: [{ label: "Copier le message", copy: "Nouveau lead : Brasserie des Arts, Belgique, 3 restaurants, arrivé par le chat." }, NOT_THIS],
			},
		},
		{
			key: "collegue",
			label: "Demande anonyme : ce que voit Karim",
			before: {
				title: "Un collègue bloque : Crisp : un client demande un dédommagement",
				body: "Ta solution « Geste commercial : 1 mois offert maximum » peut l'aider. Personne ne saura qui a demandé.",
				buttons: [
					{ label: "Partager", copy: "(partage)" },
					{ label: "Pas maintenant", copy: "(plus tard)" },
				],
			},
			after: {
				title: "Un collègue a besoin de ta règle",
				body: "Sujet : geste commercial, client en attente.\nPersonne ne saura qui a demandé.",
				buttons: [
					{ label: "Partager", copy: "(partage)" },
					{ label: "Pas maintenant", copy: "(plus tard)" },
				],
			},
		},
	];
}
