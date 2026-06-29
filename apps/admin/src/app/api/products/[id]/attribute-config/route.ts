import { Brand, connectDB, handleMongoError, Product } from "@store/db";
import { badRequest, isValidId, notFound, ok, parseBody } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { validateProductAttributeConfig } from "@/lib/api/productAttributeConfigValidation";
import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { type BrandLean } from "@/lib/serializers/brand";
import { toProductResponse, type ProductLean } from "@/lib/serializers/product";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface ProductAttributeConfigInput {
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

	const body = await parseBody<ProductAttributeConfigInput>(request);
	if (body instanceof Response) {
		return body;
	}

	await connectDB();
	const current = await Product.findById(id).select("name categorySlug").lean<{ name: string; categorySlug: string }>();
	if (!current) {
		return notFound("Product not found");
	}

	const configResult = await validateProductAttributeConfig(body, current.categorySlug, {
		strictPools: true,
	});
	if (!configResult.ok) {
		return badRequest(configResult.error);
	}

	const update = {
		attributeSlugs: configResult.value.attributeSlugs,
		attributeOptionPool: configResult.value.attributeOptionPool,
		attributeCustomOptions: configResult.value.attributeCustomOptions ?? {},
		attributeDefaults: configResult.value.attributeDefaults ?? {},
	};

	try {
		const doc = await Product.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after", runValidators: true }).lean<ProductLean>();
		if (!doc) {
			return notFound("Product not found");
		}

		const brand = await Brand.findOne({
			slug: doc.brandSlug,
			categorySlugs: doc.categorySlug,
		}).lean<BrandLean>();

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "product",
			resourceId: id,
			resourceLabel: current.name,
			detail: "Product attribute configuration updated",
		});
		bustAdminCaches();
		return ok(toProductResponse(doc, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}
