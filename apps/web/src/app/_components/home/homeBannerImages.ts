/** Static hero mosaic tiles — decorative category imagery, not product cards. */
export interface HomeBannerTile {
	src: string;
	alt: string;
	caption: string;
	href: string;
}

export const HOME_BANNER_TILES: HomeBannerTile[] = [
	{
		src: "https://chandnitraders.pk/wp-content/uploads/2025/12/ceilling-fan.webp",
		alt: "Modern ceiling fan in a living room",
		caption: "Inverter ceiling fans",
		href: "/ceiling-fans",
	},
	{
		src: "https://chandnitraders.pk/wp-content/uploads/2026/01/furniture-998265_1280.webp",
		alt: "Home appliances and cooling equipment",
		caption: "Home appliances",
		href: "/room-coolers",
	},
	{
		src: "https://chandnitraders.pk/wp-content/uploads/2025/01/whispers-comfort-breezing-through-life-with-stylish-fan_941561-8650-600x600.jpg",
		alt: "Wall-mounted bracket fan",
		caption: "Bracket & exhaust fans",
		href: "/bracket-fans",
	},
];
