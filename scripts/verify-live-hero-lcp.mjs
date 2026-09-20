const url = process.argv[2] || "https://tionghock.com/";
const html = await fetch(url).then((r) => r.text());
const preload = html.match(/<link[^>]*preload[^>]*apm-r134a[^>]*>/i)?.[0];
const pictures = [...html.matchAll(/<picture>[\s\S]*?<\/picture>/gi)].map((m) => m[0]);
const hero = pictures.find((p) => p.includes("apm-r134a"));
console.log("URL:", url);
console.log("PRELOAD:", preload);
console.log("HERO decoding:", hero?.match(/decoding="[^"]+"/)?.[0]);
console.log("HERO fetchpriority:", hero?.match(/fetchpriority="[^"]+"/)?.[0]);
