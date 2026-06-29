/**
 * Bandwidth-aware gate for opportunistic prefetching.
 *
 * The Network Information API exposes a `navigator.connection` object on
 * Chromium (desktop, Android, Samsung Internet). Safari and Firefox don't
 * implement it — we treat `undefined` as "best guess, allow prefetch"
 * since the typical iOS visitor is on a flagship phone over fast cellular
 * or Wi-Fi.
 *
 * Used by:
 *   - touchstart / pointerdown prefetch on `<ProductCard>` and nav links
 *   - idle prefetch of `/cart`, `/account`, `/checkout` after first paint
 *
 * Rule of thumb: only prefetch when the network is fast 4G or better and
 * the user hasn't opted into Data Saver. Saves data for the worst-off
 * users and keeps server load manageable.
 */

interface NetworkInformationLike {
	saveData?: boolean;
	effectiveType?: "slow-2g" | "2g" | "3g" | "4g" | string;
	type?: string;
}

interface NavigatorWithConnection {
	connection?: NetworkInformationLike;
}

/**
 * Return `true` when it's safe to fire an opportunistic prefetch.
 *
 * - Server side → `false` (no network info available).
 * - Data Saver enabled → `false`.
 * - 2g / slow-2g effective network → `false`.
 * - Connection API missing (Safari, Firefox, older browsers) → `true`.
 * - 4g or unknown effective type → `true`.
 */
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
