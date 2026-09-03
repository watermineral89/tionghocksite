/** @typedef {'in_stock'|'limited'|'enquire'} Availability */

/** @typedef {{ sku: string, name: string, brand: string, altCode?: string, article?: string, uom: string, availability: Availability }} PublicCatalogItem */

/** @typedef {{ version: number, updatedAt: string, items: PublicCatalogItem[] }} PublicCatalog */

const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 80;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

const BLOCKED_KEYS = new Set([
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
]);

export function sanitizeSearchQuery(raw) {
	const trimmed = String(raw || "")
		.trim()
		.slice(0, MAX_QUERY_LEN);
	if (trimmed.length < MIN_QUERY_LEN) return null;
	if (/[<>{}|\\;]/.test(trimmed)) return null;
	return trimmed;
}

function tokenizeQuery(raw) {
	return raw
		.trim()
		.split(/\s+/)
		.map((t) => t.trim())
		.filter((t) => t.length >= MIN_QUERY_LEN)
		.slice(0, 8);
}

function itemHaystack(item) {
	return [item.sku, item.name, item.brand, item.altCode || "", item.article || "", item.uom]
		.join(" ")
		.toLowerCase();
}

function matchesAllTokens(item, tokens) {
	const hay = itemHaystack(item);
	const compactHay = hay.replace(/-/g, "");
	return tokens.every((token) => {
		const lower = token.toLowerCase();
		const compact = lower.replace(/-/g, "");
		return hay.includes(lower) || (compact.length >= 3 && compactHay.includes(compact));
	});
}

/** @param {PublicCatalog} catalog @param {string} rawQuery @param {number} [limit] */
export function searchPublicCatalog(catalog, rawQuery, limit = DEFAULT_LIMIT) {
	const query = sanitizeSearchQuery(rawQuery);
	if (!query) return [];

	const tokens = tokenizeQuery(query);
	if (tokens.length === 0) return [];

	const cap = Math.min(Math.max(1, limit), MAX_LIMIT);
	return catalog.items.filter((item) => matchesAllTokens(item, tokens)).slice(0, cap);
}

/** @param {PublicCatalogItem} item */
export function toPublicSearchResult(item) {
	return {
		sku: item.sku,
		name: item.name,
		brand: item.brand,
		altCode: item.altCode ?? "",
		article: item.article ?? "",
		uom: item.uom,
		availability: item.availability,
	};
}

/** Strip any accidental sensitive keys before responding. */
export function assertPublicSafeResult(row) {
	for (const key of Object.keys(row)) {
		if (BLOCKED_KEYS.has(key.toLowerCase())) {
			throw new Error(`Blocked field in public response: ${key}`);
		}
	}
	return row;
}
