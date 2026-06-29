import { ok } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { loadAdminCustomersCounts } from "@/lib/cached";

/**
 * Segment counts + total loyalty balance over ALL customers. Split out
 * from the list seed so the customers workspace paints its rows
 * immediately and streams these collection-wide aggregates (incl. the
 * `Order.distinct` for the "with orders" segment) in behind a shimmer.
 * `loadAdminCustomersCounts` is itself 15s-cached and tag-busted on mutation.
 */
export async function GET() {
	const { response } = await requireSession("customer_view");
	if (response) {
		return response;
	}

	const counts = await loadAdminCustomersCounts();
	return ok(counts);
}
