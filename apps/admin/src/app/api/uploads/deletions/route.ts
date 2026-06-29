/**
 * Best-effort batch delete for variant URLs.
 *
 * The gallery / single-image components POST here when the user removes
 * an image so we don't leak storage objects. Errors are swallowed
 * (returned as 200 with an `errors` array) because the UI should not
 * block on cleanup — the worst case is an orphan object that can be
 * reaped offline.
 *
 * URL: `POST /api/uploads/deletions` (replaces the verb URL
 * `/uploads/remove`). Each call creates one deletion request that
 * targets up to `MAX_URLS_PER_CALL` object URLs.
 */

import { badRequest, isAllowedStorageObjectUrl, logger, ok, parseBody } from "@store/shared";
import { resolveStorageProvider } from "@store/shared/server";

import { requireSession } from "@/lib/api/requireSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeletionRequest {
	urls?: unknown;
}

const MAX_URLS_PER_CALL = 16;

export async function POST(request: Request) {
	const { actor, response } = await requireSession("media_delete");
	if (response) return response;
	const userId = actor.id;

	const payload = await parseBody<DeletionRequest>(request);
	if (payload instanceof Response) {
		return payload;
	}
	if (!Array.isArray(payload.urls) || payload.urls.length === 0) {
		return badRequest("`urls` must be a non-empty array.");
	}
	if (payload.urls.length > MAX_URLS_PER_CALL) {
		return badRequest(`Up to ${MAX_URLS_PER_CALL} URLs per request.`);
	}

	const storage = await resolveStorageProvider();
	const errors: string[] = [];
	for (const raw of payload.urls) {
		if (typeof raw !== "string") {
			errors.push("non-string url skipped");
			continue;
		}
		if (!isAllowedStorageObjectUrl(raw)) {
			errors.push(raw);
			continue;
		}
		try {
			await storage.remove(raw);
		} catch (error) {
			logger.warn({ error, userId, url: raw }, "uploads/deletions: best-effort delete failed");
			errors.push(raw);
		}
	}

	return ok({ removed: payload.urls.length - errors.length, errors });
}
