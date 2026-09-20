/**
 * Astro emits sitemap-index.xml + sitemap-0.xml. Many tools (incl. GSC) expect /sitemap.xml.
 * Copy the urlset chunk to sitemap.xml on each production build.
 */
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const chunk = path.join(dist, "sitemap-0.xml");
const target = path.join(dist, "sitemap.xml");

if (!fs.existsSync(chunk)) {
	console.error("[sync-sitemap-xml] Missing dist/sitemap-0.xml — run astro build first.");
	process.exit(1);
}

fs.copyFileSync(chunk, target);
console.log("[sync-sitemap-xml] Wrote dist/sitemap.xml from sitemap-0.xml");
