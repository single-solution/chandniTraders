import { requireSession } from "@/lib/api/requireSession";
import { validateProductImages } from "@/lib/api/productImagesValidation";
import { badRequest, isValidId, notFound, ok, parseBody } from "@store/shared";
import { Brand, connectDB, handleMongoError, Product } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { toProductResponse, type ProductLean } from "@/lib/serializers/product";
import { type BrandLean } from "@/lib/serializers/brand";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface ProductImagesUpdateInput {
	images?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("product_update");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid product ID.");
	}

	const body = await parseBody<ProductImagesUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const result = validateProductImages(body.images, { required: true });
	if (!result.ok) {
		return badRequest(result.error);
	}

	await connectDB();
	const product = await Product.findById(id).select("name").lean<{ name: string }>();
	if (!product) {
		return notFound("Product not found");
	}

	try {
		const updatedProduct = await Product.findByIdAndUpdate(id, { $set: { images: result.value } }, { returnDocument: "after", runValidators: true }).lean<ProductLean>();
		if (!updatedProduct) {
			return notFound("Product not found");
		}

		const brand = await Brand.findOne({
			slug: updatedProduct.brandSlug,
			categorySlugs: updatedProduct.categorySlug,
		}).lean<BrandLean>();

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "product",
			resourceId: id,
			resourceLabel: product.name,
			detail: "Product photos updated",
		});
		bustAdminCaches();
		return ok(toProductResponse(updatedProduct, brand ?? undefined));
	} catch (error) {
		if (error instanceof Error && error.name === "ValidationError") {
			const validationError = error as Error & {
				errors?: Record<string, { message?: string }>;
			};
			const detail = Object.values(validationError.errors ?? {})
				.map((row) => row.message)
				.find(Boolean);
			if (detail) {
				return badRequest(detail);
			}
		}
		return handleMongoError(error);
	}
}
