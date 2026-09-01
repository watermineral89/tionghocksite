/** Public catalog types — no price, cost, OHB, or internal notes. */

export type Availability = "in_stock" | "limited" | "enquire";

export interface PublicCatalogItem {
	sku: string;
	name: string;
	brand: string;
	altCode?: string;
	article?: string;
	uom: string;
	availability: Availability;
}

export interface PublicCatalog {
	version: number;
	updatedAt: string;
	items: PublicCatalogItem[];
}

export const AVAILABILITY_THRESHOLDS = {
	inStockMin: 3,
	limitedMin: 1,
} as const;

/** Used only by the server-side export job — never stored in public JSON. */
export function availabilityFromOhb(totalOhb: number): Availability {
	if (totalOhb >= AVAILABILITY_THRESHOLDS.inStockMin) return "in_stock";
	if (totalOhb >= AVAILABILITY_THRESHOLDS.limitedMin) return "limited";
	return "enquire";
}

export const BLOCKED_PUBLIC_FIELDS = [
	"price",
	"netcost",
	"cost",
	"ohb",
	"ohb_secondary",
	"ohb_otw",
	"memo",
	"note",
	"further_desc",
	"udf_remarks2",
] as const;

const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 80;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

function normalizeToken(value: string): string {
	return value.trim().toLowerCase().replace(/-/g, "");
}

function tokenizeQuery(raw: string): string[] {
	return raw
		.trim()
		.split(/\s+/)
		.map((t) => t.trim())
		.filter((t) => t.length >= MIN_QUERY_LEN)
		.slice(0, 8);
}

function itemHaystack(item: PublicCatalogItem): string {
	return [
		item.sku,
		item.name,
		item.brand,
		item.altCode ?? "",
		item.article ?? "",
		item.uom,
	]
		.join(" ")
		.toLowerCase();
}

function matchesAllTokens(item: PublicCatalogItem, tokens: string[]): boolean {
	const hay = itemHaystack(item);
	const compactHay = hay.replace(/-/g, "");
	return tokens.every((token) => {
		const lower = token.toLowerCase();
		const compact = normalizeToken(token);
		return hay.includes(lower) || (compact.length >= 3 && compactHay.includes(compact));
	});
}

export function sanitizeSearchQuery(raw: string): string | null {
	const trimmed = raw.trim().slice(0, MAX_QUERY_LEN);
	if (trimmed.length < MIN_QUERY_LEN) return null;
	if (/[<>{}|\\;]/.test(trimmed)) return null;
	return trimmed;
}

export function searchPublicCatalog(
	catalog: PublicCatalog,
	rawQuery: string,
	limit = DEFAULT_LIMIT,
): PublicCatalogItem[] {
	const query = sanitizeSearchQuery(rawQuery);
	if (!query) return [];

	const tokens = tokenizeQuery(query);
	if (tokens.length === 0) return [];

	const cap = Math.min(Math.max(1, limit), MAX_LIMIT);

	return catalog.items.filter((item) => matchesAllTokens(item, tokens)).slice(0, cap);
}

export function toPublicSearchResult(item: PublicCatalogItem) {
	return {
		sku: item.sku,
		name: item.name,
		brand: item.brand,
		uom: item.uom,
		availability: item.availability,
	};
}
