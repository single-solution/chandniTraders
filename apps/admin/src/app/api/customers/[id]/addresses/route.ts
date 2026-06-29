import { badRequest, isValidId, notFound, ok, parseBody, validateCustomerAddresses } from "@store/shared";
import { connectDB, Customer, handleMongoError } from "@store/db";

import { requireSession } from "@/lib/api/requireSession";
import { recordActivity } from "@/lib/services/activityLog";
import { loadCustomerOrderStats } from "@/lib/server/customerOrderStats";
import { toCustomerResponse, type CustomerLean } from "@/lib/serializers/customer";

interface RouteContext {
	params: Promise<{ id: string }>;
}

interface UpdateAddressesBody {
	addresses?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("customer_manage");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<UpdateAddressesBody>(request);
	if (body instanceof Response) {
		return body;
	}

	const validated = validateCustomerAddresses(body.addresses);
	if ("error" in validated) {
		return badRequest(validated.error);
	}

	await connectDB();
	try {
		const doc = await Customer.findByIdAndUpdate(id, { addresses: validated.addresses }, { new: true, runValidators: true }).lean<CustomerLean>();
		if (!doc) {
			return notFound("Customer not found");
		}

		await recordActivity({
			actor,
			action: "updated",
			resourceType: "customer",
			resourceId: id,
			resourceLabel: doc.name,
			detail: "Updated saved addresses",
		});

		return ok(toCustomerResponse(doc, await loadCustomerOrderStats(doc._id)));
	} catch (error) {
		return handleMongoError(error);
	}
}
