import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { type BrandLean } from "@/lib/serializers/brand";
import { toProductResponse, type ProductLean } from "@/lib/serializers/product";
import { Brand, connectDB, handleMongoError, Product } from "@store/db";
import { badRequest, isValidId, notFound, ok, parseBody } from "@store/shared";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface StockBody {
	inStock?: unknown;
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

	const body = await parseBody<StockBody>(request);
	if (body instanceof Response) {
		return body;
	}

	if (typeof body.inStock !== "boolean") {
		return badRequest("inStock must be a boolean.");
	}

	await connectDB();

	try {
		const doc = await Product.findById(id);
		if (!doc) {
			return notFound("Product not found");
		}

		const variants = doc.variants ?? [];
		if (variants.length === 0) {
			return badRequest("Add at least one variant before changing stock.");
		}

		for (const variant of variants) {
			if (body.inStock) {
				if ((variant.quantity ?? 0) === 0) {
					variant.quantity = 1;
				}
			} else {
				variant.quantity = 0;
			}
		}

		doc.markModified("variants");
		await doc.save();

		const lean = doc.toObject() as unknown as ProductLean;
		const brand = await Brand.findOne({
			slug: lean.brandSlug,
			categorySlugs: lean.categorySlug,
		}).lean<BrandLean>();

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "product",
			resourceId: id,
			resourceLabel: lean.name,
			detail: body.inStock ? "Marked in stock" : "Marked sold out",
		});
		bustAdminCaches();

		return ok(toProductResponse(lean, brand ?? undefined));
	} catch (error) {
		return handleMongoError(error);
	}
}
