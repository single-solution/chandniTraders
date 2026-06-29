/**
 * Bandwidth-aware gate for opportunistic prefetching in admin.
 *
 * Admin runs on operator networks (mostly office Wi-Fi / fast wired) so
 * the gate is generous: only Data Saver and confirmed 2g/slow-2g skip
 * the prefetch. Connection API absent (Safari, Firefox) → allow.
 */

interface NetworkInformationLike {
	saveData?: boolean;
	effectiveType?: "slow-2g" | "2g" | "3g" | "4g" | string;
}

interface NavigatorWithConnection {
	connection?: NetworkInformationLike;
}

export function prefetchAllowed(): boolean {
	if (typeof navigator === "undefined") {
		return false;
	}
	const connection = (navigator as Navigator & NavigatorWithConnection).connection;
	if (!connection) {
		return true;
	}
	if (connection.saveData === true) {
		return false;
	}
	if (connection.effectiveType === "2g" || connection.effectiveType === "slow-2g") {
		return false;
	}
	return true;
}
