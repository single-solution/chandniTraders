/**
 * Merge helper for color classifications.
 *
 *   node scripts/catalog-rebuild/record-colors.mjs '<json>'
 *
 * Reads `color-decisions.json`, deep-merges the passed object (keyed by
 * product slug), and writes it back. Each slug maps to an ordered list of
 * real colors and the montage tile indexes that belong to each color:
 *
 *   { "<slug>": { "colors": [ { "name": "Off-White", "imageIndexes": [0,2] } ] } }
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { paths } from "./config.mjs";

const payload = process.argv[2];
if (!payload) {
	console.error("Usage: record-colors.mjs '<json>'");
	process.exit(1);
}

const incoming = JSON.parse(payload);
const current = existsSync(paths.colorDecisions) ? JSON.parse(readFileSync(paths.colorDecisions, "utf8")) : {};
for (const [slug, value] of Object.entries(incoming)) {
	current[slug] = value;
}
writeFileSync(paths.colorDecisions, JSON.stringify(current, null, 2));
console.log(`Recorded ${Object.keys(incoming).length} products. Total: ${Object.keys(current).length}/89`);
