import fs from "node:fs";

const html = fs.readFileSync(process.argv[2] || ".tmp-live-index.html", "utf8");

const expectedTitle = "Tiong Hock | Automotive Spare Parts Kuching";
const expectedDesc =
	"Tiong Hock supplies genuine and OEM automotive spare parts for workshops, fleets and drivers in Kuching. 50,000+ active line items from Matang Jaya and Kota Samarahan.";

const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
const ogTitle = html.match(/property="og:title" content="([^"]*)"/)?.[1];
const ogUrl = html.match(/property="og:url" content="([^"]*)"/)?.[1];
const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
const twTitle = html.match(/name="twitter:title" content="([^"]*)"/)?.[1];
const ogImage = html.match(/property="og:image" content="([^"]*)"/)?.[1];
const staticGtagScripts = (
	html.match(/<script[^>]+src="https:\/\/www\.googletagmanager\.com\/gtag\/js[^"]*"/g) || []
).length;
const gtagLoaderBlocks = (html.match(/googletagmanager\.com\/gtag\/js/g) || []).length;

const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
const ldJson = JSON.parse(ld);
const org = ldJson["@graph"].find((n) => n["@type"] === "Organization");

const errors = [];
if (title !== expectedTitle) errors.push(`title: got "${title}"`);
if (desc !== expectedDesc) errors.push(`description mismatch`);
if (ogTitle !== expectedTitle) errors.push(`og:title: got "${ogTitle}"`);
if (twTitle !== expectedTitle) errors.push(`twitter:title: got "${twTitle}"`);
if (canonical !== "https://tionghock.com/") errors.push(`canonical: got "${canonical}"`);
if (ogUrl !== "https://tionghock.com/") errors.push(`og:url: got "${ogUrl}"`);
if (ogImage !== "https://tionghock.com/logo-horizontal.png") errors.push(`og:image: got "${ogImage}"`);
if (!html.includes('name="twitter:card" content="summary_large_image"')) errors.push("missing twitter:card");
if (staticGtagScripts !== 0) errors.push(`expected 0 static gtag script tags, got ${staticGtagScripts}`);
if (gtagLoaderBlocks !== 1) errors.push(`expected 1 gtag loader reference in HTML, got ${gtagLoaderBlocks}`);
if (org?.telephone !== "+6082649433") errors.push("Organization JSON-LD missing telephone");
if (!Array.isArray(org?.subOrganization) || org.subOrganization.length !== 2) {
	errors.push("Organization JSON-LD missing subOrganization refs");
}

if (errors.length) {
	console.error("LIVE SEO ASSERTIONS FAILED:\n" + errors.map((e) => `- ${e}`).join("\n"));
	process.exit(1);
}

console.log("LIVE SEO OK");
console.log(`<title>${title}</title>`);
console.log(`meta description: ${desc}`);
