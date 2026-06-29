import { configureDevDnsResolvers } from "@store/shared/devDns";
import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

// Image optimizer workers inherit this process DNS list — must run before Next boots.
configureDevDnsResolvers();

/**
 * Security headers for the **storefront**. Tight CSP, customer-friendly:
 * allows the marketing image hosts (Unsplash, simpleicons) and nothing else.
 *
 * The admin app ships a stricter CSP variant (no third-party image hosts,
 * upload-only) and lives in apps/admin/next.config.ts.
 */
const isProduction = process.env.NODE_ENV === "production";

/** Hosts `MarketingPixels` loads scripts from (inline loaders + `<Script src>`). */
const MARKETING_SCRIPT_HOSTS = ["https://www.googletagmanager.com", "https://connect.facebook.net", "https://analytics.tiktok.com"] as const;

/** Beacon / XHR endpoints the pixels hit after load. */
const MARKETING_CONNECT_HOSTS = [
	"https://www.google-analytics.com",
	"https://region1.google-analytics.com",
	"https://www.googletagmanager.com",
	"https://connect.facebook.net",
	"https://www.facebook.com",
	"https://analytics.tiktok.com",
	"https://analytics-ipv6.tiktok.com",
] as const;

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

function buildContentSecurityPolicy(): string {
	// `unsafe-eval` is only needed for Next.js dev tooling (Fast Refresh /
	// source maps). Production bundles never call `eval`, so we drop it
	// there for a tighter policy and slightly faster JIT. `unsafe-inline`
	// stays — Next hydration + admin-configured pixel bootstraps rely on it.
	const scriptSrc = isProduction ? ["'self'", "'unsafe-inline'", ...MARKETING_SCRIPT_HOSTS] : ["'self'", "'unsafe-eval'", "'unsafe-inline'", ...MARKETING_SCRIPT_HOSTS];

	return [
		"default-src 'self'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"object-src 'none'",
		`script-src ${scriptSrc.join(" ")}`,
		"style-src 'self' 'unsafe-inline'",
		`img-src 'self' blob: data: https://chandnitraders.pk https://images.unsplash.com https://cdn.simpleicons.org https://*.public.blob.vercel-storage.com https://www.facebook.com ${S3_IMAGE_HOSTS.join(" ")}`,
		"font-src 'self' data:",
		`connect-src 'self' ${MARKETING_CONNECT_HOSTS.join(" ")}`,
		"media-src 'self'",
		"manifest-src 'self'",
		// Iframe sources:
		//   - Google Maps embed lives on www.google.com / maps.google.com via the
		//     keyless `output=embed` URL. Without an explicit `frame-src`, the spec
		//     falls back to `default-src 'self'` and Chrome/Firefox block the
		//     <iframe>; only Safari renders it. Both hosts are listed because
		//     Google occasionally 302s `www` → `maps`.
		//   - YouTube inspection videos for `Grade.video` are embedded through
		//     the privacy-enhanced `youtube-nocookie.com` host; the legacy
		//     `youtube.com` host is also allowed in case admins paste a regular
		//     embed link a downstream tool didn't rewrite.
		"frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://www.youtube.com",
		...(isProduction ? ["upgrade-insecure-requests"] : []),
	].join("; ");
}

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
		value: buildContentSecurityPolicy(),
	},
];

const securityHeaders = isProduction ? [...baseSecurityHeaders, { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : baseSecurityHeaders;

const nextConfig: NextConfig = {
	poweredByHeader: false,
	reactStrictMode: true,
	// Short router cache window keeps back/forward navigation snappy; ISR caps server staleness at 30s.
	// `static` matches the homepage `revalidate = 30` so prefetched routes stay aligned.
	experimental: {
		staleTimes: {
			dynamic: 30,
			static: 60,
		},
		optimizePackageImports: ["lucide-react", "@store/shared"],
	},
	// Treat the workspace packages as part of the build so Next.js compiles
	// their TypeScript instead of expecting a published .js bundle.
	transpilePackages: ["@store/db", "@store/shared", "@store/ui"],
	// Keep server-only Node packages OUT of the Webpack bundle so they're
	// resolved at runtime from `node_modules`. Critical for `pino`/
	// `pino-pretty`/`thread-stream` whose internal `lib/worker.js` is spawned
	// via `worker_threads` and breaks when Webpack re-paths it into a vendor
	// chunk (the symptom: `Cannot find module '.next/server/vendor-chunks/lib/
	// worker.js'` followed by "the worker thread exited" in dev).
	serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "pino-abstract-transport", "sonic-boom", "mongoose", "bcryptjs"],
	images: {
		// Dev: load Blob URLs in the browser — skips `/_next/image` server fetch,
		// which fails when local DNS cannot resolve `*.public.blob.vercel-storage.com`.
		unoptimized: !isProduction,
		formats: ["image/avif", "image/webp"],
		qualities: [65, 70, 75, 80, 85],
		remotePatterns: [
			{ protocol: "https", hostname: "chandnitraders.pk" },
			{ protocol: "https", hostname: "www.chandnitraders.pk" },
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
		// Product photos rarely change once uploaded; a week-long negative/
		// positive cache on the optimizer cuts repeat upstream fetches on hot
		// SKUs. Admin image swaps still propagate via new URLs.
		minimumCacheTTL: 60 * 60 * 24 * 7,
	},
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
	async redirects() {
		return [{ source: "/wishlist", destination: "/", permanent: true }];
	},
};

/**
 * `ANALYZE=true npm run build` opens a treemap of every client and server
 * bundle. Critical for catching regressions like server-only deps
 * (`mongoose`, `pino`) accidentally leaking into a client chunk via a
 * bad import path. Inert in normal builds — zero perf impact.
 */
const withAnalyzer = withBundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});

export default withAnalyzer(nextConfig);
