/**
 * Stage 2 — build one labeled montage per product for vision review.
 *
 *   node scripts/catalog-rebuild/02-build-montages.mjs
 *
 * Downloads every unique source image for each product, drops
 * byte-identical duplicates, and composites the survivors into a single
 * grid image with an index badge on each tile. Writes the montages to
 * `.data/montages/<slug>.webp` and a `.data/montage-index.json` describing
 * which source image each tile index maps to. The color-classification
 * step then only needs to read one image per product.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

import { ensureDataDirs, montageDir, paths } from "./config.mjs";

const TILE = 320;
const LABEL_H = 44;
const GAP = 6;

async function download(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`download ${url}: ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

function escapeXml(text) {
	return String(text).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);
}

async function makeTile(buffer, label) {
	const image = await sharp(buffer)
		.resize(TILE, TILE, { fit: "contain", background: { r: 245, g: 245, b: 245 } })
		.toBuffer();
	const labelSvg = Buffer.from(
		`<svg width="${TILE}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="30" font-family="sans-serif" font-size="22" fill="#fff">${escapeXml(label)}</text></svg>`,
	);
	return sharp({ create: { width: TILE, height: TILE + LABEL_H, channels: 3, background: { r: 245, g: 245, b: 245 } } })
		.composite([
			{ input: labelSvg, top: 0, left: 0 },
			{ input: image, top: LABEL_H, left: 0 },
		])
		.png()
		.toBuffer();
}

async function buildMontage(product) {
	const tiles = [];
	const seenHashes = new Map();
	let index = 0;
	for (const candidate of product.candidates) {
		let buffer;
		try {
			buffer = await download(candidate.src);
		} catch (error) {
			console.log(`    skip ${candidate.src}: ${error.message}`);
			continue;
		}
		const hash = createHash("sha1").update(buffer).digest("hex");
		if (seenHashes.has(hash)) {
			// Byte-identical duplicate — fold into the existing tile.
			tiles[seenHashes.get(hash)].duplicateOf = seenHashes.get(hash);
			continue;
		}
		seenHashes.set(hash, tiles.length);
		const shortOption = candidate.wooOption ? ` "${candidate.wooOption}"` : "";
		const tileBuffer = await makeTile(buffer, `#${index}${shortOption}`);
		tiles.push({
			index,
			src: candidate.src,
			alt: candidate.alt,
			source: candidate.source,
			variationId: candidate.variationId ?? null,
			wooOption: candidate.wooOption ?? null,
			tileBuffer,
		});
		index += 1;
	}
	if (tiles.length === 0) return null;

	const columns = Math.min(tiles.length, Math.ceil(Math.sqrt(tiles.length)));
	const rows = Math.ceil(tiles.length / columns);
	const cellW = TILE + GAP;
	const cellH = TILE + LABEL_H + GAP;
	const canvas = sharp({
		create: { width: columns * cellW + GAP, height: rows * cellH + GAP, channels: 3, background: { r: 220, g: 220, b: 220 } },
	});
	const composites = tiles.map((tile, position) => ({
		input: tile.tileBuffer,
		top: GAP + Math.floor(position / columns) * cellH,
		left: GAP + (position % columns) * cellW,
	}));
	const montage = await canvas.composite(composites).webp({ quality: 78 }).toBuffer();
	writeFileSync(resolve(montageDir, `${product.slug}.webp`), montage);

	return tiles.map(({ tileBuffer, ...rest }) => rest);
}

/** The candidate image list drives one tile each: variation images for variable products, gallery for simple. */
function candidatesFor(product) {
	if (product.type === "variable" && product.variations.length > 0) {
		const list = [];
		for (const variation of product.variations) {
			const option = variation.attributes.map((attribute) => attribute.option).filter(Boolean).join(" / ");
			if (variation.image?.src) {
				list.push({ src: variation.image.src, alt: variation.image.alt, source: "variation", variationId: variation.id, wooOption: option });
			}
		}
		// Include any parent gallery image not already represented, in case a variation lacked its own photo.
		for (const image of product.images) {
			if (!list.some((row) => row.src === image.src)) {
				list.push({ src: image.src, alt: image.alt, source: "gallery" });
			}
		}
		return list;
	}
	return product.images.map((image) => ({ src: image.src, alt: image.alt, source: "gallery" }));
}

async function main() {
	ensureDataDirs();
	const catalog = JSON.parse(readFileSync(paths.wooCatalog, "utf8"));
	const montageIndex = {};
	let done = 0;
	for (const product of catalog) {
		product.candidates = candidatesFor(product);
		if (product.candidates.length === 0) {
			console.log(`  ${product.slug}: NO IMAGES`);
			montageIndex[product.slug] = { name: product.name, type: product.type, tiles: [] };
			continue;
		}
		const tiles = await buildMontage(product);
		montageIndex[product.slug] = { name: product.name, type: product.type, tiles: tiles ?? [] };
		done += 1;
		console.log(`  ${product.slug}: ${tiles?.length ?? 0} tiles`);
	}
	writeFileSync(paths.montageIndex, JSON.stringify(montageIndex, null, 2));
	console.log(`\nBuilt ${done} montages in ${montageDir}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
