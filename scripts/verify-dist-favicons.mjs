import fs from "node:fs";
import sharp from "sharp";

const html = fs.readFileSync("dist/index.html", "utf8");
const head = html.match(/<head>[\s\S]*?<\/head>/i)?.[0] ?? "";
const links = [...head.matchAll(/<link[^>]+>/gi)]
	.filter((m) => /rel=["'](?:icon|apple-touch-icon)["']/i.test(m[0]))
	.map((m) => m[0]);

console.log("=== dist/index.html icon links ===");
links.forEach((l) => console.log(l));
console.log("logo-mark in head:", head.includes("logo-mark"));

const files = [
	"dist/favicon-96.png",
	"dist/apple-touch-icon.png",
	"dist/favicon.svg",
	"dist/favicon.ico",
];
for (const f of files) {
	if (!fs.existsSync(f)) {
		console.error("MISSING", f);
		process.exitCode = 1;
		continue;
	}
	const size = fs.statSync(f).size;
	if (f.endsWith(".ico")) {
		const b = fs.readFileSync(f);
		const n = b.readUInt16LE(4);
		const layers = [];
		let o = 6;
		for (let i = 0; i < n; i++) {
			layers.push(`${b[o] || 256}x${b[o + 1] || 256}`);
			o += 16;
		}
		console.log(f, size, "bytes", layers.join(", "));
	} else {
		const meta = await sharp(fs.readFileSync(f)).metadata();
		console.log(f, size, "bytes", `${meta.width}x${meta.height}`);
	}
}
