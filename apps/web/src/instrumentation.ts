/**
 * Next.js boot hook for the storefront.
 *
 * `register()` runs once when the Node server starts (and exactly once per
 * worker, dev or prod). We use it for two things:
 *
 *   1. Fail-fast env validation — a missing `AUTH_SECRET` or malformed
 *      `MONGODB_URI` crashes the process before a single request lands.
 *   2. MongoDB connection pre-warm — the Atlas TLS handshake + auth costs
 *      ~10–15s on a cold connection. Doing it at boot moves that latency
 *      out of the first user request's critical path.
 *
 * Anything heavier (OpenTelemetry, etc.) should also live here so it never
 * blocks the request hot path.
 */

export async function register(): Promise<void> {
	// Edge runtime doesn't expose `process.env` the same way and doesn't need
	// these checks (it runs the proxy bundle, not server code). Guard so the
	// import never lands in an edge worker.
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}
	const [server, db] = await Promise.all([import("@store/shared/server"), import("@store/db")]);
	const { configureDevDnsResolvers } = await import("@store/shared/devDns");
	configureDevDnsResolvers();
	server.assertServerEnv({ appName: "web" });

	// Kick off the Mongo connection in the background — don't await; we don't
	// want a slow DB to block server boot. The first query that lands will
	// hit the already-warm pool and skip the TLS handshake cost.
	void db
		.connectDB()
		.then(async () => {
			const { warmStorefrontReadCaches } = await import("@/lib/core/cached");
			await warmStorefrontReadCaches();
		})
		.catch(() => {
			// The connection helper logs its own errors; swallow here so an
			// intermittent boot-time blip doesn't unhandled-reject the worker.
		});
}
