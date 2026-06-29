/**
 * Customer profile updates.
 *
 * PUT  → update name / email / city for the signed-in customer.
 *
 * Only the authenticated customer's own record is ever touched. The
 * `customerId` comes from the verified session — never from request body.
 */

import { Customer, connectDB } from "@store/db";
import { FIELD_LIMITS, badRequest, isValidationError, logger, notFound, ok, parseBody, serverError, unauthorized, validateEmail, validateString } from "@store/shared";

import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { getVerifiedCustomer, invalidateCustomerSessionCache } from "@/lib/server/customerSession";

export const dynamic = "force-dynamic";

interface UpdateProfileBody {
	name?: unknown;
	city?: unknown;
}

export async function PUT(request: Request) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}
	const actor = await getVerifiedCustomer();
	if (!actor) {
		return unauthorized();
	}

	const parsed = await parseBody<UpdateProfileBody>(request);
	if (parsed instanceof Response) {
		return parsed;
	}

	const nameResult = validateString(parsed.name, {
		label: "Name",
		min: 2,
		max: FIELD_LIMITS.personName,
	});
	if (isValidationError(nameResult)) {
		return badRequest(nameResult.error);
	}

	const cityResult = validateString(parsed.city, {
		label: "City",
		min: 1,
		max: FIELD_LIMITS.city,
	});
	if (isValidationError(cityResult)) {
		return badRequest(cityResult.error);
	}

	try {
		await connectDB();
		const updated = await Customer.findByIdAndUpdate(actor.id, { name: nameResult, city: cityResult }, { new: true, runValidators: true });
		if (!updated) {
			return notFound("Customer not found.");
		}
		invalidateCustomerSessionCache(actor.id);
		return ok({
			id: updated._id.toString(),
			name: updated.name,
			city: updated.city,
		});
	} catch (error) {
		logger.error({ error }, "profile update failed");
		return serverError("Update failed");
	}
}
