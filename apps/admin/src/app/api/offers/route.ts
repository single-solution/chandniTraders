import { requireSession } from "@/lib/api/requireSession";
import { readListOptions, type ListResponse } from "@/lib/api/listOptions";
import { OFFER_FIELD_LIMITS } from "@/lib/api/fieldLimits";
import { badRequest, conflict, created, isValidationError, normalizeOfferConstraintsForScope, normalizeStructuredContent, ok, parseBody, validateCatalogOfferRules, validateString, type OfferAction, type OfferCondition, type OfferConstraints } from "@store/shared";

import { connectDB, handleMongoError, Offer } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { validateOfferCatalogScopeConflict } from "@/lib/api/offerScopeValidation";
import { recordActivity } from "@/lib/services/activityLog";
import { slugify } from "@store/shared";

import { toOfferResponse, type OfferLean } from "@/lib/serializers/offer";
import type { AdminOffer } from "@/types/models";
import { parseSeoPayload } from "@/lib/api/seoPayload";

function normalizeOfferConstraints(constraints: unknown, conditions: OfferCondition[]): OfferConstraints {
	const base = typeof constraints === "object" && constraints !== null ? (constraints as Record<string, unknown>) : { allowLoyaltyPoints: false, usageCount: 0 };
	return normalizeOfferConstraintsForScope(conditions, {
		allowLoyaltyPoints: Boolean(base.allowLoyaltyPoints),
		isStackable: false,
		usageCount: typeof base.usageCount === "number" ? base.usageCount : 0,
	});
}

export async function GET(request: Request) {
	const { response } = await requireSession("product_view");
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const { page, limit, skip, search, searchPattern } = readListOptions(request);

		const filter: Record<string, unknown> = {};
		if (search) {
			filter.$or = [
				{ title: { $regex: searchPattern, $options: "i" } },
				{ slug: { $regex: searchPattern, $options: "i" } },
				{ badgeLabel: { $regex: searchPattern, $options: "i" } },
			];
		}

		const [docs, total] = await Promise.all([Offer.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit).lean<OfferLean[]>(), Offer.countDocuments(filter)]);

		const payload: ListResponse<AdminOffer> = {
			items: docs.map(toOfferResponse),
			total,
			page,
			limit,
		};
		return ok(payload);
	} catch (error) {
		return handleMongoError(error);
	}
}

interface OfferInput {
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

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_OFFER_COLOR = "#e1ff51";

function parseColor(value: unknown): string {
	if (typeof value === "string" && HEX_COLOR_REGEX.test(value)) {
		return value;
	}
	return DEFAULT_OFFER_COLOR;
}

export async function POST(request: Request) {
	const { actor, response } = await requireSession("offer_manage");
	if (response) {
		return response;
	}

	const body = await parseBody<OfferInput>(request);
	if (body instanceof Response) {
		return body;
	}

	const titleResult = validateString(body.title, { label: "Title", max: OFFER_FIELD_LIMITS.title });
	if (isValidationError(titleResult)) {
		return badRequest(titleResult.error);
	}

	const descriptionResult = validateString(body.description, { label: "Description", max: OFFER_FIELD_LIMITS.description });
	if (isValidationError(descriptionResult)) {
		return badRequest(descriptionResult.error);
	}

	const discountResult = validateString(body.discountLabel, { label: "Discount label", max: OFFER_FIELD_LIMITS.discountLabel });
	if (isValidationError(discountResult)) {
		return badRequest(discountResult.error);
	}

	const badgeResult = validateString(body.badgeLabel, { label: "Badge label", max: OFFER_FIELD_LIMITS.badgeLabel });
	if (isValidationError(badgeResult)) {
		return badRequest(badgeResult.error);
	}

	const slugSource = typeof body.slug === "string" && body.slug.trim().length > 0 ? body.slug : titleResult;
	const slug = slugify(slugSource);
	if (slug.length === 0) {
		return badRequest("Slug could not be derived.");
	}

	let seo: Record<string, unknown> | undefined;
	if (body.seo !== undefined) {
		const parsed = parseSeoPayload(body.seo);
		if ("response" in parsed) {
			return parsed.response;
		}
		if ("seo" in parsed) {
			seo = parsed.seo as Record<string, unknown>;
		}
	}

	const content = normalizeStructuredContent(body.content, descriptionResult);

	const candidateConditions: OfferCondition[] = Array.isArray(body.conditions) ? body.conditions : [];
	const candidateAction: OfferAction =
		typeof body.action === "object" && body.action !== null
			? (body.action as OfferAction)
			: { type: "percentage_discount", value: 10, target: "matched_items" };

	const catalogValidationError = validateCatalogOfferRules(candidateConditions, candidateAction);
	if (catalogValidationError) {
		return badRequest(catalogValidationError);
	}

	await connectDB();

	const scopeConflict = await validateOfferCatalogScopeConflict(candidateConditions);
	if (scopeConflict) {
		return conflict(scopeConflict);
	}

	try {
		const doc = await Offer.create({
			slug,
			title: titleResult,
			description: content.summary || descriptionResult,
			discountLabel: discountResult,
			badgeLabel: badgeResult,
			color: parseColor(body.color),
			bannerImage: body.bannerImage && typeof body.bannerImage === "object" ? body.bannerImage : undefined,
			isActive: body.isActive !== false,
			sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
			content,
			conditions: candidateConditions,
			action: typeof body.action === "object" && body.action !== null ? body.action : { type: "percentage_discount", value: 10, target: "matched_items" },
			schedule: typeof body.schedule === "object" && body.schedule !== null ? body.schedule : {},
			constraints: normalizeOfferConstraints(body.constraints, candidateConditions),
			...(seo ? { seo } : {}),
		});
		await recordActivity({
			actor,
			action: "created",
			resourceType: "offer",
			resourceId: doc._id.toString(),
			resourceLabel: doc.title,
		});
		bustAdminCaches();
		return created(toOfferResponse(doc.toObject() as unknown as OfferLean));
	} catch (error) {
		return handleMongoError(error);
	}
}
