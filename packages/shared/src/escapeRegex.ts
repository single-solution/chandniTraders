/**
 * Escape a user-supplied string so it can be embedded inside a `RegExp`
 * without smuggling regex meta-characters. Used by every endpoint that
 * builds a Mongo `$regex` from search input.
 */
export function escapeRegex(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
