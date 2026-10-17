/**
 * Les pages du simulateur : la liste des clients, et une page par client qui charge le chat Crisp
 * sous son identité. Chaque client garde sa propre session (CRISP_TOKEN_ID), donc la même conversation
 * d'une démo à l'autre.
 */
import { CRISP_CUSTOMERS, CRISP_WEBSITE_ID, type CrispCustomer } from "../seed/crisp-story.ts";

const STYLE = `
	:root { color-scheme: light dark; --bg: #f7f7f5; --card: #fff; --text: #1d1d1b; --muted: #6b6b66; --accent: #2f6fde; --line: #e2e2dd; }
	@media (prefers-color-scheme: dark) { :root { --bg: #161615; --card: #20201f; --text: #ececea; --muted: #a0a09a; --accent: #6b9bff; --line: #34342f; } }
	body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--text); font: 15px/1.5 -apple-system, system-ui, sans-serif; }
	main { max-width: 640px; margin: 0 auto; }
	h1 { font-size: 20px; margin: 0 0 4px; }
	p.muted, .muted { color: var(--muted); font-size: 13px; }
	.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin: 12px 0; }
	a { color: var(--accent); text-decoration: none; }
	button { display: block; width: 100%; text-align: left; margin: 8px 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; cursor: pointer; }
	button:hover { border-color: var(--accent); }
	button .when { display: inline-block; min-width: 76px; color: var(--muted); font-size: 13px; }
	textarea { width: 100%; box-sizing: border-box; min-height: 64px; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; }
	#log { font-size: 13px; color: var(--muted); }
`;

function shell(title: string, body: string, head = ""): string {
	return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${STYLE}</style>${head}</head><body><main>${body}</main></body></html>`;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
/** Une valeur JSON sûre à l'intérieur d'une balise <script>. */
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export function indexPage(): string {
	const rows = CRISP_CUSTOMERS.map(
		(customer) => `<div class="card"><a href="/client/${customer.key}"><strong>${escape(customer.nickname)}</strong></a><div class="muted">${escape(customer.label)} · ${escape(customer.email)}</div></div>`,
	).join("");
	return shell(
		"Simulateur clients",
		`<h1>Simulateur clients PipingTable</h1><p class="muted">Chaque client ouvre le chat Crisp sous son identité. Ouvrir un client, puis cliquer un message : il part dans la boîte Crisp de l'agent.</p>${rows}`,
	);
}

export function customerPage(customer: CrispCustomer): string {
	const buttons = customer.messages
		.map((message, index) => `<button data-index="${index}"><span class="when">${escape(message.when)}</span>${escape(message.text)}</button>`)
		.join("");
	const script = `
		window.$crisp = [];
		window.CRISP_WEBSITE_ID = ${json(CRISP_WEBSITE_ID)};
		window.CRISP_TOKEN_ID = ${json(`pipingtable-${customer.key}`)};
		window.CRISP_RUNTIME_CONFIG = { locale: "fr" };
		$crisp.push(["set", "user:nickname", [${json(customer.nickname)}]]);
		$crisp.push(["set", "user:email", [${json(customer.email)}]]);
		const messages = ${json(customer.messages.map((message) => message.text))};
		const log = (line) => { document.getElementById("log").textContent = line; };
		async function send(text) {
			if (!text.trim()) return;
			$crisp.push(["do", "message:send", ["text", text]]);
			const at = Date.now();
			log("Envoyé à " + new Date(at).toLocaleTimeString("fr-FR"));
			await fetch("/sent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: ${json(customer.key)}, text, at }) }).catch(() => {});
		}
		document.addEventListener("click", (event) => {
			const button = event.target.closest("button[data-index]");
			if (button) send(messages[Number(button.dataset.index)]);
		});
		document.getElementById("free").addEventListener("submit", (event) => {
			event.preventDefault();
			const field = document.getElementById("text");
			send(field.value);
			field.value = "";
		});
	`;
	return shell(
		customer.nickname,
		`<p><a href="/">← Tous les clients</a></p>
		<h1>${escape(customer.nickname)}</h1><p class="muted">${escape(customer.label)} · écrit avec ${escape(customer.email)}</p>
		<div class="card">${buttons}</div>
		<form id="free" class="card"><textarea id="text" placeholder="Message libre"></textarea><button type="submit">Envoyer en tant que ${escape(customer.nickname)}</button></form>
		<p id="log"></p>
		<script>${script}</script>
		<script src="https://client.crisp.chat/l.js" async></script>`,
	);
}
