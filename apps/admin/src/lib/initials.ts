/** Number of letters shown in an initials badge. */
const INITIALS_LENGTH = 2;
/** Placeholder shown when a name is missing or all-whitespace. */
const UNKNOWN_INITIALS = "?";

/**
 * Build a 2-character initials badge from a person's display name.
 * Falls back to a single letter for one-word names, and "?" for empty input.
 */
export function getInitials(name: string | null | undefined): string {
	if (!name) {
		return UNKNOWN_INITIALS;
	}

	const trimmed = name.trim();
	if (!trimmed) {
		return UNKNOWN_INITIALS;
	}

	const parts = trimmed.split(/\s+/);
	if (parts.length === 1) {
		return parts[0].slice(0, INITIALS_LENGTH).toUpperCase();
	}

	const first = parts[0]?.[0] ?? "";
	const last = parts[parts.length - 1]?.[0] ?? "";
	return (first + last).toUpperCase();
}

/** Title-case a role identifier (e.g. "owner" → "Owner"). */
export function formatRole(role: string | null | undefined): string {
	if (!role) {
		return "";
	}
	return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}
