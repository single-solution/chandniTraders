/**
 * Hard guarantee that no crawler indexes the admin app.
 *
 * The layout already sets a `robots: noindex,nofollow` meta tag, but a
 * sibling robots.txt at the host root is what most crawlers actually
 * respect — especially when admin lives on its own subdomain.
 */
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [{ userAgent: "*", disallow: "/" }],
	};
}
