/**
 * Category OG card.
 *
 * Simpler than the PDP card — just the category label, store name, and
 * a montage strip of up to four featured product hero images
 * (`variants.detail`).
 */

import { ImageResponse } from "next/og";

import { getCategoryMetaBySlug, getProducts } from "@/lib/core/queries";
import { getSeoSettings } from "@/lib/seo/seoSettings";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const revalidate = 86_400;
export const alt = "Category preview";

interface OgPageParams {
	params: Promise<{ category: string }>;
}

interface CategoryOgData {
	siteName: string;
	categoryLabel: string;
	categoryDescription: string;
	tiles: string[];
}

const TILE_LIMIT = 4;

async function loadCategoryOgData(category: string): Promise<CategoryOgData | null> {
	try {
		const [meta, settings] = await Promise.all([getCategoryMetaBySlug(category), getSeoSettings()]);
		if (!meta) return null;
		const products = await getProducts({
			categorySlug: meta.slug,
			limit: TILE_LIMIT,
		});
		const tiles = products
			.map((product) => product.images[0]?.variants.detail)
			.filter((url): url is string => typeof url === "string")
			.slice(0, TILE_LIMIT);
		return {
			siteName: settings.siteName,
			categoryLabel: meta.label,
			categoryDescription: meta.description,
			tiles,
		};
	} catch {
		return null;
	}
}

export default async function CategoryOgImage({ params }: OgPageParams) {
	const { category } = await params;
	const data = await loadCategoryOgData(category);
	if (!data) {
		return fallbackImage("Chandni Traders");
	}
	return new ImageResponse(<CategoryCard {...data} />, size);
}

function CategoryCard(data: CategoryOgData) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				background: "linear-gradient(135deg, #1a3f44 0%, #0a3035 60%, #00272c 100%)",
				color: "#f8fbf8",
				fontFamily: "system-ui, sans-serif",
				padding: 64,
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 16,
					flex: "0 0 auto",
				}}
			>
				<div
					style={{
						display: "flex",
						alignSelf: "flex-start",
						background: "rgba(255,255,255,0.15)",
						borderRadius: 9999,
						padding: "8px 22px",
						fontSize: 22,
						letterSpacing: 2,
						textTransform: "uppercase",
					}}
				>
					{data.siteName}
				</div>
				<div style={{ display: "flex", fontSize: 80, fontWeight: 800 }}>{`Shop ${data.categoryLabel}`}</div>
				<div style={{ fontSize: 26, opacity: 0.8, maxWidth: 900 }}>{data.categoryDescription}</div>
			</div>
			{data.tiles.length > 0 ? (
				<div
					style={{
						marginTop: "auto",
						display: "flex",
						gap: 20,
						width: "100%",
						height: 240,
					}}
				>
					{data.tiles.map((url) => (
						<div
							key={url}
							style={{
								flex: 1,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								background: "rgba(255,255,255,0.06)",
								borderRadius: 24,
								padding: 16,
							}}
						>
							<img
								src={url}
								alt=""
								style={{
									maxWidth: "100%",
									maxHeight: "100%",
									objectFit: "contain",
								}}
							/>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

function fallbackImage(label: string) {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#00272c",
				color: "#f8fbf8",
				fontFamily: "system-ui, sans-serif",
				fontSize: 84,
				fontWeight: 800,
			}}
		>
			{label}
		</div>,
		size,
	);
}
