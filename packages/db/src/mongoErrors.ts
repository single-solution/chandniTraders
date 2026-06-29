import { NextResponse } from "next/server";
import { badRequest, conflict, logger } from "@store/shared";

/** MongoDB duplicate-key violation error code (E11000). */
const MONGO_DUPLICATE_KEY = 11_000;
/** HTTP 500 — server-side database failure. */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** Shape we coerce caught Mongo errors into for read-only inspection. */
interface MongoErrorShape {
	code?: number;
	name?: string;
}

/**
 * Returns true if `error` is a Mongo duplicate-key violation (E11000).
 * Useful for retry loops that only want to retry on collisions.
 */
export function isMongoDuplicateKeyError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	// Mongoose surfaces the native driver `code` field on the Error subclass;
	// there is no public type for it, so we read it through a structural cast.
	return (error as MongoErrorShape)?.code === MONGO_DUPLICATE_KEY;
}

/**
 * Convert a thrown DB error into a properly-shaped HTTP response.
 * Use inside a `catch` block when wrapping any Mongoose / Mongo call.
 */
export function handleMongoError(error: unknown): NextResponse {
	if (error instanceof Error) {
		// Mongoose attaches `code` and `name` on the standard Error subclass;
		// there's no public type for them, so we read them through a cast.
		const mongoError = error as MongoErrorShape;

		if (mongoError?.code === MONGO_DUPLICATE_KEY) {
			return conflict("A record with this value already exists.");
		}

		if (mongoError?.name === "ValidationError") {
			logger.error({ error }, "Mongoose validation error");
			return badRequest("The submitted data failed validation. Please check all fields and try again.");
		}

		if (mongoError?.name === "CastError") {
			return badRequest("Invalid ID format.");
		}
	}

	logger.error({ error }, "Unexpected database error");
	return NextResponse.json({ error: "An unexpected database error occurred." }, { status: HTTP_INTERNAL_SERVER_ERROR });
}
