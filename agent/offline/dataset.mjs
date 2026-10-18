// Jeu de test SYNTHÉTIQUE (écrit à la main, étiquettes de l'auteur) pour comparer des méthodes de
// détection d'événement d'assistance. Chaque cas : [étiquette, appli, titres de fenêtres vus (ordre
// chronologique), texte à l'écran]. Le texte imite l'OCR (fautes, coupures) et l'interface.
// Limite : texte propre et étiquettes non indépendantes. À remplacer par de vrais épisodes étiquetés.
// Étiquettes : blocage | demande_aide | recherche | tatonnement | ressaisie | contournement |
//              attente_relance | parcours | aucun   ("aucun" = pas de friction)
// Friction = détour rattaché à une étape de PROCESS (pas une panne technique : 404, port, timeout).
export const LABELS = ["blocage", "demande_aide", "recherche", "tatonnement", "ressaisie", "contournement", "attente_relance", "parcours", "aucun"];

export const CASES = [
  // --- blocage
  ["blocage", "HubSpot", ["Deals - HubSpot", "Le Bistro - Deal"], "Impossible de clôturer la vente. Le champ SIREN est obligatoire. Veuillez renseigner une valeur valide."],
  ["blocage", "Chrome", ["Facturation - Admin", "Facturation - Admin"], "Erreur 403 — Accès refusé. Vous n'avez pas les droits pour effectuer cette action. Contactez votre administrateur."],
  ["blocage", "Chrome", ["Nouveau ticket - Support"], "Le formulaire n a pas pu etre envoy6. Le pipeline sélectionné « Support OLD » n'est plus actif. Choisissez un autre pipeline."],
  ["blocage", "Chrome", ["Devis - HubSpot"], "Impossible d'envoyer le devis: une remise supérieure à 15 % doit d'abord être approuvée dans le canal #deal-desk. Statut: Approbation requise."],
  // --- demande_aide
  ["demande_aide", "Slack", ["#general - Slack"], "Léa: Quelqu'un connaît un Jean qui a un restaurant ? je le trouve pas dans HubSpot, svp"],
  ["demande_aide", "Slack", ["Sarah (DM) - Slack"], "Salut Sarah, tu sais comment je fais pour offrir un mois à un client premium ? je suis bloquée"],
  ["demande_aide", "Slack", ["#support - Slack"], "Hello team, how do I link a HubSpot ticket to a Crisp conversation? can't find the option anywhere"],
  ["demande_aide", "Slack", ["#support - Slack"], "Petite question: pour un ticket client, je choisis le pipeline Support ou Support OLD ? qq1 sait lequel est le bon ?"],
  // --- recherche
  ["recherche", "HubSpot", ["Contacts - HubSpot", "Contacts - HubSpot", "Contacts - HubSpot"], "Recherche: Jean — 14 résultats. Recherche: Bistro — 3 entreprises. Recherche: jean.d — 0 résultat"],
  ["recherche", "Chrome", ["comment activer integration crisp hubspot - Google", "Intégrations - Aide Crisp", "Intégrations - Aide Crisp"], "comment activer l'intégration Crisp HubSpot — Aide Crisp — Connecter HubSpot à Crisp — Paramètres > Plugins"],
  ["recherche", "Notion", ["Wiki - Process remboursement", "Wiki - Process remboursement"], "Wiki / Support / Process remboursement — dernière modif il y a 8 mois — Remboursement: voir le responsable (page vide ci-dessous)"],
  ["recherche", "Notion", ["Wiki - Remises", "Wiki - Process vente", "Wiki - Remises"], "Wiki / Vente / Remises — règle de remise supérieure à 15 % — page introuvable — résultat de recherche: Process vente (dernière modif 11 mois)"],
  // --- tatonnement
  ["parcours", "HubSpot", ["Contact - HubSpot", "Entreprise - HubSpot", "Transactions - HubSpot", "Contrat - HubSpot", "Contact - HubSpot", "Entreprise - HubSpot"], "Contact > Entreprise > Transactions > Contrat > Produits — retour Contact — Entreprise — Transactions"],
  ["parcours", "Chrome", ["Paramètres - Crisp", "Plugins - Crisp", "Paramètres - Crisp", "Plugins - Crisp", "Paramètres - Crisp"], "Paramètres du site > Plugins > Paramètres du site > Plugins — aucune option trouvée"],
  ["tatonnement", "Excel", ["Export.xlsx", "Export.xlsx", "Import - Outil", "Export.xlsx", "Import - Outil"], "Réessayer l'import — Import échoué — Fichier modifié — Réessayer l'import — Import échoué"],
  ["tatonnement", "Chrome", ["Formulaire - Devis", "Formulaire - Devis", "Formulaire - Devis"], "Envoyer — Champ requis manquant — Envoyer — Champ requis manquant — Envoyer — Champ requis manquant"],
  ["tatonnement", "Chrome", ["Notes de frais - Compta", "Notes de frais - Compta", "Notes de frais - Compta"], "Soumettre — Justificatif manquant — Soumettre — Catégorie incorrecte — Soumettre — Rejetée par la compta (3e envoi)"],
  ["tatonnement", "HubSpot", ["Deal - HubSpot", "Deal - HubSpot", "Deal - HubSpot", "Deal - HubSpot"], "Passer à l'étape Négociation — Refusé — Modifier la valeur — Passer à l'étape Négociation — Refusé — Modifier le montant — Passer à l'étape Négociation"],
  // --- parcours (chemin de liens anormalement long ou répété)
  ["parcours", "Chrome", ["Wiki - Process remboursement", "Conversation - Crisp", "Wiki - Process remboursement", "Conversation - Crisp", "Wiki - Process remboursement"], "Wiki / Process remboursement (lue 3 fois) — Conversation Crisp: le client attend — retour au wiki — la règle du montant n'y figure pas"],
  ["parcours", "Notion", ["Wiki", "Support", "Procédures", "Archives", "Support", "Procédures", "Archives"], "Wiki > Support > Procédures > Archives > Support > Procédures > Archives — 7 pages ouvertes en 90 secondes sans résultat"],
  // --- ressaisie
  ["ressaisie", "Crisp", ["Conversation - Crisp", "Fiche client - HubSpot", "Conversation - Crisp", "Fiche client - HubSpot"], "copie: « Ma page de réservation est en panne » ; collé dans Note HubSpot: « Ma page de réservation est en panne » (3e fois aujourd'hui)"],
  ["ressaisie", "Excel", ["Commandes.xlsx", "Compta - Outil", "Commandes.xlsx", "Compta - Outil"], "N° commande 48213 — montant 1 240,00 — saisie manuelle dans Compta: 48213 / 1240.00 — suivant: 48214"],
  ["ressaisie", "Chrome", ["Candidat - ATS", "Fiche RH - SIRH", "Candidat - ATS", "Fiche RH - SIRH"], "Nom, prénom, adresse, IBAN recopiés de l'ATS vers le SIRH champ par champ"],
  ["ressaisie", "Slack", ["#ventes - Slack", "Deal - HubSpot", "#ventes - Slack", "Deal - HubSpot"], "Le Bistro a signé ! 1200€ / an ; nouvelle ligne HubSpot: Le Bistro, 1200, annuel (recopié depuis Slack)"],
  // --- contournement
  ["contournement", "Excel", ["Export.csv - Excel", "Tableau perso.xlsx"], "Export CSV depuis l'outil de reporting, puis tableau croisé dynamique fait à la main dans « Tableau perso (copie) .xlsx »"],
  ["contournement", "Slack", ["Capture - Slack", "Thomas (DM) - Slack"], "Voilà une capture d'écran du champ SIREN, tu peux le remplir pour moi dans HubSpot ? je n'y arrive pas"],
  ["contournement", "Explorer", ["Bureau", "Docs perso"], "Fichier « modèle devis NE PAS TOUCHER (copie 3).docx » — dossier perso « à côté » — dupliqué car le modèle de l'outil est verrouillé"],
  ["contournement", "Chrome", ["Mail - Gmail", "Ma liste perso - Notion"], "Je m'envoie le lien à moi-même par mail pour retrouver la page, l'outil n'a pas de favoris"],
  // --- attente_relance
  ["attente_relance", "Slack", ["Manon (DM) - Slack"], "Des nouvelles ? Toujours pas de retour sur la remise de 20 % ? Je relance, le client attend depuis 2 jours"],
  ["attente_relance", "Mail", ["Validation facture - Gmail"], "Re: Re: Validation facture n°4821 — Bonjour, juste un petit rappel, avez-vous pu regarder ? Merci d'avance"],
  ["attente_relance", "HubSpot", ["Approbations - HubSpot"], "Demande de remise en attente d'approbation depuis 48 h — Approbateur: Direction — Statut: En attente — Envoyer un rappel"],
  ["attente_relance", "Slack", ["#deal-desk - Slack"], "@Julie tu as pu valider ma remise ? le client attend ma reponse depuis hier, merci"],
  // --- aucun (négatifs, dont des cas difficiles)
  ["aucun", "Crisp", ["Conversation - Crisp"], "Bonjour, merci pour votre message, je regarde et reviens vers vous dans quelques minutes."],
  ["aucun", "Slack", ["#random - Slack"], "Quelqu'un veut un café ? ☕ Je descends à 15h. On prend aussi des croissants pour demain ?"],
  ["aucun", "Chrome", ["Dashboard - HubSpot"], "Tableau de bord — 12 deals gagnés ce mois — Chiffre d'affaires: 48 200 € — Objectif atteint à 96 %"],
  ["aucun", "VS Code", ["server.ts - VS Code"], "function handleError(err: Error) { console.error(err); return res.status(500).json({ error: err.message }) }"],
  ["aucun", "Chrome", ["Facturation - Admin"], "Facture n°4821 envoyée avec succès. Un e-mail de confirmation a été envoyé au client."],
  ["aucun", "Teams", ["Réunion hebdo"], "Réunion hebdomadaire — 9 participants — Ordre du jour: points de la semaine, planning, questions diverses"],
  ["aucun", "Notion", ["Notes de réunion - Notion"], "Compte rendu: décisions prises — 1. Lancer la campagne de mars. 2. Embaucher un second support. Prochaine réunion lundi."],
  ["aucun", "Slack", ["Manon (DM) - Slack"], "Merci Manon ! C'est parfait, j'ai bien reçu le fichier. Bon week-end à toi aussi 🙂"],
  ["aucun", "Chrome", ["Documentation - Crisp"], "Guide de démarrage — Installer le chat sur votre site — Étape 1: copiez le script — Étape 2: collez-le avant </body>"],
  ["aucun", "Excel", ["Budget 2027.xlsx"], "Budget 2027 — Total recettes 1 204 500 — Total dépenses 1 118 300 — Marge 7,1 % — onglet Q1 Q2 Q3 Q4"],
  ["aucun", "Chrome", ["Mail - Gmail"], "Boîte de réception (12) — Newsletter hebdo — Facture Free Mobile — Votre colis est en cours de livraison"],
  ["aucun", "Crisp", ["Conversation - Crisp"], "Client: Merci beaucoup, ça fonctionne très bien maintenant ! — Agent: Avec plaisir, bonne journée !"],
  ["aucun", "Slack", ["#general - Slack"], "Bienvenue à Hugo qui rejoint l'équipe support lundi ! Pot d'accueil jeudi à 17h dans la cuisine."],
  ["aucun", "Chrome", ["Paramètres - Compte"], "Mettre à jour le mot de passe — Ancien mot de passe — Nouveau mot de passe — Enregistrer — Modifications enregistrées"],
  ["aucun", "Terminal", ["bash"], "$ git status — On branch main — nothing to commit, working tree clean — $ bun test — 24 pass 0 fail"],
  ["aucun", "Slack", ["#support - Slack"], "FYI la procédure de remboursement est dans le wiki, page Support > Remboursements. Rien à faire de votre côté."],
  ["aucun", "Chrome", ["Calendrier - Google"], "Mardi 14h Point client — Mercredi 10h Revue de pipeline — Jeudi 17h Pot d'accueil — Vendredi: férié"],
  ["aucun", "Chrome", ["Facturation - Admin"], "Erreur résolue ✔ — Le paiement a été relancé automatiquement et a abouti. Aucune action requise."],
  ["aucun", "Slack", ["#random - Slack"], "ça marche pas… la machine à café 😂 le café est trop fort ce matin"],
  ["aucun", "Chrome", ["Aide - Crisp"], "Centre d'aide — Comment configurer les raccourcis clavier — Raccourcis: Ctrl+K pour rechercher une conversation"],
];
