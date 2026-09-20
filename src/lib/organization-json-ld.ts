import {
	BUSINESS_BRANCHES,
	ORGANIZATION,
	type BusinessBranch,
} from "../data/business-locations";
import { FACEBOOK_PAGE_URL } from "../data/social-links";

const ORGANIZATION_FRAGMENT = "#organization";

function entityId(siteOrigin: string, fragment: string) {
	return new URL(fragment, `${siteOrigin}/`).href;
}

function absoluteUrl(siteOrigin: string, path: string) {
	return new URL(path, `${siteOrigin}/`).href;
}

function buildOrganization(siteOrigin: string) {
	const orgId = entityId(siteOrigin, ORGANIZATION_FRAGMENT);
	const hq = BUSINESS_BRANCHES.find((branch) => branch.id === "matang");

	return {
		"@type": "Organization",
		"@id": orgId,
		name: ORGANIZATION.name,
		url: `${siteOrigin}/`,
		logo: absoluteUrl(siteOrigin, ORGANIZATION.logoPath),
		description: ORGANIZATION.description,
		email: ORGANIZATION.email,
		...(hq?.telephone ? { telephone: hq.telephone } : {}),
		identifier: {
			"@type": "PropertyValue",
			name: "Malaysia company registration number",
			value: ORGANIZATION.registrationNumber,
		},
		sameAs: [FACEBOOK_PAGE_URL],
		subOrganization: BUSINESS_BRANCHES.map((branch) => ({
			"@id": entityId(siteOrigin, `#${branch.id}`),
		})),
	};
}

function roundCoordinate(value: number) {
	return Number(value.toFixed(6));
}

function buildBranch(siteOrigin: string, branch: BusinessBranch) {
	const orgId = entityId(siteOrigin, ORGANIZATION_FRAGMENT);
	const branchId = entityId(siteOrigin, `#${branch.id}`);

	const store = {
		"@type": "AutoPartsStore",
		"@id": branchId,
		name: branch.name,
		alternateName: branch.alternateName,
		url: `${siteOrigin}/contact/`,
		address: {
			"@type": "PostalAddress",
			streetAddress: branch.streetAddress,
			postalCode: branch.postalCode,
			addressLocality: branch.addressLocality,
			addressRegion: branch.addressRegion,
			addressCountry: branch.addressCountry,
		},
		telephone: branch.telephone,
		geo: {
			"@type": "GeoCoordinates",
			latitude: roundCoordinate(branch.geo.latitude),
			longitude: roundCoordinate(branch.geo.longitude),
		},
	};

	if (branch.linkToParentOrganization) {
		return { ...store, parentOrganization: { "@id": orgId } };
	}

	return store;
}

export function buildOrganizationJsonLd(site: string | URL) {
	const siteOrigin = new URL(site).origin;

	return {
		"@context": "https://schema.org",
		"@graph": [
			buildOrganization(siteOrigin),
			...BUSINESS_BRANCHES.map((branch) => buildBranch(siteOrigin, branch)),
		],
	};
}
