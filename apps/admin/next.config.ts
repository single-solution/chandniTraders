import { configureDevDnsResolvers } from "@store/shared/devDns";
import type { NextConfig } from "next";

configureDevDnsResolvers();

/**
 * Security headers for the **admin app**.
 *
 * Same image hosts as the storefront (admin renders the same product
 * imagery for editing) but everything else is locked down: connect-src is
 * same-origin only, frame-ancestors disallowed entirely, no inline-script
 * relaxations beyond what Next.js requires for hydration.
 *
 * If you ever IP-allowlist admin behind a Cloudflare / Vercel Firewall
 * rule, do that at the platform layer; the headers here are the in-app
 * complement.
 */
const isProduction = process.env.NODE_ENV === "production";

function buildS3ImageHosts(): string[] {
	const hosts = ["https://*.amazonaws.com", "https://*.s3.amazonaws.com"];
	const publicBase = process.env.AWS_S3_PUBLIC_URL_BASE?.trim();
	if (publicBase) {
		try {
			const hostname = new URL(publicBase).hostname;
			if (hostname) {
				hosts.push(`https://${hostname}`);
			}
		} catch {
			// Ignore invalid public URL at build time.
		}
	}
	return hosts;
}

const S3_IMAGE_HOSTS = buildS3ImageHosts();

const baseSecurityHeaders = [
	{ key: "X-XSS-Protection", value: "0" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
	},
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'",
			"object-src 'none'",
			"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline'",
			`img-src 'self' blob: data: https://images.unsplash.com https://cdn.simpleicons.org https://*.public.blob.vercel-storage.com ${S3_IMAGE_HOSTS.join(" ")}`,
			"font-src 'self' data:",
			"connect-src 'self'",
			"media-src 'self'",
			"manifest-src 'self'",
			// YouTube embed for the `Grade.video` editor preview. Without an
			// explicit `frame-src`, the spec falls back to `default-src 'self'`
			// and the iframe paints black. The legacy `youtube.com` host is
			// included alongside the privacy-enhanced `youtube-nocookie.com`
			// one because admins occasionally paste pre-rewritten embed URLs.
			"frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
			...(isProduction ? ["upgrade-insecure-requests"] : []),
		].join("; "),
	},
];

const securityHeaders = isProduction ? [...baseSecurityHeaders, { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : baseSecurityHeaders;

const nextConfig: NextConfig = {
	poweredByHeader: false,
	reactStrictMode: true,
	// Router cache windows. Default `dynamic = 0` (Next 16) makes admin back/
	// forward navigation re-fetch every page; a short 10s window keeps the
	// operator-facing data fresh (mutations call `bustAdminCaches()` for
	// anything sensitive) and makes the sidebar feel instant.
	experimental: {
		staleTimes: {
			dynamic: 30,
			static: 60,
		},
		// Tree-shake the most-imported icon set so admin's ~110 lucide-react
		// import sites don't ship the whole icon bundle in dev or per-chunk.
		optimizePackageImports: ["lucide-react", "@store/shared"],
	},
	transpilePackages: ["@store/db", "@store/shared", "@store/ui"],
	// Keep server-only Node packages OUT of the Webpack bundle so they're
	// resolved at runtime from `node_modules`. Critical for `pino`/
	// `pino-pretty`/`thread-stream` whose internal `lib/worker.js` is spawned
	// via `worker_threads` and breaks when Webpack re-paths it into a vendor
	// chunk (the symptom: `Cannot find module '.next/server/vendor-chunks/lib/
	// worker.js'` followed by "the worker thread exited" in dev).
	serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "pino-abstract-transport", "sonic-boom", "mongoose", "bcryptjs", "sharp"],
	images: {
		// Dev: load Blob URLs in the browser — skips `/_next/image` server fetch,
		// which fails when local DNS cannot resolve `*.public.blob.vercel-storage.com`.
		unoptimized: !isProduction,
		remotePatterns: [
			{ protocol: "https", hostname: "images.unsplash.com" },
			{ protocol: "https", hostname: "cdn.simpleicons.org" },
			{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
			{ protocol: "https", hostname: "*.amazonaws.com" },
			...(process.env.AWS_S3_PUBLIC_URL_BASE?.trim()
				? (() => {
						try {
							const hostname = new URL(process.env.AWS_S3_PUBLIC_URL_BASE.trim()).hostname;
							return hostname ? [{ protocol: "https" as const, hostname }] : [];
						} catch {
							return [];
						}
					})()
				: []),
		],
	},
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
	async redirects() {
		return [
			{
				source: "/attributes",
				destination: "/categories?tab=attributes",
				permanent: false,
			},
			{
				source: "/brands",
				destination: "/categories?tab=brands",
				permanent: false,
			},
			{
				source: "/loyalty",
				destination: "/customers",
				permanent: false,
			},
			{
				source: "/products/new",
				destination: "/products?wizard=1",
				permanent: false,
			},
		];
	},
};

export default nextConfig;
