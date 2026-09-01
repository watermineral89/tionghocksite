import {
	assertPublicSafeResult,
	searchPublicCatalog,
	sanitizeSearchQuery,
	toPublicSearchResult,
} from "../../_lib/catalog-search.js";

const CATALOG_PATH = "/data/public-catalog.json";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;

/** @type {Map<string, { count: number, reset: number }>} */
const rateMap = new Map();

function corsHeaders(origin) {
	const allowed = origin && /^https:\/\/(tionghock\.com|www\.tionghock\.com|[\w-]+\.pages\.dev)$/.test(origin);
	return {
		"Access-Control-Allow-Origin": allowed ? origin : "https://tionghock.com",
		"Access-Control-Allow-Methods": "GET, OPTIONS",
		"Access-Control-Max-Age": "86400",
		"Cache-Control": "private, max-age=0, no-store",
	};
}

function jsonResponse(body, status, origin) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...corsHeaders(origin),
		},
	});
}

function clientIp(request) {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

function checkRateLimit(ip) {
	const now = Date.now();
	const entry = rateMap.get(ip);
	if (!entry || now > entry.reset) {
		rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
		return true;
	}
	if (entry.count >= RATE_MAX) return false;
	entry.count += 1;
	return true;
}

/** @param {any} catalog */
function validateCatalog(catalog) {
	if (!catalog || typeof catalog !== "object" || !Array.isArray(catalog.items)) {
		throw new Error("Invalid catalog shape");
	}
}

export async function onRequestOptions(context) {
	return new Response(null, {
		status: 204,
		headers: corsHeaders(context.request.headers.get("Origin") || ""),
	});
}

export async function onRequestGet(context) {
	const origin = context.request.headers.get("Origin") || "";
	const ip = clientIp(context.request);

	if (!checkRateLimit(ip)) {
		return jsonResponse({ ok: false, error: "Rate limit exceeded. Try again shortly." }, 429, origin);
	}

	const url = new URL(context.request.url);
	const q = url.searchParams.get("q") || "";
	const limit = Number(url.searchParams.get("limit") || 20);

	if (!sanitizeSearchQuery(q)) {
		return jsonResponse(
			{ ok: true, query: q.trim(), count: 0, updatedAt: null, results: [] },
			200,
			origin,
		);
	}

	try {
		const catalogUrl = new URL(CATALOG_PATH, context.request.url);
		const catalogRes = context.env?.ASSETS
			? await context.env.ASSETS.fetch(catalogUrl)
			: await fetch(catalogUrl.toString());

		if (!catalogRes.ok) {
			return jsonResponse({ ok: false, error: "Catalog unavailable" }, 503, origin);
		}

		const catalog = await catalogRes.json();
		validateCatalog(catalog);

		const hits = searchPublicCatalog(catalog, q, limit).map((item) => {
			const row = toPublicSearchResult(item);
			return assertPublicSafeResult(row);
		});

		return jsonResponse(
			{
				ok: true,
				query: q.trim(),
				count: hits.length,
				updatedAt: catalog.updatedAt || null,
				results: hits,
			},
			200,
			origin,
		);
	} catch (err) {
		return jsonResponse({ ok: false, error: "Search failed" }, 500, origin);
	}
}
