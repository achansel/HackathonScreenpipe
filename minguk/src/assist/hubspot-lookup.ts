/**
 * Retrouve dans HubSpot le client qui écrit sur Crisp, par son nom : son adresse Crisp est souvent
 * différente de celle du contrat (et Screenpipe la masque de toute façon : « [EMAIL] »).
 * Lecture seule. Les données restent sur la machine.
 */
import type { HubSpot } from "../seed/hubspot.ts";

export interface CustomerCard {
	contactId: string;
	name: string;
	company?: { id: string; name: string; plan?: string };
	/** La vente signée la plus récente, sinon la dernière vente. */
	deal?: { id: string; name: string; stage: string; seller?: string; conditions?: string };
	contactUrl: string;
	companyUrl?: string;
	dealUrl?: string;
}

interface SearchResult {
	results: { id: string; properties: Record<string, string | null> }[];
}

interface Associations {
	results: { toObjectId: number | string }[];
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export class HubSpotLookup {
	constructor(
		private readonly api: HubSpot,
		private readonly portal: { portalId: number; uiDomain: string },
	) {}

	private url(objectTypeId: "0-1" | "0-2" | "0-3", id: string): string {
		return `https://${this.portal.uiDomain}/contacts/${this.portal.portalId}/record/${objectTypeId}/${id}`;
	}

	/** Les contacts dont le prénom et le nom correspondent exactement (accents et majuscules ignorés). */
	async byName(fullName: string): Promise<CustomerCard[]> {
		const found = await this.api.request<SearchResult>("POST", "/crm/v3/objects/contacts/search", {
			query: fullName,
			properties: ["firstname", "lastname"],
			limit: 10,
		});
		const wanted = fold(fullName);
		const matches = found.results.filter((contact) => fold(`${contact.properties.firstname ?? ""} ${contact.properties.lastname ?? ""}`) === wanted);
		return Promise.all(matches.map((contact) => this.card(contact.id, `${contact.properties.firstname} ${contact.properties.lastname}`)));
	}

	private async card(contactId: string, name: string): Promise<CustomerCard> {
		const card: CustomerCard = { contactId, name, contactUrl: this.url("0-1", contactId) };
		const [companies, deals] = await Promise.all([
			this.api.request<Associations>("GET", `/crm/v4/objects/contacts/${contactId}/associations/companies`),
			this.api.request<Associations>("GET", `/crm/v4/objects/contacts/${contactId}/associations/deals`),
		]);
		const companyId = companies.results[0]?.toObjectId;
		if (companyId !== undefined) {
			const company = await this.api.request<{ properties: Record<string, string | null> }>(
				"GET",
				`/crm/v3/objects/companies/${companyId}?properties=name,pt_offre`,
			);
			card.company = { id: String(companyId), name: company.properties.name ?? "", plan: company.properties.pt_offre ?? undefined };
			card.companyUrl = this.url("0-2", String(companyId));
		}
		const dealIds = [...new Set(deals.results.map((deal) => String(deal.toObjectId)))];
		const loaded = await Promise.all(
			dealIds.map((id) =>
				this.api.request<{ id: string; properties: Record<string, string | null> }>(
					"GET",
					`/crm/v3/objects/deals/${id}?properties=dealname,dealstage,pt_commercial,conditions_particulieres`,
				),
			),
		);
		const deal = loaded.find((candidate) => candidate.properties.dealstage === "closedwon") ?? loaded[0];
		if (deal) {
			card.deal = {
				id: deal.id,
				name: deal.properties.dealname ?? "",
				stage: deal.properties.dealstage ?? "",
				seller: deal.properties.pt_commercial ?? undefined,
				conditions: deal.properties.conditions_particulieres ?? undefined,
			};
			card.dealUrl = this.url("0-3", deal.id);
		}
		return card;
	}
}
