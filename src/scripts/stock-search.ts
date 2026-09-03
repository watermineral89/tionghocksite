import {
	searchPublicCatalog,
	sanitizeSearchQuery,
	toPublicSearchResult,
	type Availability,
	type PublicCatalog,
} from "../lib/public-catalog";

const WA_PHONE = "60168860864";
const API_PATH = "/api/public/search";
const CATALOG_PATH = "/data/public-catalog.json";
const DEBOUNCE_MS = 400;

let catalogCache: PublicCatalog | null = null;

function waHref(sku: string, name: string): string {
	const text = `Hello Tiong Hock — stock enquiry for *${sku}* (${name}).\n\nVehicle / chassis no.: `;
	return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`;
}

function availabilityLabel(value: Availability): string {
	switch (value) {
		case "in_stock":
			return "In stock";
		case "limited":
			return "Limited";
		default:
			return "Enquire";
	}
}

function availabilityClass(value: Availability): string {
	switch (value) {
		case "in_stock":
			return "th-avail th-avail-in";
		case "limited":
			return "th-avail th-avail-limited";
		default:
			return "th-avail th-avail-enquire";
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

async function loadCatalogFallback(): Promise<PublicCatalog> {
	if (catalogCache) return catalogCache;
	const res = await fetch(CATALOG_PATH, { cache: "no-store" });
	if (!res.ok) throw new Error("Catalog unavailable");
	catalogCache = (await res.json()) as PublicCatalog;
	return catalogCache;
}

async function runSearch(query: string) {
	const sanitized = sanitizeSearchQuery(query);
	if (!sanitized) return { results: [], updatedAt: null as string | null };

	try {
		const apiUrl = `${API_PATH}?q=${encodeURIComponent(sanitized)}&limit=20`;
		const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
		if (res.ok) {
			const data = (await res.json()) as {
				ok: boolean;
				results: ReturnType<typeof toPublicSearchResult>[];
				updatedAt: string | null;
			};
			if (data.ok) {
				return { results: data.results, updatedAt: data.updatedAt };
			}
		}
	} catch {
		/* fall through to static catalog */
	}

	const catalog = await loadCatalogFallback();
	const hits = searchPublicCatalog(catalog, sanitized, 20).map(toPublicSearchResult);
	return { results: hits, updatedAt: catalog.updatedAt };
}

function refLine(item: { altCode: string; article: string }): string {
	const parts: string[] = [];
	if (item.altCode) parts.push(`Alt: ${item.altCode}`);
	if (item.article) parts.push(`Ref: ${item.article}`);
	return parts.join(" · ");
}

function renderResults(
	container: HTMLElement,
	meta: HTMLElement,
	query: string,
	results: ReturnType<typeof toPublicSearchResult>[],
	updatedAt: string | null,
) {
	container.innerHTML = "";

	if (!sanitizeSearchQuery(query)) {
		meta.textContent = "Type at least 2 characters — try a SKU, brand, or OEM reference.";
		return;
	}

	if (results.length === 0) {
		meta.textContent = `No matches for “${query}”. Try another part number or WhatsApp us with your chassis no.`;
		return;
	}

	meta.textContent = updatedAt
		? `${results.length} result${results.length === 1 ? "" : "s"} · updated ${new Date(updatedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}`
		: `${results.length} result${results.length === 1 ? "" : "s"}`;

	for (const item of results) {
		const refs = refLine(item);
		const row = document.createElement("article");
		row.className = "parts-result";

		row.innerHTML = `
			<div class="parts-result__body">
				<div class="parts-result__top">
					<p class="parts-result__sku">${escapeHtml(item.sku)}</p>
					<span class="${availabilityClass(item.availability)}">${availabilityLabel(item.availability)}</span>
				</div>
				<h3 class="parts-result__name">${escapeHtml(item.name)}</h3>
				<p class="parts-result__meta">
					<span>${escapeHtml(item.brand)}</span>
					<span aria-hidden="true">·</span>
					<span>${escapeHtml(item.uom)}</span>
					${refs ? `<span aria-hidden="true">·</span><span>${escapeHtml(refs)}</span>` : ""}
				</p>
			</div>
			<a
				class="parts-result__wa th-cta-wa"
				href="${waHref(item.sku, item.name)}"
				target="_blank"
				rel="noopener noreferrer"
			>WhatsApp for price &amp; fitment</a>
		`;

		container.appendChild(row);
	}
}

export function initStockSearch(root: HTMLElement) {
	const form = root.querySelector<HTMLFormElement>("[data-stock-search-form]");
	const input = root.querySelector<HTMLInputElement>("[data-stock-search-input]");
	const results = root.querySelector<HTMLElement>("[data-stock-search-results]");
	const meta = root.querySelector<HTMLElement>("[data-stock-search-meta]");
	const status = root.querySelector<HTMLElement>("[data-stock-search-status]");

	if (!form || !input || !results || !meta || !status) return;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let activeQuery = "";

	const setBusy = (busy: boolean) => {
		status.hidden = !busy;
		input.toggleAttribute("aria-busy", busy);
	};

	const execute = async (query: string) => {
		activeQuery = query;
		setBusy(true);

		const url = new URL(window.location.href);
		if (sanitizeSearchQuery(query)) {
			url.searchParams.set("q", query.trim());
		} else {
			url.searchParams.delete("q");
		}
		window.history.replaceState({}, "", url);

		try {
			const { results: hits, updatedAt } = await runSearch(query);
			if (activeQuery !== query) return;
			renderResults(results, meta, query, hits, updatedAt);
		} catch {
			meta.textContent = "Search is temporarily unavailable. Please WhatsApp us with your part number.";
			results.innerHTML = "";
		} finally {
			if (activeQuery === query) setBusy(false);
		}
	};

	form.addEventListener("submit", (e) => {
		e.preventDefault();
		if (timer) clearTimeout(timer);
		void execute(input.value);
	});

	input.addEventListener("input", () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void execute(input.value), DEBOUNCE_MS);
	});

	const params = new URLSearchParams(window.location.search);
	const initial = params.get("q");
	if (initial) {
		input.value = initial;
		void execute(initial);
	}
}
