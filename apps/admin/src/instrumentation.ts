/**
 * Next.js boot hook for the admin app.
 *
 * `register()` runs once when the Node server starts (and exactly once per
 * worker, dev or prod). We use it for two things:
 *
 *   1. Fail-fast env validation — a missing `AUTH_SECRET` or malformed
 *      `MONGODB_URI` crashes the process before a single request lands.
 *   2. MongoDB connection pre-warm — the Atlas TLS handshake + auth costs
 *      ~10–15s on a cold connection. Doing it at boot moves that latency
 *      out of the first user request's critical path.
 */

export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}
	const [server, db] = await Promise.all([import("@store/shared/server"), import("@store/db")]);
	const { configureDevDnsResolvers } = await import("@store/shared/devDns");
	configureDevDnsResolvers();
	server.assertServerEnv({ appName: "admin" });

	void db.connectDB().catch(() => {
		// Logged inside connectDB itself; swallow here so a transient boot blip
		// doesn't unhandled-reject the worker.
	});
}
