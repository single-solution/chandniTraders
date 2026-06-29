import { requireSession } from "@/lib/api/requireSession";
import { badRequest, isValidId, notFound, ok, parseBody } from "@store/shared";
import { Brand, connectDB, handleMongoError, Product } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { validateVariant, loadVariantValidationContext, type VariantInput } from "@/lib/api/variantValidation";
import { toProductResponse, type ProductLean } from "@/lib/serializers/product";
import { type BrandLean } from "@/lib/serializers/brand";

interface RouteContext {
	params: Promise<{ id: string; variantId: string }>;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("product_update");
	if (response) {
		return response;
	}

	const { id, variantId } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid product ID.");
	}
	if (!isValidId(variantId)) {
		return badRequest("Invalid variant ID.");
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

	const result = await validateVariant(body, false, context);
	if (!result.ok) {
		return badRequest(result.error);
	}

	const set: Record<string, unknown> = {};
	const unset: Record<string, ""> = {};
	for (const [key, value] of Object.entries(result.value)) {
		set[`variants.$.${key}`] = value;
	}
	if (body.attributes !== undefined && !("attributeDisplay" in result.value)) {
		unset["variants.$.attributeDisplay"] = "";
	}

	if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
		return badRequest("No fields to update.");
	}

	try {
		const updated = await Product.findOneAndUpdate(
			{ _id: id, "variants._id": variantId },
			{
				...(Object.keys(set).length > 0 ? { $set: set } : {}),
				...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
			},
			{ returnDocument: "after", runValidators: true },
		).lean<ProductLean>();
		if (!updated) {
			return notFound("Product or variant not found");
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
			detail: `Variant ${variantId} updated`,
		});
		bustAdminCaches();
		return ok(toProductResponse(updated, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("product_update");
	if (response) {
		return response;
	}

	const { id, variantId } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid product ID.");
	}
	if (!isValidId(variantId)) {
		return badRequest("Invalid variant ID.");
	}

	await connectDB();
	try {
		const updated = await Product.findByIdAndUpdate(id, { $pull: { variants: { _id: variantId } } }, { returnDocument: "after" }).lean<ProductLean>();
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
			detail: `Variant ${variantId} removed`,
		});
		bustAdminCaches();
		return ok(toProductResponse(updated, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}
