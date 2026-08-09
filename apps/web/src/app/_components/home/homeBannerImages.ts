/** Static hero mosaic tiles — decorative category imagery, not product cards. */
export interface HomeBannerTile {
	src: string;
	alt: string;
	caption: string;
	href: string;
}

export const HOME_BANNER_TILES: HomeBannerTile[] = [
	{
		src: "https://pub-17431e1c427d40d0985dbd2d1204474c.r2.dev/banners/banner1.jpg",
		alt: "Room cooler and washing machine side by side in a modern home setup",
		caption: "Coolers & Washers",
		href: "/room-coolers",
	},
	{
		src: "https://pub-17431e1c427d40d0985dbd2d1204474c.r2.dev/banners/banner2.jpg",
		alt: "Elegant modern ceiling fan in a warm contemporary living room",
		caption: "Premium Ceiling Fans",
		href: "/ceiling-fans",
	},
	{
		src: "https://pub-17431e1c427d40d0985dbd2d1204474c.r2.dev/banners/banner3.png",
		alt: "Sleek modern pedestal fan in a well-lit living room",
		caption: "Pedestal & Stand Fans",
		href: "/pedestal-fans",
	},
];
