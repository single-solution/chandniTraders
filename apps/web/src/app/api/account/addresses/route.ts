/**
 * Customer addresses (full replacement).
 *
 * PUT /api/account/addresses { addresses: AddressInput[] }
 *
 * Replaces the customer's `addresses` array atomically. Exactly one entry
 * is allowed to be `isDefault: true`; if none is marked, the first becomes
 * default.
 *
 * Validates every field server-side; the client-side form is for UX only.
 */

import { Customer, connectDB } from "@store/db";
import { badRequest, logger, notFound, ok, parseBody, serverError, unauthorized, validateCustomerAddresses } from "@store/shared";

import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { getVerifiedCustomer } from "@/lib/server/customerSession";

export const dynamic = "force-dynamic";

interface UpdateAddressesBody {
	addresses?: unknown;
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

	const parsed = await parseBody<UpdateAddressesBody>(request);
	if (parsed instanceof Response) {
		return parsed;
	}

	const validated = validateCustomerAddresses(parsed.addresses);
	if ("error" in validated) {
		return badRequest(validated.error);
	}

	try {
		await connectDB();
		const updated = await Customer.findByIdAndUpdate(actor.id, { addresses: validated.addresses }, { new: true, runValidators: true });
		if (!updated) {
			return notFound("Customer not found.");
		}
		return ok({ addresses: validated.addresses });
	} catch (error) {
		logger.error({ error }, "address update failed");
		return serverError("Update failed");
	}
}
