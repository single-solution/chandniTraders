import { badRequest, isValidId, notFound, ok } from "@store/shared";
import { connectDB, Customer, LoyaltyAccount } from "@store/db";

import { requireSession } from "@/lib/api/requireSession";
import { toLoyaltyAccountResponse, type LoyaltyAccountLean } from "@/lib/serializers/loyalty";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("customer_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	const customer = await Customer.findById(id).select("name").lean<{ name: string }>();
	if (!customer) {
		return notFound("Customer not found");
	}

	const account = await LoyaltyAccount.findOne({ customerId: id }).lean<LoyaltyAccountLean>();
	if (!account) {
		return ok({ account: null });
	}

	return ok({
		account: toLoyaltyAccountResponse(account, customer.name),
	});
}
