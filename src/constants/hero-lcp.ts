/** Homepage hero LCP — keep preload and <picture> in sync. */
export const HERO_CAR_IMAGE = {
	base: "/images/hero-car",
	widths: [768, 1200, 1600] as const,
	/** Match the right-column image width in Hero.astro (not full-bleed). */
	sizes: "(min-width: 1024px) 56vw, 100vw",
	fallbackSrc: "/images/hero-car.webp",
	/** Required preload `href` fallback; not used when `imagesrcset` selects another width. */
	preloadHref: "/images/hero-car-1600w.avif",
};

/** Legacy product card image (other pages / assets). */
export const HERO_FEATURE_IMAGE = {
	base: "/images/products/apm-r134a",
	widths: [400, 600, 800] as const,
	sizes: "(min-width: 1000px) 42vw, 88vw",
	fallbackSrc: "/images/products/apm-r134a-800w.webp",
	preloadHref: "/images/products/apm-r134a-800w.avif",
};

export function heroFeatureAvifSrcset(
	base: string,
	widths: readonly number[],
): string {
	return widths.map((w) => `${base}-${w}w.avif ${w}w`).join(", ");
}
