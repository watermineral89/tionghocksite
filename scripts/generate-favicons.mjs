/**
 * Rasterize public/favicon.svg into PNG + ICO assets (TH monogram tile).
 * Run: node scripts/generate-favicons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve("public");
const svgPath = path.join(root, "favicon.svg");
const svg = fs.readFileSync(svgPath);

async function pngAt(size, outName) {
	const out = path.join(root, outName);
	await sharp(svg).resize(size, size).png().toFile(out);
	const meta = await sharp(out).metadata();
	if (meta.width !== size || meta.height !== size) {
		throw new Error(`${outName}: expected ${size}x${size}, got ${meta.width}x${meta.height}`);
	}
	return out;
}

await pngAt(96, "favicon-96.png");
await pngAt(180, "apple-touch-icon.png");

const icoLayers = [16, 32, 48, 96];
const tmpIcoPngs = [];
for (const size of icoLayers) {
	const name = `.favicon-${size}.png`;
	await pngAt(size, name);
	tmpIcoPngs.push(path.join(root, name));
}

// png-to-ico: pass an array of paths (16–96). Avoid a lone 256px entry (library bloat).
const ico = await pngToIco(tmpIcoPngs);
fs.writeFileSync(path.join(root, "favicon.ico"), ico);
for (const p of tmpIcoPngs) fs.unlinkSync(p);

console.log("[generate-favicons] Wrote favicon-96.png, apple-touch-icon.png, favicon.ico");
