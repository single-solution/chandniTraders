import { requireSession } from "@/lib/api/requireSession";
import { badRequest, created, isValidId, notFound, parseBody } from "@store/shared";
import { Brand, connectDB, handleMongoError, Product } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { validateVariant, loadVariantValidationContext, type VariantInput } from "@/lib/api/variantValidation";
import { toProductResponse, type ProductLean } from "@/lib/serializers/product";
import { type BrandLean } from "@/lib/serializers/brand";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("product_update");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid product ID.");
	}

	const body = await parseBody<VariantInput>(request);
	if (body instanceof Response) {
		return body;
	}

	await connectDB();
	const context = await loadVariantValidationContext(id);
	if (!context) {
		return notFound("Product not found");
	}

	const result = await validateVariant(body, true, context);
	if (!result.ok) {
		return badRequest(result.error);
	}

	try {
		const updated = await Product.findByIdAndUpdate(id, { $push: { variants: result.value } }, { returnDocument: "after", runValidators: true }).lean<ProductLean>();
		if (!updated) {
			return notFound("Product not found");
		}

		const brand = await Brand.findOne({
			slug: updated.brandSlug,
			categorySlugs: updated.categorySlug,
		}).lean<BrandLean>();
		await recordActivity({
			actor,
			action: "updated",
			resourceType: "product",
			resourceId: id,
			resourceLabel: updated.name,
			detail: "Variant added",
		});
		bustAdminCaches();
		return created(toProductResponse(updated, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}
