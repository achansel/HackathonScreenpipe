/**
 * Client HubSpot minimal pour remplir le portail de démo. Le jeton n'apparaît jamais dans une erreur.
 */
import { defined } from "../notify/defined.ts";
import type { ObjectType, PropertyDef } from "./mapping.ts";

export class HubSpotError extends Error {
	constructor(
		readonly status: number,
		readonly category: string,
		message: string,
	) {
		super(`HubSpot ${status}${category ? ` ${category}` : ""} : ${message}`);
	}
}

export interface HubSpotOptions {
	baseUrl?: string;
	fetch?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
	/** Écart minimum entre deux requêtes : la limite d'une clé privée est d'environ 100 requêtes par 10 s. */
	minGapMs?: number;
	maxRetries?: number;
}

export interface AccountDetails {
	portalId: number;
	uiDomain: string;
	timeZone: string;
	companyCurrency: string;
}

export class HubSpot {
	private readonly options: Required<HubSpotOptions>;
	private lastRequestAt = 0;

	constructor(
		private readonly token: string,
		options: HubSpotOptions = {},
	) {
		this.options = {
			baseUrl: "https://api.hubapi.com",
			fetch: globalThis.fetch,
			sleep: (ms) => Bun.sleep(ms),
			minGapMs: 110,
			maxRetries: 4,
			...defined(options),
		};
	}

	async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			const wait = this.lastRequestAt + this.options.minGapMs - Date.now();
			if (wait > 0) await this.options.sleep(wait);
			this.lastRequestAt = Date.now();

			const init: RequestInit = { method, headers: { Authorization: `Bearer ${this.token}` } };
			if (body !== undefined) {
				init.headers = { ...init.headers, "Content-Type": "application/json" };
				init.body = JSON.stringify(body);
			}
			const response = await this.options.fetch(`${this.options.baseUrl}${path}`, init);
			if ((response.status === 429 || response.status >= 500) && attempt < this.options.maxRetries) {
				const retryAfter = Number(response.headers.get("retry-after"));
				await this.options.sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
				continue;
			}
			const text = await response.text();
			const data = text ? safeJson(text) : undefined;
			if (!response.ok) {
				const detail = (data ?? {}) as { category?: string; message?: string };
				throw new HubSpotError(response.status, detail.category ?? "", detail.message ?? text.slice(0, 200));
			}
			return data as T;
		}
	}

	accountDetails(): Promise<AccountDetails> {
		return this.request("GET", "/account-info/v3/details");
	}

	async create(type: ObjectType, properties: Record<string, string>): Promise<string> {
		const created = await this.request<{ id: string }>("POST", `/crm/v3/objects/${type}`, { properties });
		return created.id;
	}

	async associate(fromType: ObjectType, fromId: string, toType: ObjectType, toId: string): Promise<void> {
		await this.request("PUT", `/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`);
	}

	/** Lien « principal » d'un contact vers son entreprise (type 1 défini par HubSpot) : c'est elle qu'affiche la fiche. */
	async setPrimaryCompany(contactId: string, companyId: string): Promise<void> {
		await this.request("PUT", `/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`, [
			{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
		]);
	}

	async update(type: ObjectType, id: string, properties: Record<string, string>): Promise<void> {
		await this.request("PATCH", `/crm/v3/objects/${type}/${id}`, { properties });
	}

	/** Supprime un objet ; déjà supprimé à la main, ce n'est pas une erreur. */
	async remove(type: ObjectType, id: string): Promise<"deleted" | "missing"> {
		try {
			await this.request("DELETE", `/crm/v3/objects/${type}/${id}`);
			return "deleted";
		} catch (error) {
			if (error instanceof HubSpotError && error.status === 404) return "missing";
			throw error;
		}
	}

	async createProperty(type: ObjectType, property: PropertyDef): Promise<"created" | "exists" | "forbidden"> {
		try {
			await this.request("POST", `/crm/v3/properties/${type}`, property);
			return "created";
		} catch (error) {
			if (error instanceof HubSpotError && error.status === 409) return "exists";
			if (error instanceof HubSpotError && error.status === 403) return "forbidden";
			throw error;
		}
	}
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}
