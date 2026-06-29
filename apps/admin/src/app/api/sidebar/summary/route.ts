import { requireSession } from "@/lib/api/requireSession";
import { loadSidebarSummaryCached } from "@/lib/cached";
import { handleMongoError } from "@store/db";
import { ok } from "@store/shared";

export const dynamic = "force-dynamic";

export async function GET() {
	const { actor, response } = await requireSession();
	if (response) {
		return response;
	}

	try {
		const summary = await loadSidebarSummaryCached(actor.id);
		return ok(summary);
	} catch (error) {
		return handleMongoError(error);
	}
}
