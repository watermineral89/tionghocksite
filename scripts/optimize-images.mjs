/**
 * Generates WebP/AVIF responsive variants for homepage-critical rasters.
 * Run via `npm run build` (prebuild). Sources in public/ are not modified.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");

const jobs = [
	{
		id: "apm-r134a",
		source: "images/products/apm-r134a.jpg",
		widths: [400, 600, 800],
		webpQuality: 82,
		avifQuality: 55,
	},
	{
		id: "logo-horizontal",
		source: "logo-horizontal.png",
		widths: [280, 420, 840],
		webpQuality: 92,
		avifQuality: 65,
	},
	{
		id: "logo-mark",
		source: "logo-mark.png",
		widths: [96, 192, 288],
		webpQuality: 92,
		avifQuality: 65,
	},
];

async function generateVariant(inputPath, outBase, width, format, quality) {
	const outPath = `${outBase}-${width}w.${format}`;
	const meta = await sharp(inputPath).metadata();
	const targetWidth = Math.min(width, meta.width ?? width);

	await sharp(inputPath)
		.resize({ width: targetWidth, withoutEnlargement: true })
		[format]({ quality, effort: format === "avif" ? 4 : undefined })
		.toFile(outPath);

	return { outPath, bytes: fs.statSync(outPath).size };
}

async function run() {
	const manifest = {};

	for (const job of jobs) {
		const inputPath = path.join(publicDir, job.source);
		if (!fs.existsSync(inputPath)) {
			console.warn(`[optimize-images] skip missing ${job.source}`);
			continue;
		}

		const outDir = path.dirname(path.join(publicDir, job.source));
		const outBase = path.join(outDir, job.id);
		manifest[job.id] = { widths: [], webp: [], avif: [] };

		for (const width of job.widths) {
			const webp = await generateVariant(inputPath, outBase, width, "webp", job.webpQuality);
			const avif = await generateVariant(inputPath, outBase, width, "avif", job.avifQuality);
			manifest[job.id].widths.push(width);
			manifest[job.id].webp.push({ width, path: "/" + path.relative(publicDir, webp.outPath).replace(/\\/g, "/"), bytes: webp.bytes });
			manifest[job.id].avif.push({ width, path: "/" + path.relative(publicDir, avif.outPath).replace(/\\/g, "/"), bytes: avif.bytes });
		}

		const srcBytes = fs.statSync(inputPath).size;
		console.log(`[optimize-images] ${job.id}: source ${(srcBytes / 1024).toFixed(1)} KB`);
		for (const w of job.widths) {
			const wp = manifest[job.id].webp.find((x) => x.width === w);
			const av = manifest[job.id].avif.find((x) => x.width === w);
			console.log(`  ${w}w  webp ${(wp.bytes / 1024).toFixed(1)} KB  avif ${(av.bytes / 1024).toFixed(1)} KB`);
		}
	}

	const manifestPath = path.join(publicDir, "data", "optimized-images.json");
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
	console.log(`[optimize-images] Wrote ${path.relative(root, manifestPath)}`);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
