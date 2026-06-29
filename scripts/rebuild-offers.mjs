/**
 * Fix invalid/storewide catalog offers, dedupe overlaps, seed scoped catalog deals.
 *
 *   npx tsx scripts/rebuild-offers.mjs --dry-run
 *   npx tsx scripts/rebuild-offers.mjs
 *   npx tsx scripts/rebuild-offers.mjs --min-catalog=20
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { slugify } from "../packages/shared/src/slug.ts";
import { isCheckoutOnlyOffer, isStorewideOffer } from "../packages/shared/src/pricing/offerMatching.ts";
import {
	extractOfferScenarios,
	findOfferCatalogScopeConflict,
	hasValidCatalogDealScope,
	normalizeCatalogOfferAction,
	normalizeOfferConstraintsForScope,
	summarizeScenarioScope,
} from "../packages/shared/src/pricing/offerScope.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(scriptDir, "../.env.local");
const isDryRun = process.argv.includes("--dry-run");
const minCatalogArg = process.argv.find((arg) => arg.startsWith("--min-catalog="));
const MIN_CATALOG = minCatalogArg ? Number.parseInt(minCatalogArg.split("=")[1], 10) : 20;

if (!process.env.MONGODB_URI && existsSync(envLocalPath)) {
	for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith("MONGODB_URI=")) {
			continue;
		}
		process.env.MONGODB_URI = trimmed.slice("MONGODB_URI=".length).trim();
		break;
	}
}

const uri = process.env.MONGODB_URI;
if (!uri) {
	console.error("MONGODB_URI is not set.");
	process.exit(1);
}

const OFFER_COLORS = ["#e1ff51", "#06b6d4", "#a855f7", "#f43f5e", "#f97316", "#10b981", "#3b82f6", "#6366f1", "#ec4899", "#14b8a6"];
const BADGE_LABELS = ["Deal", "Limited", "Hot", "Save", "Offer", "Promo", "Special"];
const CHECKOUT_PAYMENTS = ["bank-transfer", "card", "cod"];

function pickRandom(items) {
	return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function toCatalogProduct(row) {
	return {
		id: row._id.toString(),
		name: row.name,
		categorySlug: row.categorySlug,
		brandSlug: row.brandSlug,
		variants: (row.variants ?? []).map((variant) => ({
			attributes: variant.attributes ?? {},
		})),
	};
}

function buildCategoryConditions(categorySlug) {
	return [
		{
			type: "group",
			operator: "or",
			value: [
				{
					type: "group",
					operator: "and",
					value: [{ type: "categories", operator: "in", value: [categorySlug] }],
				},
			],
		},
	];
}

function buildProductConditions(product) {
	return [
		{
			type: "group",
			operator: "or",
			value: [
				{
					type: "group",
					operator: "and",
					value: [
						{ type: "categories", operator: "in", value: [product.categorySlug] },
						{ type: "products", operator: "in", value: [product.id] },
					],
				},
			],
		},
	];
}

function describeOfferScope(conditions) {
	if (isCheckoutOnlyOffer({ conditions })) {
		return "checkout";
	}
	const scenarios = extractOfferScenarios(conditions);
	if (scenarios.length === 0) {
		return "invalid";
	}
	const scope = summarizeScenarioScope(scenarios[0]);
	if (scope.productIds.length > 0) {
		return `product:${scope.productIds[0]}`;
	}
	if (scope.categorySlugs.length > 0) {
		return `category:${scope.categorySlugs[0]}`;
	}
	return "invalid";
}

function findFreeCategoryConditions(categories, keptPeers, products) {
	const shuffled = [...categories].sort(() => Math.random() - 0.5);
	for (const category of shuffled) {
		const conditions = buildCategoryConditions(category.slug);
		if (findOfferCatalogScopeConflict(conditions, keptPeers, products)) {
			continue;
		}
		return { conditions, label: category.label || category.slug, kind: "category" };
	}
	return null;
}

function findFreeProductConditions(catalogProducts, keptPeers) {
	const shuffled = [...catalogProducts].sort(() => Math.random() - 0.5);
	for (const product of shuffled) {
		const conditions = buildProductConditions(product);
		if (findOfferCatalogScopeConflict(conditions, keptPeers, catalogProducts)) {
			continue;
		}
		return { conditions, label: product.name, kind: "product", product };
	}
	return null;
}

function assignFreeCatalogScope(categories, catalogProducts, keptPeers, { preferProducts = true } = {}) {
	if (preferProducts) {
		return findFreeProductConditions(catalogProducts, keptPeers) ?? findFreeCategoryConditions(categories, keptPeers, catalogProducts);
	}
	return findFreeCategoryConditions(categories, keptPeers, catalogProducts) ?? findFreeProductConditions(catalogProducts, keptPeers);
}

function buildCatalogAction() {
	if (Math.random() < 0.55) {
		return { type: "percentage_discount", value: randomInt(5, 28), target: "matched_items" };
	}
	return { type: "fixed_amount_discount", value: randomInt(500, 5000), target: "matched_items" };
}

function buildCheckoutAction() {
	const roll = Math.random();
	if (roll < 0.2) {
		return { type: "free_shipping", value: 0, target: "cart_total" };
	}
	if (roll < 0.6) {
		return { type: "percentage_discount", value: randomInt(3, 15), target: "cart_total" };
	}
	return { type: "fixed_amount_discount", value: randomInt(300, 3000), target: "cart_total" };
}

function discountLabelForAction(action) {
	if (action.type === "free_shipping") {
		return "Free shipping";
	}
	if (action.type === "percentage_discount") {
		return `${action.value}% off`;
	}
	return `Rs ${action.value} off`;
}

function buildSeedCatalogOffer(scopeResult, sortOrder) {
	const action = buildCatalogAction();
	const title =
		scopeResult.kind === "category"
			? `${scopeResult.label} ${pickRandom(["Deal", "Sale", "Savings", "Special"])}`
			: `${scopeResult.label} ${pickRandom(["Deal", "Offer", "Promo"])}`;

	return {
		title,
		slug: slugify(title, 96),
		description: `Limited-time savings on ${scopeResult.label}.`,
		discountLabel: discountLabelForAction(action),
		badgeLabel: pickRandom(BADGE_LABELS),
		color: pickRandom(OFFER_COLORS),
		isActive: true,
		sortOrder,
		conditions: scopeResult.conditions,
		action,
		schedule: {},
		constraints: { allowLoyaltyPoints: false, isStackable: false, usageCount: 0 },
	};
}

function buildSeedCheckoutOffer(sortOrder) {
	const usePayment = Math.random() < 0.45;
	const action = buildCheckoutAction();
	const conditions = usePayment
		? [{ type: "payment_method", operator: "in", value: pickRandom(CHECKOUT_PAYMENTS) }]
		: [{ type: "cart_total", operator: "gte", value: randomInt(3000, 25000) }];

	const title = usePayment
		? `${conditions[0].value} checkout bonus`
		: `Spend Rs ${conditions[0].value}+ deal`;

	return {
		title,
		slug: slugify(title, 96),
		description: usePayment ? "Extra savings when you pay with this method." : "Unlock this offer when your cart total qualifies.",
		discountLabel: discountLabelForAction(action),
		badgeLabel: pickRandom(BADGE_LABELS),
		color: pickRandom(OFFER_COLORS),
		isActive: true,
		sortOrder,
		conditions,
		action,
		schedule: {},
		constraints: { allowLoyaltyPoints: false, isStackable: false, usageCount: 0 },
	};
}

async function ensureUniqueSlug(db, baseSlug, excludeId) {
	let slug = baseSlug;
	let suffix = 2;
	while (true) {
		const query = { slug };
		if (excludeId) {
			query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
		}
		if (!(await db.collection("offers").findOne(query))) {
			return slug;
		}
		slug = `${baseSlug}-${suffix}`.slice(0, 96);
		suffix += 1;
	}
}

async function main() {
	await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
	const db = mongoose.connection.db;

	const [offerRows, productRows, categoryRows] = await Promise.all([
		db.collection("offers").find({}).sort({ sortOrder: 1, createdAt: 1 }).toArray(),
		db
			.collection("products")
			.find({ isArchived: { $ne: true }, isActive: { $ne: false } })
			.project({ name: 1, categorySlug: 1, brandSlug: 1, variants: 1 })
			.toArray(),
		db
			.collection("categories")
			.find({ isActive: { $ne: false } })
			.project({ slug: 1, label: 1 })
			.toArray(),
	]);

	const products = productRows.map(toCatalogProduct);
	const categories = categoryRows.map((row) => ({ slug: row.slug, label: row.label ?? row.slug }));

	console.log(`Loaded ${offerRows.length} offers, ${categories.length} categories, ${products.length} products`);
	console.log(`Target: ${MIN_CATALOG}+ catalog deals, no overlaps\n`);

	const keptPeers = [];
	const stats = { fixed: 0, actionFixed: 0, loyaltyFixed: 0, kept: 0, deleted: 0, seededCatalog: 0, seededCheckout: 0 };

	for (const row of offerRows) {
		const offerId = row._id.toString();
		const peer = { id: offerId, title: row.title, conditions: row.conditions ?? [] };

		if (isCheckoutOnlyOffer(peer)) {
			keptPeers.push(peer);
			stats.kept += 1;
			console.log(`  keep   [checkout] ${row.title}`);
			continue;
		}

		let nextConditions = peer.conditions;
		const needsFix = isStorewideOffer(peer) || !hasValidCatalogDealScope(nextConditions);
		let conflict = hasValidCatalogDealScope(nextConditions)
			? findOfferCatalogScopeConflict(nextConditions, keptPeers, products)
			: null;

		if (needsFix || conflict) {
			const reason = needsFix ? (isStorewideOffer(peer) ? "storewide/empty" : "incomplete scope") : `overlap → ${conflict.conflictingOfferTitle}`;
			const reassigned = assignFreeCatalogScope(categories, products, keptPeers);
			if (!reassigned) {
				stats.deleted += 1;
				console.log(`  delete [${row.sortOrder}] ${row.title} — ${reason}, no free scope`);
				if (!isDryRun) {
					await db.collection("offers").deleteOne({ _id: row._id });
				}
				continue;
			}

			nextConditions = reassigned.conditions;
			stats.fixed += 1;
			const update = {
				conditions: nextConditions,
				action: normalizeCatalogOfferAction({ ...(row.action ?? { type: "percentage_discount", value: 10, target: "matched_items" }), target: "matched_items" }),
				discountLabel: discountLabelForAction(
					normalizeCatalogOfferAction({ ...(row.action ?? { type: "percentage_discount", value: 10, target: "matched_items" }), target: "matched_items" }),
				),
			};
			console.log(`  fix    [${row.sortOrder}] ${row.title} — ${reason} → ${describeOfferScope(nextConditions)}`);
			if (!isDryRun) {
				await db.collection("offers").updateOne({ _id: row._id }, { $set: update });
			}
			peer.conditions = nextConditions;
		}

		if (!isCheckoutOnlyOffer(peer) && hasValidCatalogDealScope(peer.conditions)) {
			const normalizedAction = normalizeCatalogOfferAction(row.action ?? { type: "percentage_discount", value: 10, target: "matched_items" });
			const actionChanged =
				row.action?.type !== normalizedAction.type ||
				row.action?.target !== normalizedAction.target ||
				row.action?.value !== normalizedAction.value;
			if (actionChanged) {
				stats.actionFixed += 1;
				const actionUpdate = {
					action: normalizedAction,
					discountLabel: discountLabelForAction(normalizedAction),
				};
				console.log(`  fix    [${row.sortOrder}] ${row.title} — catalog action → ${normalizedAction.type}`);
				if (!isDryRun) {
					await db.collection("offers").updateOne({ _id: row._id }, { $set: actionUpdate });
				}
			}

			const normalizedConstraints = normalizeOfferConstraintsForScope(peer.conditions, row.constraints ?? { allowLoyaltyPoints: false, isStackable: false, usageCount: 0 });
			if (row.constraints?.allowLoyaltyPoints !== normalizedConstraints.allowLoyaltyPoints) {
				stats.loyaltyFixed += 1;
				console.log(`  fix    [${row.sortOrder}] ${row.title} — catalog loyalty → off`);
				if (!isDryRun) {
					await db.collection("offers").updateOne({ _id: row._id }, { $set: { constraints: normalizedConstraints } });
				}
				row.constraints = normalizedConstraints;
			}
		}

		if (!needsFix && !conflict) {
			stats.kept += 1;
			console.log(`  keep   [catalog] ${row.title} (${describeOfferScope(peer.conditions)})`);
		}

		keptPeers.push(peer);
	}

	let catalogCount = keptPeers.filter((peer) => hasValidCatalogDealScope(peer.conditions)).length;
	let nextSortOrder = Math.max(0, ...offerRows.map((row) => row.sortOrder ?? 0)) + 1;
	const inserts = [];

	while (catalogCount < MIN_CATALOG) {
		const scopeResult = assignFreeCatalogScope(categories, products, keptPeers);
		if (!scopeResult) {
			console.log(`\nCannot seed more catalog offers — no free category/product slots (${catalogCount}/${MIN_CATALOG}).`);
			break;
		}

		const doc = buildSeedCatalogOffer(scopeResult, nextSortOrder);
		doc.slug = await ensureUniqueSlug(db, doc.slug);
		inserts.push(doc);
		keptPeers.push({ id: `seed-catalog-${inserts.length}`, title: doc.title, conditions: doc.conditions });
		catalogCount += 1;
		nextSortOrder += 1;
		stats.seededCatalog += 1;
		console.log(`  seed   [catalog] ${doc.title} (${describeOfferScope(doc.conditions)})`);
	}

	const checkoutInPool = keptPeers.filter((peer) => isCheckoutOnlyOffer(peer)).length;
	const targetCheckout = Math.max(4, Math.min(6, Math.ceil(MIN_CATALOG / 5)));
	let seededCheckout = 0;
	while (checkoutInPool + seededCheckout < targetCheckout) {
		const doc = buildSeedCheckoutOffer(nextSortOrder);
		doc.slug = await ensureUniqueSlug(db, doc.slug);
		inserts.push(doc);
		keptPeers.push({ id: `seed-checkout-${seededCheckout + 1}`, title: doc.title, conditions: doc.conditions });
		nextSortOrder += 1;
		seededCheckout += 1;
		stats.seededCheckout += 1;
		console.log(`  seed   [checkout] ${doc.title}`);
	}

	if (inserts.length > 0 && !isDryRun) {
		await db.collection("offers").insertMany(inserts);
	}

	const finalCatalog = keptPeers.filter((peer) => hasValidCatalogDealScope(peer.conditions)).length;
	const finalCheckout = keptPeers.filter((peer) => isCheckoutOnlyOffer(peer)).length;

	console.log("\n--- Summary ---");
	console.log(`Fixed scope: ${stats.fixed} | Fixed action: ${stats.actionFixed} | Fixed loyalty: ${stats.loyaltyFixed} | Kept: ${stats.kept} | Deleted: ${stats.deleted}`);
	console.log(`Seeded catalog: ${stats.seededCatalog} | Seeded checkout: ${stats.seededCheckout}`);
	console.log(`Final pool: ${finalCatalog} catalog deals, ${finalCheckout} checkout offers`);
	if (isDryRun) {
		console.log("\nDry run — no writes performed.");
	} else if (inserts.length > 0) {
		console.log(`\nInserted ${inserts.length} new offer(s).`);
	}

	await mongoose.disconnect();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
