import { ok } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { loadAdminOrdersCounts } from "@/lib/cached";

/**
 * Order status counts + net revenue over ALL orders. Split out from the
 * list seed so the orders workspace can paint its rows immediately and
 * stream these collection-wide aggregates in behind a shimmer (the
 * aggregate is the one query heavy enough to delay first paint).
 * `loadAdminOrdersCounts` is itself 15s-cached and tag-busted on mutation.
 */
export async function GET() {
	const { response } = await requireSession("order_view");
	if (response) {
		return response;
	}

	const counts = await loadAdminOrdersCounts();
	return ok(counts);
}
