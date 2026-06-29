/**
 * Shared typing + reader for Next.js page `searchParams` on the admin list
 * workspaces. A param can arrive as a string, a string[] (repeated key), or be
 * absent; `firstParam` collapses that to the single value the loaders expect.
 */
export type AdminPageSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string {
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}
	return value ?? "";
}
