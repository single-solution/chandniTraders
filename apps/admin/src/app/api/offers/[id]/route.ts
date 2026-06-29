import { connectDB, handleMongoError, Offer } from "@store/db";

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
import { badRequest, conflict, isValidId, isValidationError, noContent, normalizeOfferConstraintsForScope, normalizeStructuredContent, notFound, ok, parseBody, validateCatalogOfferRules, validateString, type OfferAction, type OfferCondition, type OfferConstraints } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { bustAdminCaches } from "@/lib/cached";
import { validateOfferCatalogScopeConflict } from "@/lib/api/offerScopeValidation";
import { toOfferResponse, type OfferLean } from "@/lib/serializers/offer";
import { recordActivity } from "@/lib/services/activityLog";
import { slugify } from "@store/shared";
import { OFFER_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { parseSeoPayload } from "@/lib/api/seoPayload";

function normalizeOfferConstraints(constraints: unknown, conditions: OfferCondition[]): OfferConstraints {
	const base = typeof constraints === "object" && constraints !== null ? (constraints as Record<string, unknown>) : { allowLoyaltyPoints: false, usageCount: 0 };
	return normalizeOfferConstraintsForScope(conditions, {
		allowLoyaltyPoints: Boolean(base.allowLoyaltyPoints),
		isStackable: false,
		usageCount: typeof base.usageCount === "number" ? base.usageCount : 0,
	});
}

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
	const doc = await Offer.findById(id).lean<OfferLean>();
	if (!doc) {
		return notFound("Offer not found");
	}

	return ok(toOfferResponse(doc));
}

interface OfferUpdateInput {
	slug?: unknown;
	title?: unknown;
	description?: unknown;
	discountLabel?: unknown;
	badgeLabel?: unknown;
	color?: unknown;
	bannerImage?: unknown;
	isActive?: unknown;
	sortOrder?: unknown;
	content?: unknown;
	seo?: unknown;
	conditions?: unknown;
	action?: unknown;
	schedule?: unknown;
	constraints?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("offer_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<OfferUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const update: Record<string, unknown> = {};

	if (body.title !== undefined) {
		const result = validateString(body.title, { label: "Title", max: OFFER_FIELD_LIMITS.title });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.title = result;
	}
	if (body.description !== undefined) {
		const result = validateString(body.description, { label: "Description", max: OFFER_FIELD_LIMITS.description });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.description = result;
	}
	if (body.discountLabel !== undefined) {
		const result = validateString(body.discountLabel, { label: "Discount label", max: OFFER_FIELD_LIMITS.discountLabel });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.discountLabel = result;
	}
	if (body.badgeLabel !== undefined) {
		const result = validateString(body.badgeLabel, { label: "Badge label", max: OFFER_FIELD_LIMITS.badgeLabel });
		if (isValidationError(result)) {
			return badRequest(result.error);
		}
		update.badgeLabel = result;
	}
	if (body.color !== undefined) {
		if (typeof body.color !== "string" || !HEX_COLOR_REGEX.test(body.color)) {
			return badRequest("Color must be a #RRGGBB hex value.");
		}
		update.color = body.color;
	}
	if (body.bannerImage !== undefined) {
		if (body.bannerImage !== null && typeof body.bannerImage !== "object") {
			return badRequest("bannerImage must be a StoredImage payload or null.");
		}
		update.bannerImage = body.bannerImage;
	}
	if (body.slug !== undefined && typeof body.slug === "string") {
		const slug = slugify(body.slug);
		if (slug.length === 0) {
			return badRequest("Slug cannot be empty.");
		}
		update.slug = slug;
	}
	if (body.isActive !== undefined) {
		update.isActive = Boolean(body.isActive);
	}
	if (typeof body.sortOrder === "number") {
		update.sortOrder = body.sortOrder;
	}
	if (body.content !== undefined) {
		const fallbackSummary = typeof update.description === "string" ? (update.description as string) : typeof body.description === "string" ? body.description : "";
		const content = normalizeStructuredContent(body.content, fallbackSummary);
		update.content = content;
		if (content.summary) {
			update.description = content.summary.slice(0, OFFER_FIELD_LIMITS.description);
		}
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

	if (body.conditions !== undefined) {
		if (Array.isArray(body.conditions)) {
			const scopeConflict = await validateOfferCatalogScopeConflict(body.conditions as OfferCondition[], id);
			if (scopeConflict) {
				return conflict(scopeConflict);
			}
			update.conditions = body.conditions;
		}
	}
	if (body.action !== undefined && typeof body.action === "object" && body.action !== null) {
		update.action = body.action;
	}
	if (body.schedule !== undefined && typeof body.schedule === "object" && body.schedule !== null) {
		update.schedule = body.schedule;
	}
	if (body.constraints !== undefined && typeof body.constraints === "object" && body.constraints !== null) {
		update.constraints = body.constraints;
	}

	if (Object.keys(update).length === 0) {
		return badRequest("No fields to update.");
	}

	await connectDB();

	const existing = await Offer.findById(id).select("conditions action constraints").lean<{
		conditions?: OfferCondition[];
		action?: OfferAction;
		constraints?: OfferConstraints;
	}>();
	if (!existing) {
		return notFound("Offer not found");
	}

	const nextConditions = (update.conditions ?? existing.conditions ?? []) as OfferCondition[];
	const nextAction = (update.action ?? existing.action ?? { type: "percentage_discount", value: 10, target: "matched_items" }) as OfferAction;

	if (update.conditions !== undefined || update.action !== undefined) {
		const catalogValidationError = validateCatalogOfferRules(nextConditions, nextAction);
		if (catalogValidationError) {
			return badRequest(catalogValidationError);
		}
	}

	if (update.constraints !== undefined) {
		update.constraints = normalizeOfferConstraints(update.constraints, nextConditions);
	} else if (update.conditions !== undefined) {
		update.constraints = normalizeOfferConstraints(existing.constraints ?? { allowLoyaltyPoints: false, isStackable: false, usageCount: 0 }, nextConditions);
	}

	try {
		const doc = await Offer.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean<OfferLean>();
		if (!doc) {
			return notFound("Offer not found");
		}

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "offer",
			resourceId: id,
			resourceLabel: doc.title,
		});
		bustAdminCaches();
		return ok(toOfferResponse(doc));
	} catch (error) {
		return handleMongoError(error);
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("offer_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	try {
		const doc = await Offer.findByIdAndDelete(id).lean<OfferLean>();
		if (!doc) {
			return notFound("Offer not found");
		}

		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "offer",
			resourceId: id,
			resourceLabel: doc.title,
		});
		bustAdminCaches();
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
