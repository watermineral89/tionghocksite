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

function renderResults(
	container: HTMLElement,
	meta: HTMLElement,
	query: string,
	results: ReturnType<typeof toPublicSearchResult>[],
	updatedAt: string | null,
) {
	container.innerHTML = "";

	if (!sanitizeSearchQuery(query)) {
		meta.textContent = "Type at least 2 characters to search our catalog.";
		return;
	}

	if (results.length === 0) {
		meta.textContent = `No matches for “${query}”. Try a part number, brand, or keyword — or WhatsApp us with your chassis no.`;
		return;
	}

	meta.textContent = updatedAt
		? `${results.length} result${results.length === 1 ? "" : "s"} · catalog updated ${new Date(updatedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}`
		: `${results.length} result${results.length === 1 ? "" : "s"}`;

	for (const item of results) {
		const row = document.createElement("article");
		row.className =
			"flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5";

		row.innerHTML = `
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<p class="font-mono text-xs font-bold uppercase tracking-wide text-brand-green">${escapeHtml(item.sku)}</p>
					<span class="${availabilityClass(item.availability)}">${availabilityLabel(item.availability)}</span>
				</div>
				<h3 class="mt-2 text-base font-semibold text-slate-900">${escapeHtml(item.name)}</h3>
				<p class="mt-1 text-sm text-slate-500">${escapeHtml(item.brand)} · ${escapeHtml(item.uom)}</p>
			</div>
			<a
				class="th-cta-wa shrink-0 sm:min-w-[11rem]"
				href="${waHref(item.sku, item.name)}"
				target="_blank"
				rel="noopener noreferrer"
			>WhatsApp Enquiry</a>
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
