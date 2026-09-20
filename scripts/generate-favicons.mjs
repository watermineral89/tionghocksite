/**
 * Resize public/favicon-source.png (TH tile artwork) into PNG + ICO assets.
 * Does not rasterize favicon.svg — source PNG is the visual reference.
 * Run: node scripts/generate-favicons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve("public");
const sourcePath = path.join(root, "favicon-source.png");

if (!fs.existsSync(sourcePath)) {
	console.error("Missing public/favicon-source.png");
	process.exit(1);
}

async function squareTileBuffer() {
	const trimmedBuf = await sharp(sourcePath).trim({ threshold: 15 }).png().toBuffer();
	const meta = await sharp(trimmedBuf).metadata();
	const side = Math.min(meta.width, meta.height);
	const left = Math.round((meta.width - side) / 2);
	const top = Math.round((meta.height - side) / 2);
	return sharp(trimmedBuf)
		.extract({ left, top, width: side, height: side })
		.png()
		.toBuffer();
}

const tile = await squareTileBuffer();

async function writePng(size, outName) {
	const out = path.join(root, outName);
	await sharp(tile).resize(size, size).png().toFile(out);
	const meta = await sharp(out).metadata();
	if (meta.width !== size || meta.height !== size) {
		throw new Error(`${outName}: expected ${size}x${size}`);
	}
}

await writePng(96, "favicon-96.png");
await writePng(180, "apple-touch-icon.png");

const icoLayers = [16, 32, 48, 96];
const tmpIcoPngs = [];
for (const size of icoLayers) {
	const name = `.favicon-${size}.png`;
	await writePng(size, name);
	tmpIcoPngs.push(path.join(root, name));
}

const ico = await pngToIco(tmpIcoPngs);
fs.writeFileSync(path.join(root, "favicon.ico"), ico);
for (const p of tmpIcoPngs) fs.unlinkSync(p);

console.log("[generate-favicons] Wrote from favicon-source.png (trim + square crop + resize)");
