export interface GalleryPhoto {
	/** Filename under public/gallery-assets (for maintenance). */
	file: string;
	src: string;
	alt: string;
	/** Short label for card overlay; omit if not set. */
	title?: string;
}

const GALLERY_EXCLUDED = new Set([
	"DIRECTOR GARY.jpg",
	"DIRECTOR IVAN.jpg",
	"DIRECTOR RAHIM.jpg",
	"DIRECTOR VINCE.jpg",
]);

function gallerySrc(filename: string) {
	return `/gallery-assets/${encodeURIComponent(filename).replace(/%2F/g, "/")}`;
}

/** Curated company gallery — director portraits live on /directors/ only. */
const curatedGallery: GalleryPhoto[] = [
	{
		file: "unnamed.webp",
		src: gallerySrc("unnamed.webp"),
		title: "Street-facing storefront",
		alt: "Multi-storey Tiong Hock Auto Parts building with red and white signage along the street",
	},
	{
		file: "unnamed (5).webp",
		src: gallerySrc("unnamed (5).webp"),
		title: "Incoming stock delivery",
		alt: "Cartons stacked on a tiled walkway beside a shuttered storefront entrance",
	},
	{
		file: "unnamed (3).webp",
		src: gallerySrc("unnamed (3).webp"),
		title: "Warehouse storage aisle",
		alt: "Narrow aisle between yellow industrial racks stacked with cartons and plastic bins",
	},
	{
		file: "unnamed (6).webp",
		src: gallerySrc("unnamed (6).webp"),
		title: "Picking bins and shelves",
		alt: "Warehouse aisle lined with yellow storage bins and shelved cartons",
	},
	{
		file: "unnamed (7).webp",
		src: gallerySrc("unnamed (7).webp"),
		title: "Shelved steering components",
		alt: "Yellow racks holding labelled cartons of tie rod ends and related steering parts",
	},
	{
		file: "unnamed (9).webp",
		src: gallerySrc("unnamed (9).webp"),
		title: "Shelf-stocked spare parts",
		alt: "Yellow shelving filled with small boxed automotive parts in a storage aisle",
	},
	{
		file: "unnamed (4).webp",
		src: gallerySrc("unnamed (4).webp"),
		title: "Radiator fan motor",
		alt: "Denso radiator fan motor assembly shown in front of its product carton",
	},
	{
		file: "ACONGAS.jpg",
		src: gallerySrc("ACONGAS.jpg"),
		title: "APM refrigerant display",
		alt: "Promotional display of stacked APM R134a refrigerant cartons in a warehouse setting",
	},
	{
		file: "STOCK PILOT 2.jpg",
		src: gallerySrc("STOCK PILOT 2.jpg"),
		title: "Stock maintenance screen",
		alt: "Computer monitor showing stock maintenance software in a warehouse office",
	},
	{
		file: "unnamed (1).webp",
		src: gallerySrc("unnamed (1).webp"),
		title: "Workshop vehicle service",
		alt: "Silver car on a lift with its hood open inside a service workshop",
	},
	{
		file: "unnamed (8).webp",
		src: gallerySrc("unnamed (8).webp"),
		title: "Vehicle Maintenance",
		alt: "Silver hatchback raised on a jack stand with its front wheel removed during maintenance",
	},
	{
		file: "unnamed (10).webp",
		src: gallerySrc("unnamed (10).webp"),
		title: "Engine diagnostic check",
		alt: "Technician using a handheld tester at the open engine bay of a vehicle",
	},
];

export const galleryPhotos = curatedGallery.filter((photo) => !GALLERY_EXCLUDED.has(photo.file));
