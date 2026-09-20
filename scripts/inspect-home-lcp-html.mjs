import fs from "node:fs";

const html = fs.readFileSync("dist/index.html", "utf8");
const preload = html.match(/<link[^>]*rel="preload"[^>]*as="image"[^>]*>/i)?.[0];
const pictures = [...html.matchAll(/<picture>[\s\S]*?<\/picture>/gi)].map((m) => m[0]);
const picture = pictures.find((p) => p.includes("apm-r134a"));
console.log("PRELOAD:\n", preload);
console.log("\nPICTURE (truncated):\n", picture?.slice(0, 700));

if (preload && picture) {
	const preSet = preload.match(/imagesrcset="([^"]+)"/i)?.[1];
	const picSet = picture.match(/type="image\/avif" srcset="([^"]+)"/i)?.[1];
	const preSizes = preload.match(/imagesizes="([^"]+)"/i)?.[1];
	const picSizes = picture.match(/sizes="([^"]+)"/i)?.[1];
	console.log("\nSRCSET match:", preSet === picSet, preSet === picSet ? "OK" : { preSet, picSet });
	console.log("SIZES match:", preSizes === picSizes, preSizes);
	console.log("decoding async:", /decoding="async"/.test(picture));
	console.log("decoding auto:", /decoding="auto"/.test(picture));
}
