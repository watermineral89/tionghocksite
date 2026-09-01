import fs from "node:fs";
import path from "node:path";

export interface GalleryPhoto {
	src: string;
	alt: string;
	title: string;
	caption?: string;
}

const GALLERY_DIR = path.join(process.cwd(), "public", "GALLERY");
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

/** Optional titles/captions for known files — everything else in /public/GALLERY is picked up automatically. */
const photoMeta: Record<string, Omit<GalleryPhoto, "src">> = {
	"DIRECTOR GARY.jpg": {
		alt: "Gary Chan Kee Chong, Director of Operations & Logistics",
		title: "Operations & logistics",
		caption: "Gary Chan Kee Chong — aerospace-grade precision across warehouse and distribution.",
	},
	"DIRECTOR RAHIM.jpg": {
		alt: "Rahim Chan, Managing Director",
		title: "Managing director",
		caption: "Rahim Chan — engineering-led growth and long-term industry strategy.",
	},
	"DIRECTOR VINCE.jpg": {
		alt: "Vince Chan Chee Hou, Technical Director",
		title: "StockPilot & systems",
		caption: "Vince Chan Chee Hou — lead architect of our in-house StockPilot platform.",
	},
	"DIRECTOR IVAN.jpg": {
		alt: "Ivan Yong, Director of Sales & Mechanical Engineering",
		title: "Sales & engineering",
		caption: "Ivan Yong — technical workshop support and failure analysis.",
	},
	"STOCK PILOT 2.jpg": {
		alt: "StockPilot Stock Maintenance on a warehouse monitor",
		title: "StockPilot in the warehouse",
		caption: "Our in-house inventory system running live across Matang Jaya operations.",
	},
	"ACONGAS.jpg": {
		alt: "Acongas product line",
		title: "Product spotlight",
		caption: "Authorized lines and fast-moving inventory from our Matang Jaya hub.",
	},
};

function gallerySrc(filename: string) {
	return `/GALLERY/${encodeURIComponent(filename).replace(/%2F/g, "/")}`;
}

function titleFromFilename(filename: string) {
	return filename
		.replace(/\.[^.]+$/, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function sortGalleryFiles(a: string, b: string) {
	const order = (name: string) => {
		if (name.startsWith("DIRECTOR")) return 0;
		if (name.startsWith("STOCK PILOT")) return 1;
		if (name === "ACONGAS.jpg") return 2;
		return 3;
	};
	const diff = order(a) - order(b);
	if (diff !== 0) return diff;
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function loadGalleryPhotos(): GalleryPhoto[] {
	if (!fs.existsSync(GALLERY_DIR)) return [];

	return fs
		.readdirSync(GALLERY_DIR)
		.filter((file) => IMAGE_EXT.test(file))
		.sort(sortGalleryFiles)
		.map((file) => {
			const meta = photoMeta[file];
			const fallbackTitle = titleFromFilename(file);

			return {
				src: gallerySrc(file),
				alt: meta?.alt ?? fallbackTitle,
				title: meta?.title ?? fallbackTitle,
				caption: meta?.caption,
			};
		});
}

/** All images in /public/GALLERY — add files to the folder and rebuild (or refresh dev server). */
export const galleryPhotos = loadGalleryPhotos();
