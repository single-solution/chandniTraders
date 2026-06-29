import { requireSession } from "@/lib/api/requireSession";
import { readListOptions, type ListResponse } from "@/lib/api/listOptions";
import { ok, isValidId } from "@store/shared";
import { summariseOrder, type OrderLean } from "@/lib/serializers/order";
import type { AdminOrderSummary } from "@/types/models";
import { connectDB, handleMongoError, Order, ORDER_STATUSES, type OrderStatus } from "@store/db";

const ALLOWED_STATUSES = new Set<string>(ORDER_STATUSES);

export async function GET(request: Request) {
	const { response } = await requireSession("order_view");
	if (response) {
		return response;
	}

	try {
		await connectDB();
		const { page, limit, skip, search, searchPattern } = readListOptions(request);
		const url = new URL(request.url);
		const statusFilter = url.searchParams.get("status");
		const customerId = url.searchParams.get("customerId");

		const filter: Record<string, unknown> = {};
		if (customerId && isValidId(customerId)) {
			filter.customerId = customerId;
		}
		if (search) {
			filter.$or = [
				{ orderNumber: { $regex: searchPattern, $options: "i" } },
				{ "customerSnapshot.name": { $regex: searchPattern, $options: "i" } },
				{ "customerSnapshot.phoneNumber": { $regex: searchPattern, $options: "i" } },
				{ "customerSnapshot.city": { $regex: searchPattern, $options: "i" } },
			];
		}
		if (statusFilter && ALLOWED_STATUSES.has(statusFilter)) {
			filter.status = statusFilter as OrderStatus;
		}

		const [docs, total] = await Promise.all([Order.find(filter).sort({ placedAt: -1 }).skip(skip).limit(limit).lean<OrderLean[]>(), Order.countDocuments(filter)]);

		const payload: ListResponse<AdminOrderSummary> = {
			items: docs.map(summariseOrder),
			total,
			page,
			limit,
		};
		return ok(payload);
	} catch (error) {
		return handleMongoError(error);
	}
}
