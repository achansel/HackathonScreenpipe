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
