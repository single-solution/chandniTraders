import { requireSession } from "@/lib/api/requireSession";
import { connectDB, Customer, handleMongoError } from "@store/db";
import { badRequest, isValidId, noContent } from "@store/shared";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("customer_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	try {
		await Customer.updateOne({ _id: id }, { $addToSet: { seenByAdminIds: actor.id } });
		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
