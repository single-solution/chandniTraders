import dns from "node:dns";

const PUBLIC_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"] as const;

let devDnsConfigured = false;

/**
 * Prepend reliable public DNS resolvers in local development.
 *
 * Some routers and VPN DNS proxies refuse SRV/TXT lookups (MongoDB Atlas
 * `mongodb+srv://`) or intermittently fail `getaddrinfo` for cloud hosts
 * (Vercel Blob, etc.). Node uses `dns.getServers()` for all lookups — this
 * runs once per worker at boot so MongoDB, `/_next/image`, and outbound
 * fetches share the same resolver list.
 *
 * Opt out with `DEV_SKIP_PUBLIC_DNS=true` when your network blocks public DNS.
 */
export function configureDevDnsResolvers(): void {
	if (process.env.NODE_ENV === "production" || devDnsConfigured) {
		return;
	}
	if (process.env.DEV_SKIP_PUBLIC_DNS === "true" || process.env.MONGODB_SKIP_PUBLIC_DNS === "true") {
		return;
	}

	const existing = dns.getServers();
	const publicDnsSet = new Set<string>(PUBLIC_DNS_SERVERS);
	const merged = [...PUBLIC_DNS_SERVERS, ...existing.filter((server) => !publicDnsSet.has(server))];
	dns.setServers(merged);
	devDnsConfigured = true;
}
