import { Brand, Category, connectDB, getStoreSettings, handleMongoError, Order, Product } from "@store/db";
import { badRequest, calculateProductSeoScore, conflict, isValidId, isValidationError, noContent, notFound, ok, parseBody, slugify, validateString } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { type BrandLean } from "@/lib/serializers/brand";
import { toProductResponse, type ProductLean } from "@/lib/serializers/product";
import { recordActivity } from "@/lib/services/activityLog";
import { PRODUCT_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { parseSeoPayload } from "@/lib/api/seoPayload";
import { validateProductAttributeConfig } from "@/lib/api/productAttributeConfigValidation";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("product_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	const doc = await Product.findById(id).lean<ProductLean>();
	if (!doc) {
		return notFound("Product not found");
	}

	const brand = await Brand.findOne({
		slug: doc.brandSlug,
		categorySlugs: doc.categorySlug,
	}).lean<BrandLean>();
	return ok(toProductResponse(doc, brand ?? undefined));
}

interface ProductUpdateInput {
	name?: unknown;
	slug?: unknown;
	brandSlug?: unknown;
	categorySlug?: unknown;
	isFeatured?: unknown;
	isActive?: unknown;
	isArchived?: unknown;
	seo?: unknown;
	attributeSlugs?: unknown;
	attributeOptionPool?: unknown;
	attributeCustomOptions?: unknown;
	attributeDefaults?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("product_update");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<ProductUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};

	if (body.name !== undefined) {
		const result = validateString(body.name, {
			label: "Name",
			max: PRODUCT_FIELD_LIMITS.name,
		});
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.name = result;
	}
	if (typeof body.slug === "string" && body.slug.trim().length > 0) {
		update.slug = slugify(body.slug, PRODUCT_FIELD_LIMITS.slug);
	}
	if (typeof body.brandSlug === "string" && body.brandSlug.length > 0) {
		const slug = slugify(body.brandSlug, 64);
		update.brandSlug = slug;
	}
	if (typeof body.categorySlug === "string" && body.categorySlug.length > 0) {
		const slug = slugify(body.categorySlug, 64);
		update.categorySlug = slug;
	}
	if (body.isFeatured !== undefined) {
		update.isFeatured = Boolean(body.isFeatured);
	}
	if (body.isActive !== undefined) {
		update.isActive = Boolean(body.isActive);
	}
	if (body.isArchived !== undefined) {
		update.isArchived = Boolean(body.isArchived);
	}
	if (body.seo !== undefined) {
		const parsed = parseSeoPayload(body.seo);
		if ("response" in parsed) {
			return parsed.response;
		}
		if ("seo" in parsed) {
			update.seo = parsed.seo;
		}
	}

	const hasAttributeConfig =
		body.attributeSlugs !== undefined || body.attributeOptionPool !== undefined || body.attributeCustomOptions !== undefined || body.attributeDefaults !== undefined;

	if (hasAttributeConfig) {
		await connectDB();
		const currentCategory = await Product.findById(id).select("categorySlug").lean<{ categorySlug: string }>();
		if (!currentCategory) {
			return notFound("Product not found");
		}
		const categorySlug = typeof update.categorySlug === "string" ? update.categorySlug : currentCategory.categorySlug;
		const configResult = await validateProductAttributeConfig(body, categorySlug, {
			strictPools: hasAttributeConfig,
		});
		if (!configResult.ok) {
			return badRequest(configResult.error);
		}
		update.attributeSlugs = configResult.value.attributeSlugs;
		update.attributeOptionPool = configResult.value.attributeOptionPool;
		update.attributeCustomOptions = configResult.value.attributeCustomOptions ?? {};
		update.attributeDefaults = configResult.value.attributeDefaults ?? {};
	}

	if (Object.keys(update).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();
	try {
		const current = await Product.findById(id).select("categorySlug brandSlug").lean<{ categorySlug: string; brandSlug: string }>();
		if (!current) {
			return notFound("Product not found");
		}
		const categorySlug = typeof update.categorySlug === "string" ? update.categorySlug : current.categorySlug;
		const brandSlug = typeof update.brandSlug === "string" ? update.brandSlug : current.brandSlug;
		const [categoryExists, brandExists] = await Promise.all([Category.exists({ slug: categorySlug }), Brand.exists({ slug: brandSlug, categorySlugs: categorySlug })]);
		if (!categoryExists) {
			return badRequest(`Category '${categorySlug}' does not exist.`);
		}
		if (!brandExists) {
			return badRequest(`Brand '${brandSlug}' is not linked to this category.`);
		}

		const doc = await Product.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after", runValidators: true }).lean<ProductLean>();
		if (!doc) {
			return notFound("Product not found");
		}

		const brand = await Brand.findOne({
			slug: doc.brandSlug,
			categorySlugs: doc.categorySlug,
		}).lean<BrandLean>();

		const storeSettings = await getStoreSettings();
		const storeName = storeSettings.siteName?.trim() || "Chandni Traders";
		const score = calculateProductSeoScore(doc.name, brand?.name || "", doc.seo, doc.images && doc.images.length > 0, storeName);

		if (doc.seo?.score !== score) {
			await Product.updateOne({ _id: doc._id }, { $set: { "seo.score": score } });
			if (doc.seo) doc.seo.score = score;
			else doc.seo = { score };
		}

		await recordActivity({
			actor,
			action: update.isArchived === true ? "archived" : "updated",
			resourceType: "product",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return ok(toProductResponse(doc, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("product_delete");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	// Hard delete is dangerous if any order references this product — order
	// history would render with broken links. Force admins to archive instead.
	const orderCount = await Order.countDocuments({ "items.productId": id });
	if (orderCount > 0) {
		return conflict(`Cannot delete a product referenced by ${orderCount} order${orderCount === 1 ? "" : "s"}. Archive it instead.`);
	}

	try {
		const doc = await Product.findByIdAndDelete(id).lean<ProductLean>();
		if (!doc) {
			return notFound("Product not found");
		}

		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "product",
			resourceId: id,
			resourceLabel: doc.name,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
