export interface PartsSubcategory {
	name: string;
	searchHint?: string;
}

export interface PartsSystem {
	id: string;
	name: string;
	summary: string;
	subcategories: PartsSubcategory[];
}

export const partsSystems: PartsSystem[] = [
	{
		id: "engine",
		name: "Engine",
		summary: "Gaskets, belts, mounts, and engine service components.",
		subcategories: [
			{ name: "Timing Belt & Chain" },
			{ name: "Engine Mount" },
			{ name: "Gasket Set" },
			{ name: "Oil Seal" },
			{ name: "Water Pump" },
			{ name: "Thermostat" },
		],
	},
	{
		id: "cooling",
		name: "Cooling",
		summary: "Radiators, hoses, fans, and cooling system parts.",
		subcategories: [
			{ name: "Radiator" },
			{ name: "Radiator Hose" },
			{ name: "Radiator Fan" },
			{ name: "Coolant Reservoir" },
			{ name: "Thermostat Housing" },
		],
	},
	{
		id: "electrical",
		name: "Electrical",
		summary: "Alternators, starters, batteries, and electrical components.",
		subcategories: [
			{ name: "Alternator", searchHint: "ALT" },
			{ name: "Starter Motor", searchHint: "STR" },
			{ name: "Battery" },
			{ name: "Ignition Coil" },
			{ name: "Sensor" },
			{ name: "Relay & Fuse" },
		],
	},
	{
		id: "air-conditioning",
		name: "Air Conditioning",
		summary: "Refrigerant, compressors, condensers, and A/C service parts.",
		subcategories: [
			{ name: "Refrigerant", searchHint: "R134a" },
			{ name: "Compressor" },
			{ name: "Condenser" },
			{ name: "Evaporator" },
			{ name: "A/C Hose & O-Ring" },
		],
	},
	{
		id: "brake",
		name: "Brake",
		summary: "Pads, discs, shoes, cylinders, and brake hardware.",
		subcategories: [
			{ name: "Brake Pad", searchHint: "BP" },
			{ name: "Brake Disc", searchHint: "DIS" },
			{ name: "Brake Shoe" },
			{ name: "Brake Master Cylinder" },
			{ name: "Wheel Cylinder" },
			{ name: "Brake Hose" },
		],
	},
	{
		id: "suspension-steering",
		name: "Suspension & Steering",
		summary: "Shocks, arms, joints, bushings, and steering linkage.",
		subcategories: [
			{ name: "Shock Absorber", searchHint: "KYB" },
			{ name: "Absorber Mounting" },
			{ name: "Lower Arm" },
			{ name: "Ball Joint" },
			{ name: "Tie Rod" },
			{ name: "Rack End" },
			{ name: "Stabilizer Link" },
			{ name: "Bush" },
			{ name: "Wheel Bearing" },
		],
	},
	{
		id: "transmission",
		name: "Transmission",
		summary: "Clutch, drive shafts, CV joints, and gearbox-related parts.",
		subcategories: [
			{ name: "Clutch Kit" },
			{ name: "Clutch Master Cylinder" },
			{ name: "Drive Shaft" },
			{ name: "CV Joint & Boot" },
			{ name: "Transmission Mount" },
		],
	},
	{
		id: "fuel-system",
		name: "Fuel System",
		summary: "Pumps, injectors, filters, and fuel delivery components.",
		subcategories: [
			{ name: "Fuel Pump" },
			{ name: "Fuel Filter" },
			{ name: "Injector" },
			{ name: "Fuel Hose" },
			{ name: "Throttle Body" },
		],
	},
	{
		id: "body-exterior",
		name: "Body & Exterior",
		summary: "Lamps, bumpers, mirrors, and exterior body parts.",
		subcategories: [
			{ name: "Headlamp", searchHint: "LAM" },
			{ name: "Tail Lamp" },
			{ name: "Bumper", searchHint: "BMP" },
			{ name: "Mirror" },
			{ name: "Grille & Moulding" },
			{ name: "Door Handle & Lock" },
		],
	},
	{
		id: "bearings-seals",
		name: "Bearings & Seals",
		summary: "Wheel bearings, oil seals, and precision rotating components.",
		subcategories: [
			{ name: "Wheel Bearing" },
			{ name: "Oil Seal" },
			{ name: "Hub Assembly" },
			{ name: "Pillow Block Bearing" },
		],
	},
	{
		id: "filters",
		name: "Filters",
		summary: "Oil, air, fuel, and cabin filtration.",
		subcategories: [
			{ name: "Oil Filter", searchHint: "FLT" },
			{ name: "Air Filter" },
			{ name: "Fuel Filter" },
			{ name: "Cabin Filter" },
		],
	},
	{
		id: "lubricants-fluids",
		name: "Lubricants & Fluids",
		summary: "Engine oils, gear oils, coolants, and service fluids.",
		subcategories: [
			{ name: "Engine Oil", searchHint: "SVO" },
			{ name: "Gear Oil" },
			{ name: "Coolant" },
			{ name: "Brake Fluid" },
			{ name: "Power Steering Fluid" },
			{ name: "Additives" },
		],
	},
	{
		id: "workshop-accessories",
		name: "Workshop / Accessories",
		summary: "Tools, consumables, and workshop support items.",
		subcategories: [
			{ name: "Hand Tools" },
			{ name: "Consumables" },
			{ name: "Cleaning & Degreaser" },
			{ name: "Fasteners & Hardware" },
		],
	},
];

export function waCategoryMessage(system: string, subcategory?: string): string {
	const line = subcategory ? `${system} → ${subcategory}` : system;
	return `Hello Tiong Hock — I need a fitment check for *${line}*.\n\nVehicle / chassis no.: \nPart refs on hand: `;
}
