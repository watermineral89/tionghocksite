/** Homepage hero LCP product image — keep preload and <picture> in sync. */
export const HERO_FEATURE_IMAGE = {
	base: "/images/products/apm-r134a",
	widths: [400, 600, 800] as const,
	sizes: "(min-width: 1000px) 42vw, 88vw",
	fallbackSrc: "/images/products/apm-r134a-800w.webp",
	/** Required preload `href` fallback; not used when `imagesrcset` selects another width. */
	preloadHref: "/images/products/apm-r134a-800w.avif",
};

export function heroFeatureAvifSrcset(
	base: string,
	widths: readonly number[],
): string {
	return widths.map((w) => `${base}-${w}w.avif ${w}w`).join(", ");
}
