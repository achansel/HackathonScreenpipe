/**
 * Lit la boîte de réception Crisp à partir des éléments d'une capture Screenpipe (`GET /frames/:id/elements`).
 *
 * Le contenu de la page Crisp arrive surtout par OCR : des blocs de mots avec leur position (0 à 1).
 * On reconstruit les lignes, puis on repère chaque conversation de la liste grâce à son ancre,
 * l'horodatage relatif (« 2m », « 27m », « now ») aligné à droite de la colonne :
 *
 *   Camille Martin                      2m      ← nom + horodatage
 *   • Bonjour, je suis Camille Marti...  OD•    ← aperçu du dernier message (ligne suivante)
 *
 * Aucune règle sur la taille de la fenêtre : tout est relatif à l'ancre.
 */

export interface FrameElement {
	source: string;
	text: string | null;
	/** Rôle d'accessibilité (« Hyperlink », « Text »…), absent sur l'OCR. */
	role?: string | null;
	bounds?: { left: number; top: number; width: number; height: number } | null;
}

export interface InboxRow {
	name: string;
	/** Tel qu'affiché : « now », « 2m », « 3h », « 1d »… */
	ago: string;
	/** Ancienneté en minutes, quand elle se lit. */
	ageMinutes: number | undefined;
	preview: string;
}

interface Word {
	text: string;
	left: number;
	right: number;
	top: number;
}

interface Line {
	top: number;
	left: number;
	right: number;
	words: Word[];
	text: string;
}

const AGO = /^(now|maintenant|à l'instant|\d{1,2}\s?(s|m|min|h|d|j))$/i;
/** Écart maximum entre le haut d'une ligne de nom et celui de son aperçu. */
const PREVIEW_GAP = 0.045;

function words(elements: FrameElement[]): Word[] {
	return elements
		.filter((element) => element.source === "ocr" && element.text?.trim() && element.bounds)
		.map((element) => ({
			text: element.text!.trim(),
			left: element.bounds!.left,
			right: element.bounds!.left + element.bounds!.width,
			top: element.bounds!.top,
		}));
}

/** Regroupe les mots en lignes : même hauteur, et contigus (un grand vide sépare deux colonnes). */
export function lines(elements: FrameElement[]): Line[] {
	const result: Line[] = [];
	for (const word of words(elements).sort((a, b) => a.left - b.left)) {
		const line = result.find((candidate) => Math.abs(candidate.top - word.top) < 0.008 && word.left - candidate.right < 0.03 && word.left >= candidate.left);
		if (line) {
			line.words.push(word);
			line.right = Math.max(line.right, word.right);
		} else {
			result.push({ top: word.top, left: word.left, right: word.right, words: [word], text: "" });
		}
	}
	for (const line of result) line.text = line.words.map((word) => word.text).join(" ");
	return result.sort((a, b) => a.top - b.top || a.left - b.left);
}

export function ageMinutes(ago: string): number | undefined {
	if (/^(now|maintenant|à l'instant)$/i.test(ago)) return 0;
	const match = ago.match(/^(\d{1,2})\s?(s|m|min|h|d|j)$/i);
	if (!match) return undefined;
	const value = Number(match[1]);
	const unit = match[2]!.toLowerCase();
	if (unit === "s") return 0;
	if (unit === "h") return value * 60;
	if (unit === "d" || unit === "j") return value * 24 * 60;
	return value;
}

/** Nettoie l'aperçu : puce au début, pictogrammes lus par l'OCR après les points de suspension. */
function cleanPreview(text: string): string {
	let preview = text.replace(/^[•·)\s]+/, "");
	const ellipsis = preview.search(/\.{2,}|…/);
	if (ellipsis >= 0) preview = preview.slice(0, ellipsis).trimEnd() + "…";
	return preview.trim();
}

export function inboxRows(elements: FrameElement[]): InboxRow[] {
	const all = lines(elements);
	const rows: InboxRow[] = [];
	for (const anchor of all.flatMap((line) => line.words.filter((word) => AGO.test(word.text)))) {
		// Le nom : sur la même hauteur, juste à gauche de l'horodatage, dans la largeur d'une colonne.
		const name = all.find((line) => Math.abs(line.top - anchor.top) < 0.008 && line.right <= anchor.left && anchor.left - line.left < 0.25 && !AGO.test(line.text));
		if (!name) continue;
		const columnLeft = name.left - 0.03;
		const preview = all.find(
			(line) =>
				line.top > anchor.top + 0.008 &&
				line.top - anchor.top < PREVIEW_GAP &&
				line.left >= columnLeft &&
				line.left < anchor.left &&
				line.text.replace(/[^\p{L}]/gu, "").length > 3,
		);
		rows.push({
			name: name.text,
			ago: anchor.text,
			ageMinutes: ageMinutes(anchor.text),
			preview: preview ? cleanPreview(preview.words.filter((word) => word.left < anchor.left - 0.01).map((word) => word.text).join(" ")) : "",
		});
	}
	return rows;
}

/** Repères de la colonne de droite (fiche du client) : la conversation s'arrête à sa gauche. */
const PROFILE_PANE = /View .*Profile|Voir le profil|Conversation Routing|Main information|Visitor device/i;
const NOT_A_MESSAGE = /^(Today|Aujourd'hui|Yesterday|Hier|Start LiveTranslate)$/i;
/** La barre sous la conversation : « Reply Edit Note Reminder Shortcuts », « Knowledge Base ». */
const TOOLBAR = /\b(Reply|Répondre|Shortcuts|Knowledge)\b/;

/**
 * Le texte de la conversation ouverte : la colonne entre la liste et la fiche du client,
 * sous « Today » et au-dessus de la barre « Reply ». Utile quand l'OCR rate l'aperçu de la liste.
 */
export function conversationText(elements: FrameElement[]): string {
	const all = lines(elements);
	const anchors = all.flatMap((line) => line.words.filter((word) => AGO.test(word.text)));
	if (anchors.length === 0) return "";
	const listRight = Math.max(...anchors.map((anchor) => anchor.right));
	const profileLeft = Math.min(0.78, ...all.filter((line) => PROFILE_PANE.test(line.text)).map((line) => line.left));
	const today = all.find((line) => NOT_A_MESSAGE.test(line.text) && line.left > listRight);
	// La barre peut tenir sur deux lignes (« Knowledge » au-dessus de « Reply… ») : on prend la plus haute.
	const toolbar = all.filter((line) => TOOLBAR.test(line.text) && line.left > listRight).sort((a, b) => a.top - b.top)[0];
	const text = all
		.filter(
			(line) =>
				line.left > listRight + 0.02 &&
				line.left < profileLeft - 0.01 &&
				line.top > (today?.top ?? 0.2) &&
				line.top < (toolbar?.top ?? 1) &&
				!NOT_A_MESSAGE.test(line.text),
		)
		// L'avatar du client (« JD ») est lu comme un mot au début de la ligne.
		.map((line) => line.text.replace(/^[A-Z]{2}\s+/, ""))
		.filter((line) => /\p{L}{2}/u.test(line))
		.join(" ");
	// Mot coupé en fin de ligne : « peu- vent » → « peuvent ».
	return text.replace(/(\p{L})-\s+(\p{Ll})/gu, "$1$2").trim();
}

/**
 * Le message complet dont la liste ne montre que le début : on retrouve, dans la conversation ouverte,
 * la ligne qui commence comme l'aperçu, puis les lignes qui la suivent dans la même bulle.
 */
export function fullMessage(elements: FrameElement[], preview: string): string | undefined {
	// Comparaison en minuscules seulement : elle garde les positions du texte d'origine.
	const start = preview.replace(/(…|\.{2,})$/, "").slice(0, 12).toLowerCase();
	if (start.length < 4) return undefined;
	const text = conversationText(elements);
	// Le même début peut revenir (message renvoyé) : le plus récent est le dernier.
	const index = text.toLowerCase().lastIndexOf(start);
	if (index < 0) return undefined;
	// Faute de repère plus sûr entre deux bulles, le message court jusqu'à la fin de la conversation visible.
	return text.slice(index).trim();
}

/** « Jean > Andrea » : la conversation de Jean, assignée à Andrea. On garde le client. */
export function customerName(rowName: string): string {
	return rowName.split(/\s*[>›»]\s*/)[0]!.trim();
}

/** La conversation ouverte : le titre de l'onglet est « Nom du client | Crisp », précédé d'un compteur s'il y a du non-lu. */
export function openConversation(windowName: string | null | undefined): string | undefined {
	const match = (windowName ?? "").replace(/^💬\d+\s*-\s*/u, "").match(/^(.+?)\s*\|\s*Crisp\b/);
	const name = match?.[1]?.trim();
	return name && !/^(Inbox|Visitors|Contacts|Settings|Plugins)$/i.test(name) ? name : undefined;
}

/** Le nombre de messages non lus, lu dans le titre de l'onglet (« 💬1 - Inbox | Crisp »). */
export function unreadCount(title: string | null | undefined): number {
	const match = (title ?? "").match(/💬\s*(\d+)/u);
	return match ? Number(match[1]) : 0;
}

/**
 * La liste des conversations lue sur une capture par accessibilité (Windows, mesuré le 17/10 : Screenpipe
 * ne prend parfois que l'accessibilité pour Chrome). Chaque ligne est un lien dont le texte est
 * « JD Jean Dupont maintenant Re-bonjour, toujours… » : initiales, nom, ancienneté, message complet.
 */
export function accessibilityRows(elements: FrameElement[]): InboxRow[] {
	const rows: InboxRow[] = [];
	for (const element of elements) {
		if (element.source !== "accessibility" || element.role !== "Hyperlink") continue;
		const words = (element.text ?? "").trim().split(/\s+/);
		if (words.length < 3 || !/^\p{Lu}{1,3}$/u.test(words[0]!)) continue;
		const at = words.findIndex((word, index) => index >= 2 && ageMinutes(word) !== undefined);
		if (at < 2) continue;
		rows.push({ name: words.slice(1, at).join(" "), ago: words[at]!, ageMinutes: ageMinutes(words[at]!), preview: words.slice(at + 1).join(" ") });
	}
	return rows;
}
