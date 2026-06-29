import { ok } from "@store/shared";

import { requireSession } from "@/lib/api/requireSession";
import { handleMongoError } from "@store/db";
import { loadAlertSummary } from "@/lib/server/alertSummary";

/**
 * Bound to `activity_view` because every alert this endpoint surfaces (stuck
 * orders, unanswered inquiries, low stock, etc.) is information about the
 * shop's operational state — the same audience as the activity feed.
 */
export async function GET() {
	const { response } = await requireSession("activity_view");
	if (response) {
		return response;
	}

	try {
		const summary = await loadAlertSummary();
		return ok(summary);
	} catch (error) {
		return handleMongoError(error);
	}
}
