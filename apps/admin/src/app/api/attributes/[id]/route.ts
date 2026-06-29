import { requireSession } from "@/lib/api/requireSession";
import { badRequest, conflict, isValidationError, isValidId, noContent, notFound, ok, parseBody, validateString } from "@store/shared";

import { Attribute, connectDB, handleMongoError } from "@store/db";
import { ATTRIBUTE_CARD_POSITIONS } from "@store/db";

import { ATTRIBUTE_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { toAttributeResponse, type AttributeLean } from "@/lib/serializers/attribute";
import { parseAttributeOptions, parseAttributeUnit, parseAttributeVisibilityInput } from "@/lib/api/attributesPayload";
import { cascadeAttributeSlugChange, slugFromCatalogLabel } from "@/lib/services/catalogSlugSync";

async function hasAttributeSlugConflict(id: string, categorySlug: string, slug: string): Promise<boolean> {
	const existing = await Attribute.exists({
		_id: { $ne: id },
		categorySlug,
		slug,
	});
	return Boolean(existing);
}

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface AttributeUpdateInput {
	label?: unknown;
	unit?: unknown;
	options?: unknown;
	cardPosition?: unknown;
	visibility?: unknown;
	isActive?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("category_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<AttributeUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};
	const unset: Record<string, ""> = {};

	if (body.label !== undefined) {
		const result = validateString(body.label, {
			label: "Label",
			max: ATTRIBUTE_FIELD_LIMITS.label,
		});
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.label = result;
	}
	let unitForOptions: string | undefined;
	if (body.unit !== undefined) {
		const unitResult = parseAttributeUnit(body.unit);
		if (typeof unitResult === "object" && "error" in unitResult) {
			return badRequest(unitResult.error);
		}
		unitForOptions = unitResult;
		if (unitResult) {
			update.unit = unitResult;
		} else {
			unset.unit = "";
		}
	}
	if (body.options !== undefined) {
		let resolvedUnit = unitForOptions;
		if (resolvedUnit === undefined) {
			await connectDB();
			const currentUnit = await Attribute.findById(id).select("unit").lean<{ unit?: string }>();
			resolvedUnit = currentUnit?.unit?.trim() ?? "";
		}
		const parsed = parseAttributeOptions(body.options, resolvedUnit);
		if ("error" in parsed) {
			return badRequest(parsed.error);
		}
		update.options = parsed.options;
	}
	if (body.cardPosition !== undefined) {
		if (typeof body.cardPosition !== "string" || !(ATTRIBUTE_CARD_POSITIONS as readonly string[]).includes(body.cardPosition)) {
			return badRequest(`cardPosition must be one of: ${ATTRIBUTE_CARD_POSITIONS.join(", ")}.`);
		}
		update.cardPosition = body.cardPosition;
	}
	if (body.visibility !== undefined) {
		const visibilityResult = parseAttributeVisibilityInput(body.visibility);
		if ("error" in visibilityResult) {
			return badRequest(visibilityResult.error);
		}
		update.visibility = visibilityResult;
	}
	if (body.isActive !== undefined) {
		update.isActive = Boolean(body.isActive);
	}
	if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();
	try {
		const current = await Attribute.findById(id).select("categorySlug slug label").lean<{ categorySlug: string; slug: string; label: string }>();
		if (!current) {
			return notFound("Attribute not found");
		}

		if (typeof update.label === "string") {
			const nextSlug = slugFromCatalogLabel(update.label, 60);
			if (await hasAttributeSlugConflict(id, current.categorySlug, nextSlug)) {
				return conflict("An attribute with this slug already exists in this category.");
			}
			update.slug = nextSlug;
		}

		const doc = await Attribute.findByIdAndUpdate(
			id,
			{
				...(Object.keys(update).length > 0 ? { $set: update } : {}),
				...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
			},
			{ new: true, runValidators: true },
		).lean<AttributeLean>();
		if (!doc) {
			return notFound("Attribute not found");
		}

		if (typeof update.slug === "string" && update.slug !== current.slug) {
			await cascadeAttributeSlugChange(current.categorySlug, current.slug, update.slug as string);
		}

		void recordActivity({
			actor,
			action: "updated",
			resourceType: "attribute",
			resourceId: id,
			resourceLabel: doc.label,
		});
		bustAdminCaches();
		return ok(toAttributeResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("category_manage");
	if (response) {
		return response;
	}
	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	try {
		const doc = await Attribute.findByIdAndDelete(id).lean<AttributeLean>();
		if (!doc) {
			return notFound("Attribute not found");
		}
		void recordActivity({
			actor,
			action: "deleted",
			resourceType: "attribute",
			resourceId: id,
			resourceLabel: doc.label,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
