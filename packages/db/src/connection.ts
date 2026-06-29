import mongoose, { type ConnectOptions } from "mongoose";
import { configureDevDnsResolvers } from "@store/shared/devDns";
import { logger } from "@store/shared";

/**
 * Resolve `MONGODB_URI` lazily so that importing this module at build time
 * (when Next.js traces dependencies for static analysis) does not throw.
 * Only when `connectDB()` is actually invoked do we require the env var.
 */
function getMongoUri(): string {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error("MONGODB_URI environment variable is not set");
	}
	return uri;
}

interface MongooseCache {
	conn: typeof mongoose | null;
	promise: Promise<typeof mongoose> | null;
}

declare global {
	var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
if (!global.mongooseCache) {
	global.mongooseCache = cached;
}

if (!global.mongooseCache?.conn) {
	mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
	mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
	mongoose.connection.on("error", (error) => logger.error({ error }, "MongoDB connection error"));
}

const IP_FAMILY_V4 = 4;
const SERVER_SELECTION_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 15_000;
const MAX_POOL_SIZE = 10;
const MIN_POOL_SIZE = 0;
const MAX_IDLE_TIME_MS = 60_000;
const DNS_RETRY_ATTEMPTS = 3;
const DNS_RETRY_BASE_DELAY_MS = 400;

const MONGO_CONNECT_OPTIONS: ConnectOptions = {
	bufferCommands: false,
	// Force IPv4. Node 18+ prefers IPv6 by default, which can cause intermittent
	// DNS resolution failures with MongoDB Atlas SRV records on Vercel.
	family: IP_FAMILY_V4,
	// 15s ceiling on server selection + initial TCP — long enough to ride
	// out a slow Atlas region cold-start, short enough that a truly dead
	// cluster fails fast instead of hanging every Next.js request.
	serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
	connectTimeoutMS: CONNECT_TIMEOUT_MS,
	// Connection-pool sizing. In serverless environments (Vercel), each
	// concurrent request spins up its own lambda with its own connection pool.
	// High maxPoolSize and minPoolSize can quickly exhaust the Atlas connection
	// limit. We use a smaller max pool and no minimum pool to prevent leaks.
	maxPoolSize: MAX_POOL_SIZE,
	minPoolSize: MIN_POOL_SIZE,
	// Idle sockets in the pool get torn down after 60s. Combined with
	// `minPoolSize`, the pool self-heals without leaking idle connections.
	maxIdleTimeMS: MAX_IDLE_TIME_MS,
	// Wire-level compression. zstd is the fastest and most compact of
	// the supported algorithms; the driver negotiates `snappy`/`zlib`
	// as fallbacks if the server doesn't support zstd. Cuts payload
	// bytes on big aggregations by ~3–5×.
	compressors: ["zstd", "snappy", "zlib"],
	// Driver-level retry for transient read errors. Writes already retry
	// by default on Atlas; this makes reads symmetric.
	retryReads: true,
	retryWrites: true,
	// Auto-create indexes from schema definitions in dev (so adding an
	// `index()` call in `Product.ts` takes effect on the next start),
	// skip in production where indexes should be managed deliberately
	// and never block boot. Mongoose's default is `true`, which costs
	// ~tens of seconds against large collections every server start.
	autoIndex: process.env.NODE_ENV !== "production",
};

interface DnsLookupErrorShape {
	code?: string;
	syscall?: string;
}

function isTransientDnsLookupError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const dnsError = error as DnsLookupErrorShape;
	const isDnsSyscall = dnsError.syscall === "queryTxt" || dnsError.syscall === "resolveSrv" || dnsError.syscall === "getaddrinfo";
	if (!isDnsSyscall) {
		return false;
	}

	return dnsError.code === "EREFUSED" || dnsError.code === "ENOTFOUND" || dnsError.code === "ETIMEOUT" || dnsError.code === "ESERVFAIL";
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

async function openMongoConnection(): Promise<typeof mongoose> {
	configureDevDnsResolvers();

	let lastError: unknown;
	for (let attempt = 1; attempt <= DNS_RETRY_ATTEMPTS; attempt++) {
		try {
			return await mongoose.connect(getMongoUri(), MONGO_CONNECT_OPTIONS);
		} catch (error) {
			lastError = error;
			if (!isTransientDnsLookupError(error) || attempt === DNS_RETRY_ATTEMPTS) {
				throw error;
			}
			logger.warn({ error, attempt }, "MongoDB SRV DNS lookup failed, retrying");
			await delay(attempt * DNS_RETRY_BASE_DELAY_MS);
		}
	}

	throw lastError instanceof Error ? lastError : new Error("MongoDB connection failed");
}

/**
 * Connect to MongoDB using a module-level singleton so that hot-module
 * reloads (Next.js dev server) and serverless cold starts share one connection
 * rather than opening a new pool on every invocation.
 */
export async function connectDB() {
	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		cached.promise = openMongoConnection();
	}

	try {
		cached.conn = await cached.promise;
		return cached.conn;
	} catch (error) {
		// A rejected boot-time pre-warm (instrumentation) or a transient DNS blip
		// must not poison the cache — otherwise every later request re-awaits the
		// same failed promise until the dev server restarts.
		cached.promise = null;
		cached.conn = null;
		throw error;
	}
}
