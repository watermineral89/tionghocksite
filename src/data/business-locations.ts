/**
 * Verified branch facts for structured data (sourced from ContactSection.astro
 * and DistributionMap.astro — keep in sync when branch details change).
 */
export type BusinessBranch = {
	id: "matang" | "samarahan";
	name: string;
	alternateName: string;
	streetAddress: string;
	postalCode: string;
	addressLocality: string;
	addressRegion: string;
	addressCountry: string;
	telephone: string;
	geo: {
		latitude: number;
		longitude: number;
	};
	/** When true, link branch to the parent Organization in JSON-LD */
	linkToParentOrganization: boolean;
};

export const ORGANIZATION = {
	name: "Tiong Hock Auto Parts (KCH) Sdn Bhd",
	description:
		"Wholesale & retail sale of motor vehicle spare parts & accessories.",
	email: "enquiries@tionghock.com.my",
	registrationNumber: "201301042376 (1072201-H)",
	logoPath: "/logo-horizontal.png",
} as const;

export const BUSINESS_BRANCHES: BusinessBranch[] = [
	{
		id: "matang",
		name: "Tiong Hock Auto Parts (KCH) Sdn Bhd",
		alternateName: "Matang Jaya HQ",
		streetAddress:
			"Lot 9747, Section 65, Sublot 37, Phase 12, Jalan Matang Jaya, Taman Lee Ling",
		postalCode: "93050",
		addressLocality: "Kuching",
		addressRegion: "Sarawak",
		addressCountry: "MY",
		telephone: "+6082649433",
		geo: { latitude: 1.571454, longitude: 110.300636 },
		linkToParentOrganization: true,
	},
	{
		id: "samarahan",
		name: "Tiong Hock AutoMart Sdn Bhd",
		alternateName: "Kota Samarahan Automart",
		streetAddress: "Uni Central Commercial Centre, Lot 27, Ground Floor",
		postalCode: "94300",
		addressLocality: "Kota Samarahan",
		addressRegion: "Sarawak",
		addressCountry: "MY",
		telephone: "+6082375775",
		geo: { latitude: 1.472241, longitude: 110.416381 },
		linkToParentOrganization: false,
	},
];
